import http from 'node:http'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createAtlasServer } from './app.js'
import { Store } from './database/store.js'
import { ServiceError, publicProject } from './domain.js'
import { Projects } from './services/projects.js'
import { Files } from './services/files.js'
import { Git } from './services/git.js'
import { WorkspaceFileError } from './workspace-files.js'
import { OpenCodeLocalRuntime, WorkspaceGuard, type AgentRuntime } from './runtime.js'

export interface EngineeringOptions {
  dataDir: string
  workspaceRoot?: string
  databaseUrl?: string
  runtimeFactory?: (root: string) => AgentRuntime
  allowedOrigins?: string[]
}
export async function createEngineeringServer(options: EngineeringOptions) {
  const store = await Store.open(options.dataDir, options.databaseUrl)
  const projects = new Projects(
    store,
    path.resolve(options.workspaceRoot ?? path.join(options.dataDir, 'projects')),
  )
  await projects.initialize()
  for (const session of await store.sessions()) {
    if (['running', 'cancelling'].includes(session.status)) {
      session.status = 'interrupted'
      session.updated = Date.now()
      session.resumable = false
      session.lastError = {
        code: 'backend_restart',
        message:
          'The previous operation was interrupted by a backend restart. Inspect Git state before continuing.',
      }
      await store.saveSession(session)
    }
  }
  const files = new Files(),
    git = new Git(files)
  const factory = options.runtimeFactory ?? ((root) => new OpenCodeLocalRuntime(root))
  const catalogue = factory(projects.workspaceRoot)
  const apps = new Map<string, Promise<ReturnType<typeof createAtlasServer>>>()
  async function projectApp(id: string) {
    if (!apps.has(id))
      apps.set(
        id,
        (async () => {
          const project = await projects.get(id)
          return createAtlasServer(
            await projectRuntime(id),
            new WorkspaceGuard(project.rootPath, id),
            {
              initial: await store.sessions(id),
              save: (s) => store.saveSession(s),
              messages: (s) => store.messages(s),
              saveMessages: (id, items) => store.saveMessages(id, items),
              event: (event, sessionId) => store.event(id, event, sessionId),
            },
          )
        })().catch((error) => {
          apps.delete(id)
          throw error
        }),
      )
    return apps.get(id)!
  }
  const allowedOrigins = new Set(
    options.allowedOrigins ?? [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:8787',
      'http://127.0.0.1:8787',
    ],
  )
  const json = (res: http.ServerResponse, status: number, data: unknown, id: string) => {
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-request-id': id,
      'x-content-type-options': 'nosniff',
    })
    res.end(JSON.stringify({ data, requestId: id }))
  }
  async function body(req: http.IncomingMessage) {
    if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json')
      throw new ServiceError(415, 'Send application/json')
    let bytes = 0
    const chunks: Buffer[] = []
    for await (const chunk of req.iterator({ destroyOnReturn: false })) {
      const buffer = Buffer.from(chunk)
      bytes += buffer.length
      if (bytes > 2 * 1024 * 1024) {
        req.resume()
        throw new ServiceError(413, 'Request body exceeds 2 MiB')
      }
      chunks.push(buffer)
    }
    try {
      const parsed: unknown = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)),
      )
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
      return parsed as Record<string, unknown>
    } catch {
      throw new ServiceError(400, 'Send a JSON object')
    }
  }
  async function idle(id: string) {
    const row = await projects.get(id)
    if ((await store.sessions(id)).some((s) => ['running', 'cancelling'].includes(s.status)))
      throw new ServiceError(
        409,
        'Finish or cancel active agent work before changing project files',
      )
    return row
  }
  async function mutable(id: string) {
    await idle(id)
    return projects.get(id, false)
  }
  let closing = false
  let closePromise: Promise<void> | undefined
  const pendingHandlers = new Set<Promise<void>>()
  const server = http.createServer((req, res) => {
    const task = handle(req, res)
      .catch(() => {
        res.destroy()
      })
      .finally(() => pendingHandlers.delete(task))
    pendingHandlers.add(task)
  })
  async function handle(req: http.IncomingMessage, res: http.ServerResponse) {
    const requestId = randomUUID()
    try {
      res.setHeader('x-content-type-options', 'nosniff')
      if (closing) throw new ServiceError(503, 'Atlas backend is stopping')
      const host = new URL(`http://${req.headers.host ?? ''}`).hostname
      if (!['127.0.0.1', 'localhost', '[::1]'].includes(host))
        throw new ServiceError(403, 'Local API host is not permitted')
      const origin = req.headers.origin
      if ((origin && !allowedOrigins.has(origin)) || req.headers['sec-fetch-site'] === 'cross-site')
        throw new ServiceError(403, 'Request origin is not permitted')
      if (origin) {
        res.setHeader('access-control-allow-origin', origin)
        res.setHeader('vary', 'Origin')
      }
      res.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
      res.setHeader('access-control-allow-headers', 'content-type,x-atlas-project-id')
      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }
      if (
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method ?? '') &&
        req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json'
      )
        throw new ServiceError(415, 'Send application/json')
      const url = new URL(req.url ?? '/', 'http://localhost'),
        pathname = url.pathname
      const send = (data: unknown, status = 200) => json(res, status, data, requestId)
      if (pathname === '/api/v1/health' && req.method === 'GET')
        return send({
          atlas: 'ok',
          runtime: await catalogue.status(),
          storage: store.kind,
          storageHealthy: await store.healthy(),
          execution: 'trusted-local',
        })
      if (['/api/v1/providers', '/api/v1/models'].includes(pathname) && req.method === 'GET') {
        if (!catalogue.catalogue)
          throw new ServiceError(503, 'Runtime does not support provider discovery')
        const projectId = url.searchParams.get('projectId')
        const providerRuntime = projectId ? await projectRuntime(projectId) : catalogue
        // Project-scoped discovery must use that project's OpenCode config rather than browser configuration.
        if (!providerRuntime.catalogue) throw new ServiceError(503, 'Model discovery unavailable')
        const providers = await providerRuntime.catalogue()
        return send(
          pathname.endsWith('/models')
            ? { models: providers.flatMap((p) => p.models) }
            : { providers },
        )
      }
      if (pathname === '/api/v1/projects') {
        if (req.method === 'GET')
          return send({
            projects: (await store.projects())
              .filter((p) => p.status !== 'deleted')
              .map(publicProject)
              .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt),
          })
        if (req.method === 'POST')
          return send(
            await files.locked('projects', () => body(req).then((input) => projects.create(input))),
            201,
          )
      }
      const route = pathname.match(/^\/api\/v1\/projects\/([^/]+)(.*)$/)
      if (route) {
        const [, id, suffix] = route
        const project = await projects.get(id)
        if (!suffix) {
          if (req.method === 'GET') return send(publicProject(project))
          if (req.method === 'PATCH')
            return send(
              await files.locked(id, async () => {
                await idle(id)
                return projects.update(id, await body(req))
              }),
            )
          if (req.method === 'DELETE')
            return send(
              await files.locked(id, async () => {
                await idle(id)
                const result = await projects.remove(id, await body(req))
                const app = apps.get(id)
                if (app) {
                  await (await app).close()
                  apps.delete(id)
                } else if (runtimes.has(id)) await (await runtimes.get(id)!).close()
                runtimes.delete(id)
                return result
              }),
            )
        }
        if (suffix === '/activity' && req.method === 'GET')
          return send({ events: await store.activity(id) })
        if (suffix === '/sessions') {
          if (req.method === 'GET')
            return send({
              sessions: (await store.sessions(id)).sort((a, b) => b.updated - a.updated),
            })
          if (req.method === 'POST') {
            await files.locked(id, async () => {
              await projects.get(id, false)
              const app = await projectApp(id)
              req.url = '/api/v1/sessions'
              await new Promise<void>((resolve) => {
                res.once('finish', resolve)
                res.once('close', resolve)
                app.server.emit('request', req, res)
              })
            })
            return
          }
        }
        if (suffix === '/files' && req.method === 'GET') return send(await files.inventory(project))
        if (suffix === '/files/content' && req.method === 'GET')
          return send(await files.read(project, url.searchParams.get('path') ?? ''))
        if (
          (suffix === '/files/content' && req.method === 'PUT') ||
          (suffix === '/files' && ['POST', 'DELETE', 'PATCH'].includes(req.method ?? ''))
        ) {
          const input = await body(req)
          if (typeof input.path !== 'string')
            throw new ServiceError(400, 'A relative path is required')
          const relative = input.path
          return send(
            await files.locked(id, async () => {
              const active = await mutable(id)
              let result: unknown
              if (suffix === '/files/content') {
                if (typeof input.content !== 'string' || typeof input.expectedVersion !== 'string')
                  throw new ServiceError(400, 'Content and expectedVersion are required')
                result = await files.write(active, relative, input.content, input.expectedVersion)
              } else if (req.method === 'POST') {
                if (input.kind === 'directory') result = await files.folder(active, relative)
                else {
                  if (typeof input.content !== 'string')
                    throw new ServiceError(400, 'Text content is required')
                  result = await files.write(active, relative, input.content, null, true)
                }
              } else if (req.method === 'DELETE')
                result = await files.remove(
                  active,
                  relative,
                  String(input.expectedVersion ?? ''),
                  String(input.confirmPath ?? ''),
                )
              else {
                if (typeof input.destination !== 'string')
                  throw new ServiceError(400, 'Destination path is required')
                result = await files.move(
                  active,
                  relative,
                  input.destination,
                  String(input.expectedVersion ?? ''),
                )
              }
              await store.event(id, { type: `file.${req.method}`, path: relative })
              return result
            }),
            req.method === 'POST' ? 201 : 200,
          )
        }
        if (suffix === '/git/status' && req.method === 'GET') return send(await git.status(project))
        if (suffix === '/diff' && req.method === 'GET')
          return send(await git.diff(project, url.searchParams.get('comparison') ?? 'working'))
        const action = suffix.match(/^\/git\/(stage|unstage|revert)$/)
        if (action && req.method === 'POST') {
          const input = await body(req)
          if (typeof input.path !== 'string' || typeof input.expectedVersion !== 'string')
            throw new ServiceError(400, 'Path and expectedVersion are required')
          return send(
            await files.locked(id, async () => {
              const result = await git.action(
                await mutable(id),
                action[1],
                String(input.path),
                String(input.expectedVersion),
                typeof input.confirmPath === 'string' ? input.confirmPath : undefined,
              )
              await store.event(id, { type: `git.${action[1]}`, path: input.path })
              return result
            }),
          )
        }
      }
      const sessionRoute = pathname.match(/^\/api\/v1\/sessions\/([^/]+)(.*)$/)
      if (sessionRoute) {
        const [, sessionId, suffix] = sessionRoute
        const session = await store.session(sessionId)
        const context = url.searchParams.get('projectId') ?? req.headers['x-atlas-project-id']
        if (!session || context !== session.workspaceId)
          throw new ServiceError(404, 'Session not found in this project')
        const project = await projects.get(session.workspaceId)
        if (!suffix && req.method === 'GET') return send(session)
        if (project.status !== 'active' && req.method !== 'GET')
          throw new ServiceError(409, 'Archived project is read-only')
        if (req.method === 'POST') {
          await files.locked(project.id, async () => {
            await projects.get(project.id, false)
            if (
              suffix === '/messages' &&
              (await store.sessions(project.id)).some(
                (s) => s.id !== sessionId && ['running', 'cancelling'].includes(s.status),
              )
            )
              throw new ServiceError(
                409,
                'Another session is active in this project; finish or cancel it first',
              )
            const app = await projectApp(project.id)
            await new Promise<void>((resolve) => {
              res.once('finish', resolve)
              res.once('close', resolve)
              app.server.emit('request', req, res)
            })
          })
          return
        }
        ;(await projectApp(project.id)).server.emit('request', req, res)
        return
      }
      const workspace = pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/status$/)
      if (workspace && req.method === 'GET')
        return send(await files.inventory(await projects.get(workspace[1])))
      throw new ServiceError(404, 'Route not found')
    } catch (error) {
      const known = error instanceof ServiceError || error instanceof WorkspaceFileError
      json(
        res,
        known ? error.status : 503,
        {
          error: {
            code: error instanceof ServiceError ? error.code : 'request_failed',
            message: known
              ? error.message
              : 'Operation could not be completed. Check Atlas worker availability and request status.',
          },
        },
        requestId,
      )
    }
  }
  server.requestTimeout = 30000
  server.headersTimeout = 10000
  // Keep SDK objects behind the adapter. Project factories remain injectable for tests.
  const runtimes = new Map<string, Promise<AgentRuntime>>()
  async function projectRuntime(id: string) {
    if (!runtimes.has(id))
      runtimes.set(
        id,
        projects
          .get(id)
          .then((p) => factory(p.rootPath))
          .catch((error) => {
            runtimes.delete(id)
            throw error
          }),
      )
    return runtimes.get(id)!
  }
  return {
    server,
    store,
    projects,
    files,
    git,
    close() {
      if (closePromise) return closePromise
      closing = true
      const network = server.listening
        ? new Promise<Error | undefined>((resolve) => server.close((error) => resolve(error)))
        : Promise.resolve(undefined)
      closePromise = (async () => {
        // Drain bounded request handlers before taking the runtime ownership snapshot.
        // Long-lived SSE handlers return immediately; closing the inner apps ends their streams.
        await Promise.allSettled([...pendingHandlers])
        const owned = new Set(apps.keys()),
          tasks = [...apps.values()].map((app) => app.then((value) => value.close()))
        for (const [id, runtime] of runtimes)
          if (!owned.has(id)) tasks.push(runtime.then((value) => value.close()))
        tasks.push(catalogue.close())
        const results = await Promise.allSettled(tasks)
        const networkError = await network
        let storageError = false
        try {
          await store.close()
        } catch {
          storageError = true
        }
        if (networkError || storageError || results.some((result) => result.status === 'rejected'))
          throw new Error('Atlas shutdown was incomplete; verify local processes before restarting')
      })()
      return closePromise
    },
  }
}
