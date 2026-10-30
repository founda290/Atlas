import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { readdir, lstat } from 'node:fs/promises'
import path from 'node:path'
import { WorkspaceGuard, type AgentRuntime } from './runtime.js'
import { isSensitivePath, readWorkspaceFile, WorkspaceFileError } from './workspace-files.js'
import { createRuntimeMessageId } from './messages.js'
import { ServiceError, text, type StoredSession, type ModelSelection } from './domain.js'
import { filterRuntimeDiffs } from './session-diff.js'
interface Session {
  id: string
  runtimeId: string
  workspaceId: string
  status: string
  operation?: string
  controller?: AbortController
  lastError?: { code: string; message: string }
  created: number
  title?: string
  updated?: number
  model?: ModelSelection
  resumable?: boolean
  subscribers: Set<http.ServerResponse>
}
class InvalidRequest extends Error {}
export interface SessionPersistence {
  initial: StoredSession[]
  save(session: StoredSession): Promise<void>
  messages(id: string): Promise<unknown[]>
  saveMessages(id: string, messages: unknown[]): Promise<void>
  event(event: Record<string, unknown>, sessionId: string): Promise<void>
}
export function createAtlasServer(
  runtime: AgentRuntime,
  guard: WorkspaceGuard,
  persistence?: SessionPersistence,
) {
  const sessions = new Map<string, Session>(
    (persistence?.initial ?? []).map((s) => [
      s.id,
      {
        id: s.id,
        runtimeId: s.runtimeSessionId,
        workspaceId: s.workspaceId,
        title: s.title,
        model: s.model,
        lastError: s.lastError,
        status: s.status,
        created: s.created,
        updated: s.updated,
        resumable: false,
        subscribers: new Set<http.ServerResponse>(),
      },
    ]),
  )
  let writes = Promise.resolve()
  function persist(session: Session) {
    if (!persistence) return Promise.resolve()
    const stored: StoredSession = {
      id: session.id,
      runtimeSessionId: session.runtimeId,
      workspaceId: session.workspaceId,
      title: session.title ?? 'Coding session',
      created: session.created,
      updated: Date.now(),
      status: session.status,
      model: session.model,
      resumable: session.resumable,
      lastError: session.lastError,
    }
    const next = writes.catch(() => undefined).then(() => persistence.save(stored))
    writes = next
    return next
  }
  const capturedAt = new Map<string, number>()
  const capturing = new Map<string, Promise<void>>()
  function capture(session: Session, force = false): Promise<void> {
    if (!persistence) return Promise.resolve()
    if (capturing.has(session.id))
      return force
        ? capturing
            .get(session.id)!
            .catch(() => undefined)
            .then(() => capture(session, true))
        : capturing.get(session.id)!
    if (!force && Date.now() - (capturedAt.get(session.id) ?? 0) < 500) return Promise.resolve()
    capturedAt.set(session.id, Date.now())
    const task = runtime
      .messages(session.runtimeId)
      .then((messages) => persistence.saveMessages(session.id, messages))
      .finally(() => capturing.delete(session.id))
    capturing.set(session.id, task)
    return task
  }
  const eventWrites = new Set<Promise<void>>()
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
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of req.iterator({ destroyOnReturn: false })) {
      const bytes = Buffer.from(chunk)
      size += bytes.length
      if (size > 100000) {
        req.resume()
        throw new InvalidRequest('Request body exceeds 100,000 bytes')
      }
      chunks.push(bytes)
    }
    try {
      const data = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))
      const parsed: unknown = data ? JSON.parse(data) : {}
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
      return parsed as Record<string, unknown>
    } catch {
      throw new InvalidRequest('Request body must be a JSON object')
    }
  }
  function emit(session: Session, event: Record<string, unknown>) {
    event = { ...event, id: event.id ?? randomUUID() }
    const payload = `id: ${event.id ?? randomUUID()}\nevent: ${event.type ?? 'runtime.event'}\ndata: ${JSON.stringify(event)}\n\n`
    for (const subscriber of session.subscribers) {
      if (subscriber.writableLength > 1024 * 1024) subscriber.destroy()
      else subscriber.write(payload)
    }
    const data =
      event.data && typeof event.data === 'object' ? (event.data as Record<string, unknown>) : {}
    const part =
      data.part && typeof data.part === 'object' ? (data.part as Record<string, unknown>) : {}
    const relevant =
      event.type !== 'message.part.delta' &&
      (event.type !== 'message.part.updated' || part.type === 'tool')
    if (persistence && relevant) {
      const write = persistence
        .event(event, session.id)
        .catch(() => {
          session.lastError ??= {
            code: 'activity_persistence_failed',
            message: 'Activity metadata could not be saved. Execution state has not been changed.',
          }
        })
        .finally(() => eventWrites.delete(write))
      eventWrites.add(write)
    }
  }
  function ensureEvents() {
    if (eventLoopStarted || controller.signal.aborted) return
    eventLoopStarted = true
    // Never await this long-lived subscription in the create-session request.
    void (async () => {
      try {
        for await (const event of runtime.events(controller.signal)) {
          const session = [...sessions.values()].find((item) => item.runtimeId === event.sessionId)
          if (session) {
            emit(session, { ...event, sessionId: session.id })
            if (event.type.startsWith('message.')) void capture(session).catch(() => undefined)
          }
        }
      } catch {
        /* Runtime/request errors are exposed separately. A later session can reconnect. */
      } finally {
        eventLoopStarted = false
        if (
          !controller.signal.aborted &&
          [...sessions.values()].some((s) => s.subscribers.size || s.status === 'running')
        ) {
          const retry = setTimeout(ensureEvents, 2000)
          retry.unref()
        }
      }
    })()
  }
  async function workspaceStatus() {
    const root = await guard.assert()
    const files: Array<{ path: string; kind: string; bytes: number }> = []
    async function walk(directory: string) {
      for (const name of await readdir(directory)) {
        if (isSensitivePath(name)) continue
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
    if (!res.hasHeader('access-control-allow-origin'))
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
        const title = text(input.title, 'session title', 120, true)
        let model: ModelSelection | undefined
        if (input.model !== undefined) {
          const raw = input.model as ModelSelection
          if (
            !raw ||
            typeof raw.providerID !== 'string' ||
            typeof raw.modelID !== 'string' ||
            raw.providerID.length > 200 ||
            raw.modelID.length > 300
          )
            throw new ServiceError(400, 'Invalid model selection')
          await runtime.validateModel?.(raw)
          model = { providerID: raw.providerID, modelID: raw.modelID }
        }
        const created = await runtime.createSession(title || undefined)
        const session: Session = {
          id: randomUUID(),
          runtimeId: created.id,
          workspaceId: guard.id,
          status: 'ready',
          title: typeof input.title === 'string' ? input.title.slice(0, 120) : 'Coding session',
          model,
          resumable: true,
          created: created.created,
          subscribers: new Set(),
        }
        sessions.set(session.id, session)
        await persist(session)
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
            title: session.title,
            model: session.model,
            updated: Date.now(),
          },
          requestId,
        )
      }
      const messages = url.pathname.match(/^\/api\/v1\/sessions\/([^/]+)\/messages$/)
      if (messages && (req.method === 'POST' || req.method === 'GET')) {
        const session = sessionFor(messages[1])
        if (!session) return error(res, 404, 'Session not found', requestId)
        if (req.method === 'GET') {
          try {
            const messages = await runtime.messages(session.runtimeId)
            if (persistence) await persistence.saveMessages(session.id, messages)
            if (session.status === 'cancelling' && (await runtime.reconcile?.(session.runtimeId))) {
              session.status = 'interrupted'
              session.operation = undefined
              await persist(session)
            }
            if (session.resumable === false)
              session.resumable = (await runtime.reconcile?.(session.runtimeId)) ?? false
            return json(
              res,
              200,
              {
                sessionId: session.id,
                messages,
                status: session.status,
                error: session.lastError?.message,
                errorCode: session.lastError?.code,
                resumable: session.resumable ?? true,
                historical: session.resumable === false,
              },
              requestId,
            )
          } catch (failure) {
            if (!persistence) throw failure
            session.resumable = false
            return json(
              res,
              200,
              {
                sessionId: session.id,
                messages: await persistence.messages(session.id),
                status: session.status,
                error: session.lastError?.message,
                errorCode: session.lastError?.code,
                historical: true,
                resumable: false,
              },
              requestId,
            )
          }
        }
        if (session.resumable === false) {
          session.resumable = (await runtime.reconcile?.(session.runtimeId)) ?? false
          if (!session.resumable)
            throw new ServiceError(
              409,
              'Historical session cannot be resumed. Start a new coding session.',
            )
        }
        if (session.status === 'running' || session.status === 'cancelling')
          return error(res, 409, 'Session already has an active operation', requestId)
        const input = await body(req)
        if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 20_000)
          return error(res, 400, 'Prompt must be non-empty and under 20,000 characters', requestId)
        session.status = 'running'
        session.lastError = undefined
        const operation = randomUUID()
        session.operation = operation
        session.controller = new AbortController()
        const messageId = createRuntimeMessageId()
        await persist(session)
        if (persistence)
          await persistence.saveMessages(session.id, [
            {
              info: { id: messageId, role: 'user', time: { created: Date.now() } },
              parts: [{ type: 'text', text: input.text.trim() }],
            },
          ])
        emit(session, { type: 'session.started', sessionId: session.id, operationId: operation })
        ensureEvents()
        void runtime
          .prompt(
            session.runtimeId,
            input.text.trim(),
            session.model,
            messageId,
            session.controller.signal,
          )
          .then(async () => {
            if (session.operation !== operation || session.status !== 'running') return
            session.status = 'completed'
            await persist(session)
            await capture(session, true).catch(() => undefined)
            if (session.operation !== operation || session.status !== 'completed') return
            emit(session, {
              type: 'session.completed',
              sessionId: session.id,
              operationId: operation,
            })
          })
          .catch(async (failure) => {
            if (session.operation !== operation || session.status !== 'running') return
            session.lastError = {
              code: failure instanceof ServiceError ? failure.code : 'runtime_request_failed',
              message:
                failure instanceof ServiceError ? failure.message : 'The model request failed.',
            }
            session.status =
              failure instanceof ServiceError && failure.code === 'cancellation_unconfirmed'
                ? 'cancelling'
                : 'failed'
            await persist(session).catch(() => undefined)
            await capture(session, true).catch(() => undefined)
            emit(session, {
              type: session.status === 'cancelling' ? 'session.error' : 'session.failed',
              sessionId: session.id,
              operationId: operation,
              error: session.lastError.message,
              errorCode: session.lastError.code,
            })
          })
        return json(
          res,
          202,
          { messageId: operation, sessionId: session.id, status: session.status },
          requestId,
        )
      }
      const modelRoute = url.pathname.match(/^\/api\/v1\/sessions\/([^/]+)\/model$/)
      if (modelRoute && req.method === 'POST') {
        const session = sessionFor(modelRoute[1])
        if (!session) return error(res, 404, 'Session not found', requestId)
        if (['running', 'cancelling'].includes(session.status))
          throw new ServiceError(
            409,
            'Cancel or finish the active operation before changing models',
          )
        const input = await body(req)
        if (typeof input.providerID !== 'string' || typeof input.modelID !== 'string')
          throw new ServiceError(400, 'Invalid model selection')
        if (!runtime.validateModel)
          throw new ServiceError(503, 'Runtime does not support model selection')
        const model = { providerID: input.providerID, modelID: input.modelID }
        await runtime.validateModel(model)
        session.model = model
        await persist(session)
        return json(res, 200, { sessionId: session.id, model }, requestId)
      }
      const diff = url.pathname.match(/^\/api\/v1\/sessions\/([^/]+)\/diff$/)
      if (diff && req.method === 'GET') {
        const session = sessionFor(diff[1])
        if (!session) return error(res, 404, 'Session not found', requestId)
        const result = filterRuntimeDiffs(await runtime.diff(session.runtimeId))
        return json(res, 200, { sessionId: session.id, ...result }, requestId)
      }
      const file = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/file$/)
      if (file && req.method === 'GET') {
        if (file[1] !== guard.id) return error(res, 404, 'Workspace not found', requestId)
        return json(
          res,
          200,
          await readWorkspaceFile(guard, url.searchParams.get('path') ?? ''),
          requestId,
        )
      }
      const events = url.pathname.match(/^\/api\/v1\/sessions\/([^/]+)\/events$/)
      if (events && req.method === 'GET') {
        const session = sessionFor(events[1])
        if (!session) return error(res, 404, 'Session not found', requestId)
        ensureEvents()
        if (session.subscribers.size >= 16)
          return error(res, 429, 'Too many event subscribers', requestId)
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
        if (!['running', 'cancelling'].includes(session.status))
          return json(
            res,
            200,
            { sessionId: session.id, cancelled: false, status: session.status },
            requestId,
          )
        session.status = 'cancelling'
        const operation = session.operation
        session.operation = undefined
        session.controller?.abort()
        await persist(session)
        try {
          const cancelled = await runtime.abort(session.runtimeId)
          session.status = cancelled ? 'cancelled' : 'cancelling'
          session.lastError = cancelled
            ? undefined
            : {
                code: 'cancellation_unconfirmed',
                message:
                  'The model worker did not confirm cancellation. Work remains marked active until idle is verified.',
              }
          await persist(session)
          await capture(session, true).catch(() => undefined)
          emit(session, {
            type: cancelled ? 'session.cancelled' : 'session.error',
            sessionId: session.id,
            operationId: operation,
            ...(!cancelled ? { error: 'The model worker did not confirm cancellation.' } : {}),
          })
          return json(
            res,
            200,
            { sessionId: session.id, cancelled, status: session.status },
            requestId,
          )
        } catch {
          session.status = 'cancelling'
          session.lastError = {
            code: 'cancellation_unconfirmed',
            message:
              'Cancellation failed; runtime execution state is unknown. The project stays locked.',
          }
          await persist(session).catch(() => undefined)
          emit(session, {
            type: 'session.error',
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
        failure instanceof WorkspaceFileError || failure instanceof ServiceError
          ? failure.status
          : failure instanceof InvalidRequest
            ? 400
            : 503,
        failure instanceof InvalidRequest ||
          failure instanceof WorkspaceFileError ||
          failure instanceof ServiceError
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
      for (const session of sessions.values())
        if (session.status === 'running' || session.status === 'cancelling') {
          session.operation = undefined
          session.controller?.abort()
          await runtime.abort(session.runtimeId).catch(() => false)
          session.status = 'interrupted'
          await persist(session).catch(() => undefined)
          await capture(session, true).catch(() => undefined)
        }
      await writes.catch(() => undefined)
      await runtime.close()
      await Promise.allSettled([...capturing.values(), ...eventWrites])
      await writes.catch(() => undefined)
      if (server.listening)
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        )
    },
  }
}
