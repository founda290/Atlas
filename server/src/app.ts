import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { readdir, lstat } from 'node:fs/promises'
import path from 'node:path'
import { WorkspaceGuard, type AgentRuntime } from './runtime.js'
interface Session {
  id: string
  runtimeId: string
  workspaceId: string
  status: string
  operation?: string
  created: number
  subscribers: Set<http.ServerResponse>
}
class InvalidRequest extends Error {}
export function createAtlasServer(runtime: AgentRuntime, guard: WorkspaceGuard) {
  const sessions = new Map<string, Session>()
  let eventLoopStarted = false
  const controller = new AbortController()
  function json(res: http.ServerResponse, status: number, data: unknown, requestId: string) {
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'x-request-id': requestId,
      'cache-control': 'no-store',
    })
    res.end(JSON.stringify({ data, requestId }))
  }
  function error(res: http.ServerResponse, status: number, message: string, requestId: string) {
    json(
      res,
      status,
      { error: { code: status === 400 ? 'invalid_request' : 'request_failed', message } },
      requestId,
    )
  }
  function sessionFor(id: string) {
    return /^[A-Za-z0-9_-]{8,120}$/.test(id) ? sessions.get(id) : undefined
  }
  async function body(req: http.IncomingMessage): Promise<Record<string, unknown>> {
    let data = ''
    for await (const chunk of req) {
      data += chunk
      if (data.length > 100_000) throw new InvalidRequest('Request body exceeds 100,000 characters')
    }
    try {
      const parsed: unknown = data ? JSON.parse(data) : {}
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
      return parsed as Record<string, unknown>
    } catch {
      throw new InvalidRequest('Request body must be a JSON object')
    }
  }
  function emit(session: Session, event: Record<string, unknown>) {
    const payload = `id: ${event.id ?? randomUUID()}\nevent: ${event.type ?? 'runtime.event'}\ndata: ${JSON.stringify(event)}\n\n`
    for (const subscriber of session.subscribers) subscriber.write(payload)
  }
  function ensureEvents() {
    if (eventLoopStarted || controller.signal.aborted) return
    eventLoopStarted = true
    // Never await this long-lived subscription in the create-session request.
    void (async () => {
      try {
        for await (const event of runtime.events(controller.signal)) {
          const session = [...sessions.values()].find((item) => item.runtimeId === event.sessionId)
          if (session) emit(session, { ...event, sessionId: session.id })
        }
      } catch {
        /* Runtime/request errors are exposed separately. A later session can reconnect. */
      } finally {
        eventLoopStarted = false
      }
    })()
  }
  async function workspaceStatus() {
    const root = await guard.assert()
    const files: Array<{ path: string; kind: string; bytes: number }> = []
    async function walk(directory: string) {
      for (const name of await readdir(directory)) {
        if (
          name === '.git' ||
          name === 'node_modules' ||
          name === '.env' ||
          name.startsWith('.env.')
        )
          continue
        const absolute = path.join(directory, name)
        const info = await lstat(absolute)
        // Do not traverse symlinks outside the configured directory or loop through cycles.
        if (info.isSymbolicLink()) continue
        if (info.isDirectory()) await walk(absolute)
        else if (info.isFile())
          files.push({
            path: path.relative(root, absolute).split(path.sep).join('/'),
            kind: 'file',
            bytes: info.size,
          })
      }
    }
    await walk(root)
    return { workspaceId: guard.id, files }
  }
  const server = http.createServer(async (req, res) => {
    const requestId = randomUUID()
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    // Preserve the existing local API contract. This is not authentication or production CORS.
    res.setHeader('access-control-allow-origin', 'http://127.0.0.1:5173')
    res.setHeader('access-control-allow-headers', 'content-type')
    res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS')
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
    try {
      if (url.pathname === '/api/v1/health' && req.method === 'GET')
        return json(res, 200, { atlas: 'ok', runtime: await runtime.status() }, requestId)
      if (url.pathname === '/api/v1/sessions' && req.method === 'POST') {
        const input = await body(req)
        if (input.workspaceId !== guard.id)
          return error(res, 400, 'Unknown workspace identifier', requestId)
        const created = await runtime.createSession(
          typeof input.title === 'string' ? input.title.slice(0, 120) : undefined,
        )
        const session: Session = {
          id: randomUUID(),
          runtimeId: created.id,
          workspaceId: guard.id,
          status: 'ready',
          created: created.created,
          subscribers: new Set(),
        }
        sessions.set(session.id, session)
        ensureEvents()
        return json(
          res,
          201,
          {
            id: session.id,
            runtimeSessionId: session.runtimeId,
            workspaceId: session.workspaceId,
            created: session.created,
            status: session.status,
          },
          requestId,
        )
      }
      const messages = url.pathname.match(/^\/api\/v1\/sessions\/([^/]+)\/messages$/)
      if (messages && (req.method === 'POST' || req.method === 'GET')) {
        const session = sessionFor(messages[1])
        if (!session) return error(res, 404, 'Session not found', requestId)
        if (req.method === 'GET')
          return json(
            res,
            200,
            { sessionId: session.id, messages: await runtime.messages(session.runtimeId) },
            requestId,
          )
        if (session.status === 'running' || session.status === 'cancelling')
          return error(res, 409, 'Session already has an active operation', requestId)
        const input = await body(req)
        if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 20_000)
          return error(res, 400, 'Prompt must be non-empty and under 20,000 characters', requestId)
        session.status = 'running'
        const operation = randomUUID()
        session.operation = operation
        emit(session, { type: 'session.started', sessionId: session.id, operationId: operation })
        ensureEvents()
        void runtime
          .prompt(session.runtimeId, input.text.trim())
          .then(() => {
            if (session.operation !== operation || session.status !== 'running') return
            session.status = 'completed'
            emit(session, {
              type: 'session.completed',
              sessionId: session.id,
              operationId: operation,
            })
          })
          .catch(() => {
            if (session.operation !== operation || session.status !== 'running') return
            session.status = 'failed'
            emit(session, {
              type: 'session.failed',
              sessionId: session.id,
              operationId: operation,
              error: 'OpenCode prompt failed',
            })
          })
        return json(
          res,
          202,
          { messageId: operation, sessionId: session.id, status: session.status },
          requestId,
        )
      }
      const events = url.pathname.match(/^\/api\/v1\/sessions\/([^/]+)\/events$/)
      if (events && req.method === 'GET') {
        const session = sessionFor(events[1])
        if (!session) return error(res, 404, 'Session not found', requestId)
        res.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
          'x-request-id': requestId,
        })
        res.write(
          `event: connected\ndata: ${JSON.stringify({ sessionId: session.id, status: session.status })}\n\n`,
        )
        session.subscribers.add(res)
        const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15_000)
        res.on('close', () => {
          clearInterval(heartbeat)
          session.subscribers.delete(res)
        })
        return
      }
      const cancel = url.pathname.match(/^\/api\/v1\/sessions\/([^/]+)\/cancel$/)
      if (cancel && req.method === 'POST') {
        const session = sessionFor(cancel[1])
        if (!session) return error(res, 404, 'Session not found', requestId)
        if (session.status !== 'running')
          return json(
            res,
            200,
            { sessionId: session.id, cancelled: false, status: session.status },
            requestId,
          )
        session.status = 'cancelling'
        try {
          const cancelled = await runtime.abort(session.runtimeId)
          session.status = cancelled ? 'cancelled' : 'failed'
          emit(session, {
            type: cancelled ? 'session.cancelled' : 'session.failed',
            sessionId: session.id,
            operationId: session.operation,
            ...(!cancelled ? { error: 'OpenCode did not confirm cancellation' } : {}),
          })
          return json(
            res,
            200,
            { sessionId: session.id, cancelled, status: session.status },
            requestId,
          )
        } catch {
          session.status = 'failed'
          emit(session, {
            type: 'session.failed',
            sessionId: session.id,
            operationId: session.operation,
            error: 'Cancellation failed; runtime execution state is unknown',
          })
          return error(
            res,
            503,
            'Cancellation failed; runtime execution state is unknown',
            requestId,
          )
        }
      }
      const workspace = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/status$/)
      if (workspace && req.method === 'GET') {
        if (workspace[1] !== guard.id) return error(res, 404, 'Workspace not found', requestId)
        return json(res, 200, await workspaceStatus(), requestId)
      }
      return error(res, 404, 'Route not found', requestId)
    } catch (failure) {
      return error(
        res,
        failure instanceof InvalidRequest ? 400 : 503,
        failure instanceof InvalidRequest
          ? failure.message
          : 'Atlas runtime is unavailable or the request could not be completed',
        requestId,
      )
    }
  })
  return {
    server,
    async close() {
      controller.abort()
      for (const session of sessions.values())
        for (const subscriber of session.subscribers) subscriber.end()
      await runtime.close()
      if (server.listening)
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        )
    },
  }
}
