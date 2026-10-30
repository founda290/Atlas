// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { Pool, PoolClient } from 'pg'
import { CloudJobQueue } from '../src/cloud/jobQueue.js'

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    owner_id: 'owner-a',
    project_id: null,
    kind: 'chat_message',
    status: 'queued',
    error_code: null,
    error_message: null,
    created_at: new Date(0),
    updated_at: new Date(0),
    available_at: new Date(0),
    started_at: null,
    finished_at: null,
    attempt_count: 0,
    ...overrides,
  }
}
function fakePool() {
  const query = vi.fn(async (_sql: string, _values?: unknown[]) => ({ rows: [row()], rowCount: 1 }))
  const clientQuery = vi.fn(async (sql: string) => {
    if (sql.startsWith('SELECT id')) return { rows: [{ id: 'job-1' }], rowCount: 1 }
    if (sql.startsWith("UPDATE atlas_cloud.jobs SET status='running'"))
      return {
        rows: [
          row({
            status: 'running',
            payload_ciphertext: Buffer.from('cipher'),
            payload_nonce: Buffer.alloc(12),
            payload_auth_tag: Buffer.alloc(16),
            payload_key_version: 1,
            lease_owner: 'worker',
            lease_token: 'token',
            lease_expires_at: new Date(Date.now() + 60_000),
          }),
        ],
        rowCount: 1,
      }
    return { rows: [], rowCount: 0 }
  })
  const client = { query: clientQuery, release: vi.fn() } as unknown as PoolClient
  const pool = { query, connect: vi.fn(async () => client) } as unknown as Pool
  return { queue: new CloudJobQueue(pool), query, clientQuery, pool }
}

describe('CloudJobQueue protocol', () => {
  it('scopes enqueue idempotency, reads, and cancel updates to the owner', async () => {
    const f = fakePool()
    await f.queue.enqueue({
      ownerId: 'owner-a',
      kind: 'chat_message',
      idempotencyKey: 'same',
      payloadCiphertext: Buffer.from('cipher'),
      payloadNonce: Buffer.alloc(12),
      payloadAuthTag: Buffer.alloc(16),
      payloadKeyVersion: 1,
    })
    expect(f.query.mock.calls[0]![0]).toContain('ON CONFLICT (owner_id,idempotency_key)')
    expect(f.query.mock.calls[0]![0]).not.toMatch(/prompt|api_key/i)
    expect(f.query.mock.calls[0]![1]).toContain('owner-a')
    await f.queue.get('owner-a', 'job-1')
    await f.queue.list('owner-a')
    await f.queue.cancel('owner-a', 'job-1')
    for (const [sql, args] of f.query.mock.calls.slice(1)) {
      expect(sql).toContain('owner_id=$1')
      expect(args?.[0]).toBe('owner-a')
    }
  })

  it('claims atomically with SKIP LOCKED and exposes ciphertext only on worker claim', async () => {
    const f = fakePool()
    const claimed = await f.queue.claimNext('worker')
    expect(f.clientQuery.mock.calls.map(([sql]) => sql)).toContainEqual(
      expect.stringContaining('FOR UPDATE SKIP LOCKED'),
    )
    expect(f.clientQuery.mock.calls.map(([sql]) => sql)).toContain('BEGIN')
    expect(claimed?.payloadCiphertext).toEqual(Buffer.from('cipher'))
    expect(claimed).not.toHaveProperty('payload')
  })

  it('fences heartbeat/complete/fail using job, worker, and lease token', async () => {
    const f = fakePool()
    await f.queue.heartbeat('job-1', 'worker', 'token')
    await f.queue.complete(
      'job-1',
      'worker',
      'token',
      Buffer.from('x'),
      Buffer.alloc(12),
      Buffer.alloc(16),
      1,
    )
    await f.queue.fail('job-1', 'worker', 'token', 'worker_error', 'safe failure')
    for (const [sql] of f.query.mock.calls) {
      expect(sql).toContain('lease_owner=$2 AND lease_token=$3')
      expect(sql).toContain("status='running'")
      expect(sql).toContain('lease_expires_at>now()')
    }
  })

  it('immediately cancels queued jobs and requests cancellation for running jobs', async () => {
    const f = fakePool()
    await f.queue.cancel('owner-a', 'job-1')
    expect(f.query.mock.calls[0]![0]).toContain(
      "WHEN status='queued' THEN 'cancelled' ELSE 'cancel_requested'",
    )
    expect(f.query.mock.calls[0]![0]).toContain("status IN ('queued','running')")
  })

  it('marks expired running leases interrupted without requeueing', async () => {
    const f = fakePool()
    await f.queue.claimNext('worker')
    const expiry = String(
      f.clientQuery.mock.calls.find(([sql]) =>
        String(sql).startsWith("UPDATE atlas_cloud.jobs SET status='interrupted'"),
      )?.[0],
    )
    expect(expiry).toContain("status='running' AND lease_expires_at<=now()")
    expect(expiry).toContain("status='interrupted'")
    expect(expiry).not.toContain("status='queued'")
  })

  it('returns safe public metadata without encrypted or plaintext secret fields', async () => {
    const f = fakePool()
    const publicJob = await f.queue.get('owner-a', 'job-1')
    expect(publicJob).not.toHaveProperty('payloadCiphertext')
    expect(publicJob).not.toHaveProperty('resultCiphertext')
    expect(publicJob).not.toHaveProperty('prompt')
    expect(publicJob).not.toHaveProperty('apiKey')
    expect(f.query.mock.calls[0]![0]).not.toMatch(
      /payload_ciphertext|result_ciphertext|prompt|api_key/i,
    )
  })
})
