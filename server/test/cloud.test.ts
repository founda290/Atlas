// @vitest-environment node
import http from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CloudProjects, type CloudProject, type CloudRepository } from '../src/cloud/projects.js'
import { PostgresCloudRepository } from '../src/cloud/repository.js'
import { cloudControl, verifyAccount, createCloudControl } from '../src/cloud/control.js'
import type { Pool } from 'pg'
import { createHmac } from 'node:crypto'
import { SignedCloudWorker } from '../src/cloud/worker.js'
import { createRemoteJWKSet, generateKeyPair, SignJWT } from 'jose'
vi.mock('jose', async (original) => {
  const actual = await original<typeof import('jose')>()
  return { ...actual, createRemoteJWKSet: vi.fn() }
})
function fixture(enabled = true) {
  const rows = new Map<string, CloudProject>(),
    repository: CloudRepository = {
      list: async (owner) => [...rows.values()].filter((p) => p.ownerId === owner),
      insert: async (p) => {
        rows.set(p.id, p)
      },
      get: async (owner, id) => {
        const p = rows.get(id)
        return p?.ownerId === owner ? p : null
      },
      update: async (owner, id, change) => {
        const p = rows.get(id)
        if (p?.ownerId !== owner) return null
        const value = { ...p, ...change }
        rows.set(id, value)
        return value
      },
    }
  const worker = { available: true, provision: vi.fn(async () => {}), stop: vi.fn(async () => {}) }
  return { service: new CloudProjects(repository, worker, enabled), worker, rows }
}
afterEach(() => vi.unstubAllEnvs())
describe('disabled-by-default cloud foundation (no actual worker provisioning)', () => {
  it('denies disabled creation before metadata writes or worker calls', async () => {
    const f = fixture(false)
    await expect(f.service.create('owner', 'Project')).rejects.toMatchObject({
      code: 'cloud_disabled',
    })
    expect(f.rows.size).toBe(0)
    expect(f.worker.provision).not.toHaveBeenCalled()
  })
  it('has owned lifecycle contracts with an explicitly mocked isolated worker', async () => {
    const f = fixture(),
      p = await f.service.create('owner-a', 'Source')
    expect(p.status).toBe('provisioning')
    expect(f.worker.provision).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-a',
        projectId: p.id,
        idempotencyKey: p.id,
        networkPolicy: 'restricted',
      }),
    )
    expect(await f.service.list('owner-b')).toEqual([])
    await expect(f.service.update('owner-b', p.id, 'Attack', '', 'archived')).rejects.toMatchObject(
      { status: 404 },
    )
    expect(f.worker.stop).not.toHaveBeenCalled()
    await f.service.update('owner-a', p.id, 'Source', '', 'stopped')
    expect(f.worker.stop).toHaveBeenCalledWith({ ownerId: 'owner-a', projectId: p.id })
  })
  it('records provisioning failure rather than claiming a ready worker', async () => {
    const f = fixture()
    f.worker.provision.mockRejectedValueOnce(new Error('Test-only failure'))
    await expect(f.service.create('owner', 'Source')).rejects.toMatchObject({
      code: 'worker_unavailable',
    })
    expect([...f.rows.values()][0].status).toBe('failed')
  })
  it('parameterizes ownership into every PostgreSQL resource lookup/update', async () => {
    const query = vi.fn(async () => ({ rows: [] })),
      repo = new PostgresCloudRepository({ query } as unknown as Pool)
    await repo.list('owner')
    await repo.get('owner', 'id')
    await repo.update('owner', 'id', { name: 'Renamed', description: '', status: 'stopped' })
    for (const [sql, params] of query.mock.calls as unknown as [string, unknown[]][]) {
      expect(sql).toContain('owner_id=$1')
      expect(params[0]).toBe('owner')
    }
  })
  it('refuses unsigned identity and missing JWT verification configuration', async () => {
    await expect(verifyAccount(undefined)).rejects.toMatchObject({ status: 401 })
    vi.stubEnv('NEON_AUTH_JWKS_URL', '')
    await expect(verifyAccount('Bearer test.invalid.token')).rejects.toMatchObject({
      code: 'auth_not_configured',
    })
  })
  it('cryptographically verifies signature, expiry, issuer and audience before trusting the subject', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256')
    vi.mocked(createRemoteJWKSet).mockReturnValue(
      (async () => publicKey) as ReturnType<typeof createRemoteJWKSet>,
    )
    vi.stubEnv('NEON_AUTH_JWKS_URL', 'https://auth.example.test/auth/jwks')
    vi.stubEnv('NEON_AUTH_ISSUER', 'https://auth.example.test/auth')
    vi.stubEnv('NEON_AUTH_AUDIENCE', 'atlas-test')
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256' })
      .setSubject('verified-owner')
      .setIssuer('https://auth.example.test/auth')
      .setAudience('atlas-test')
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(privateKey)
    expect(await verifyAccount(`Bearer ${token}`)).toBe('verified-owner')
    vi.stubEnv('NEON_AUTH_AUDIENCE', 'wrong-audience')
    await expect(verifyAccount(`Bearer ${token}`)).rejects.toMatchObject({ status: 401 })
  })
  it('exposes readiness but rejects attempted cloud activation even with environment flags', async () => {
    vi.stubEnv('ATLAS_CLOUD_ENABLED', 'true')
    const server = http.createServer((req, res) => void cloudControl(req, res))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error()
    const url = `http://127.0.0.1:${address.port}/api/cloud`
    try {
      const result = await (await fetch(url)).json()
      expect(result.data.enabled).toBe(false)
      expect(
        (
          await fetch(url, {
            method: 'POST',
            headers: { authorization: 'Bearer test.invalid.token' },
            body: '{"ownerId":"attacker"}',
          })
        ).status,
      ).toBe(503)
      expect((await fetch(url, { method: 'OPTIONS' })).status).toBe(405)
    } finally {
      await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())))
    }
  })
  it('routes authenticated owned project operations and rejects client identity, origins and bad JSON (test-only enabled service)', async () => {
    const f = fixture(),
      handler = createCloudControl({
        enabled: true,
        verify: async (header) => {
          if (header === 'Bearer owner-a') return 'owner-a'
          if (header === 'Bearer owner-b') return 'owner-b'
          throw new Error('Unauthorized test identity')
        },
        service: () => f.service,
        origin: () => 'https://atlas.example.test',
      })
    const server = http.createServer((req, res) => void handler(req, res))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error()
    const url = `http://127.0.0.1:${address.port}/api/cloud?resource=projects`,
      headers = {
        authorization: 'Bearer owner-a',
        'content-type': 'application/json',
        origin: 'https://atlas.example.test',
      }
    try {
      expect(
        (
          await fetch(url, {
            method: 'POST',
            headers: { ...headers, origin: 'https://evil.example.test' },
            body: '{}',
          })
        ).status,
      ).toBe(403)
      expect(
        (
          await fetch(url, {
            method: 'POST',
            headers,
            body: '{"name":"Owner spoof","ownerId":"other"}',
          })
        ).status,
      ).toBe(400)
      expect((await fetch(url, { method: 'POST', headers, body: 'bad JSON' })).status).toBe(400)
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Real contract' }),
      })
      expect(response.status).toBe(201)
      const { data: p } = await response.json()
      expect(p.ownerId).toBe('owner-a')
      expect(p.status).toBe('provisioning')
      const listing = await (
        await fetch(url, { headers: { authorization: 'Bearer owner-b' } })
      ).json()
      expect(listing.data.projects).toEqual([])
      expect(
        (
          await fetch(`${url}&id=${p.id}`, {
            method: 'PATCH',
            headers: { ...headers, authorization: 'Bearer owner-b' },
            body: JSON.stringify({ name: 'Attempt', status: 'archived' }),
          })
        ).status,
      ).toBe(404)
      expect(
        (
          await fetch(`${url}&id=${p.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ name: 'Real contract', status: 'stopped' }),
          })
        ).status,
      ).toBe(200)
    } finally {
      await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())))
    }
  })
  it('signs bounded isolated-worker requests and requires an identity-matched acknowledgement (mock transport)', async () => {
    const secret = 'test-only-worker-signing-secret-at-least-32-characters',
      input = {
        projectId: 'test-project',
        ownerId: 'test-owner',
        idempotencyKey: 'test-project',
        networkPolicy: 'restricted' as const,
        maxRuntimeSeconds: 900,
      }
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ accepted: true, projectId: input.projectId, ownerId: input.ownerId }),
        ),
      )
    const worker = new SignedCloudWorker('https://worker.example.test', secret, transport)
    await worker.provision(input)
    const [url, options] = transport.mock.calls[0]
    expect(url).toBe('https://worker.example.test/v1/workspaces')
    const headers = options?.headers as Record<string, string>
    expect(headers['x-atlas-signature']).toBe(
      createHmac('sha256', secret)
        .update(`${headers['x-atlas-timestamp']}./v1/workspaces.${options?.body}`)
        .digest('hex'),
    )
    expect(options?.redirect).toBe('error')
    transport.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ accepted: true, projectId: input.projectId, ownerId: 'wrong-owner' }),
      ),
    )
    await expect(worker.stop(input)).rejects.toThrow('identity')
    transport.mockResolvedValueOnce(new Response('x'.repeat(16385)))
    await expect(worker.stop(input)).rejects.toThrow('acknowledgement')
    expect(() => new SignedCloudWorker('http://unsafe.test', secret)).toThrow('HTTPS')
  })
})
