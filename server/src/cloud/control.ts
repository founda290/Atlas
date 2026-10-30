import type { IncomingMessage, ServerResponse } from 'node:http'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { Pool } from 'pg'
import { cloudPolicy, CloudError, CloudProjects, type CloudWorker } from './projects.js'
import { PostgresCloudRepository } from './repository.js'
import { SignedCloudWorker } from './worker.js'
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined
export async function verifyAccount(authorization: string | undefined): Promise<string> {
  const token = authorization?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1]
  if (!token || token.length > 8192)
    throw new CloudError(401, 'sign_in_required', 'A verified account session is required.')
  const { NEON_AUTH_JWKS_URL, NEON_AUTH_ISSUER, NEON_AUTH_AUDIENCE } = process.env
  if (!NEON_AUTH_JWKS_URL || !NEON_AUTH_ISSUER || !NEON_AUTH_AUDIENCE)
    throw new CloudError(
      503,
      'auth_not_configured',
      'Cloud identity verification is not configured.',
    )
  const url = new URL(NEON_AUTH_JWKS_URL)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
    throw new CloudError(
      503,
      'auth_not_configured',
      'Cloud identity verification is not configured.',
    )
  try {
    jwks ??= createRemoteJWKSet(url, { timeoutDuration: 5000, cooldownDuration: 30000 })
    const { payload } = await jwtVerify(token, jwks, {
      issuer: NEON_AUTH_ISSUER,
      audience: NEON_AUTH_AUDIENCE,
      algorithms: ['RS256', 'ES256', 'EdDSA'],
      requiredClaims: ['sub', 'exp', 'iat'],
      maxTokenAge: '1h',
    })
    if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 256)
      throw new Error()
    return payload.sub
  } catch {
    throw new CloudError(
      401,
      'invalid_session',
      'Your account session could not be verified. Sign in again.',
    )
  }
}
function validateBody(value: unknown): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Buffer.byteLength(JSON.stringify(value)) > 65536
  )
    throw new CloudError(400, 'invalid_body', 'Use a JSON object of at most 64 KiB.')
  const data = value as Record<string, unknown>
  if (Object.keys(data).some((key) => !['name', 'description', 'status'].includes(key)))
    throw new CloudError(
      400,
      'invalid_body',
      'Unsupported cloud project fields. Identity is verified by the server.',
    )
  return data
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!req.headers['content-type']?.toLowerCase().startsWith('application/json'))
    throw new CloudError(415, 'invalid_content_type', 'Use application/json.')
  // Vercel may have parsed the body before entering the Node handler.
  if ('body' in req && req.body !== undefined) return validateBody(req.body)
  return new Promise((resolve, reject) => {
    let bytes = 0
    const chunks: Buffer[] = []
    const finish = (error?: Error) => {
      clearTimeout(timer)
      req.off('data', onData)
      req.off('end', onEnd)
      req.off('error', onError)
      if (error) {
        req.resume()
        reject(error)
      }
    }
    const onData = (chunk: Buffer) => {
      bytes += chunk.length
      if (bytes > 65536) {
        finish(new CloudError(413, 'body_too_large', 'Cloud request is too large.'))
        return
      }
      chunks.push(chunk)
    }
    const onError = () =>
      finish(new CloudError(400, 'invalid_body', 'Request body could not be read.'))
    const onEnd = () => {
      finish()
      try {
        resolve(
          validateBody(
            JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))),
          ),
        )
      } catch (e) {
        reject(
          e instanceof CloudError
            ? e
            : new CloudError(400, 'invalid_body', 'Request body must be valid UTF-8 JSON.'),
        )
      }
    }
    const timer = setTimeout(
      () => finish(new CloudError(408, 'request_timeout', 'Request body timed out.')),
      10000,
    )
    req.on('data', onData)
    req.once('end', onEnd)
    req.once('error', onError)
  })
}
interface ControlDependencies {
  enabled: boolean
  verify: (authorization: string | undefined) => Promise<string>
  service: () => CloudProjects
  origin: () => string | undefined
}
export function createCloudControl(dependencies: ControlDependencies) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    const send = (status: number, data: unknown) => {
      res.statusCode = status
      res.end(JSON.stringify({ data }))
    }
    try {
      const url = new URL(req.url ?? '/api/cloud', 'http://atlas.internal'),
        resource = url.searchParams.get('resource') ?? 'capabilities'
      if (req.method === 'GET' && resource === 'capabilities') {
        send(200, {
          mode: 'cloud',
          enabled: dependencies.enabled,
          reason: dependencies.enabled ? 'Cloud control plane available.' : cloudPolicy.reason,
          accountRequired: true,
          browserIndependent: dependencies.enabled,
        })
        return
      }
      if (!['GET', 'POST', 'PATCH'].includes(req.method ?? '')) {
        res.setHeader('Allow', 'GET, POST, PATCH')
        throw new CloudError(405, 'method_not_allowed', 'Unsupported cloud API method.')
      }
      // This release cannot be activated by any environment variable or browser flag.
      if (!dependencies.enabled) throw new CloudError(503, 'cloud_disabled', cloudPolicy.reason)
      const owner = await dependencies.verify(req.headers.authorization)
      if (resource !== 'projects')
        throw new CloudError(404, 'not_found', 'Cloud resource not found.')
      if (req.method === 'GET') {
        send(200, { projects: await dependencies.service().list(owner) })
        return
      }
      if (!dependencies.origin() || req.headers.origin !== dependencies.origin())
        throw new CloudError(403, 'invalid_origin', 'Cloud mutation origin is not authorized.')
      const data = await body(req)
      if (req.method === 'POST') {
        send(
          201,
          await dependencies
            .service()
            .create(owner, data.name as string, (data.description ?? '') as string),
        )
        return
      }
      const id = url.searchParams.get('id') ?? ''
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
        throw new CloudError(400, 'invalid_id', 'Use a valid cloud project identifier.')
      send(
        200,
        await dependencies
          .service()
          .update(
            owner,
            id,
            data.name as string,
            (data.description ?? '') as string,
            data.status as 'archived' | 'stopped',
          ),
      )
    } catch (e) {
      const error =
        e instanceof CloudError
          ? e
          : new CloudError(503, 'cloud_unavailable', 'The cloud control plane is unavailable.')
      send(error.status, { error: { code: error.code, message: error.message } })
    }
  }
}
let pool: Pool | undefined
const unavailableWorker: CloudWorker = {
  available: false,
  provision: async () => {
    throw new Error('Cloud worker is not installed')
  },
  stop: async () => {
    throw new Error('Cloud worker is not installed')
  },
}
function service() {
  if (!process.env.DATABASE_URL)
    throw new CloudError(503, 'storage_unavailable', 'Cloud metadata storage is not configured.')
  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    connectionTimeoutMillis: 3000,
    query_timeout: 5000,
    statement_timeout: 5000,
    ssl: undefined,
  })
  return new CloudProjects(
    new PostgresCloudRepository(pool),
    process.env.ATLAS_CLOUD_WORKER_URL && process.env.ATLAS_CLOUD_WORKER_SECRET
      ? new SignedCloudWorker(
          process.env.ATLAS_CLOUD_WORKER_URL,
          process.env.ATLAS_CLOUD_WORKER_SECRET,
        )
      : unavailableWorker,
    cloudPolicy.enabled,
  )
}
export const cloudControl = createCloudControl({
  enabled: cloudPolicy.enabled,
  verify: verifyAccount,
  service,
  origin: () => process.env.ATLAS_APP_ORIGIN,
})
