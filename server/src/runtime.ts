import { realpath } from 'node:fs/promises'
import path from 'node:path'
import { normalizeRuntimeEvent } from './events.js'
import { createOpencode, type OpencodeClient } from '@opencode-ai/sdk'
import { normalizeMessages } from './messages.js'
import {
  ServiceError,
  type ModelSelection,
  type ProviderInfo,
  type RuntimeLifecycle,
} from './domain.js'

export type RuntimeStatus = 'ready' | 'unavailable' | 'error'
export type AgentEvent = {
  id: string
  type: string
  sessionId: string
  created: number
  data: Record<string, unknown>
  error?: string
}

export interface AgentRuntime {
  status(): Promise<{
    status: RuntimeStatus
    version?: string
    providers: Array<{ id: string; name: string }>
  }>
  createSession(title?: string): Promise<{ id: string; created: number }>
  prompt(
    sessionId: string,
    text: string,
    model?: ModelSelection,
    messageId?: string,
    signal?: AbortSignal,
  ): Promise<{ id: string }>
  abort(sessionId: string): Promise<boolean>
  messages(sessionId: string): Promise<unknown[]>
  diff(sessionId: string): Promise<unknown[]>
  events(signal: AbortSignal): AsyncIterable<AgentEvent>
  close(): Promise<void>
  catalogue?(): Promise<ProviderInfo[]>
  validateModel?(model: ModelSelection): Promise<void>
  reconcile?(sessionId: string): Promise<boolean>
}

export class WorkspaceGuard {
  constructor(
    private readonly configuredPath: string,
    readonly id = 'atlas-test-workspace',
  ) {}
  async root() {
    return realpath(this.configuredPath)
  }
  async assert() {
    const root = await this.root()
    return root
  }
  async safePath(relativePath: string) {
    const root = await this.root()
    const target = await realpath(path.resolve(root, relativePath))
    const relative = path.relative(root, target)
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
      throw new Error('Path escapes configured workspace')
    return target
  }
}

/** One backend-owned engine is shared by project adapters. No prompt is replayed on restart. */
export class OpenCodeEngine {
  private host?: Awaited<ReturnType<typeof createOpencode>>
  private pending?: Promise<Awaited<ReturnType<typeof createOpencode>>>
  private controller = new AbortController()
  private owners = 0
  private checkedAt = 0
  private stopped = new WeakSet<object>()
  private stop(host: Awaited<ReturnType<typeof createOpencode>>) {
    if (this.stopped.has(host)) return
    this.stopped.add(host)
    try {
      host.server.close()
    } catch {
      this.state = 'error'
      this.diagnostic = 'engine_shutdown_failed'
      throw new ServiceError(
        503,
        'The Atlas execution engine did not shut down cleanly.',
        'engine_shutdown_failed',
      )
    }
  }
  state: RuntimeLifecycle = 'stopped'
  diagnostic = ''
  acquire() {
    this.owners++
  }
  async client(): Promise<OpencodeClient> {
    if (this.host && Date.now() - this.checkedAt > 3000) {
      const probed = this.host
      try {
        const response = await fetch(`${probed.server.url}/config`, {
          signal: AbortSignal.timeout(2000),
        })
        if (!response.ok) throw new Error()
        this.checkedAt = Date.now()
      } catch {
        if (this.host === probed) {
          this.stop(probed)
          this.host = undefined
          this.state = 'degraded'
          this.diagnostic = 'engine_connection_lost'
        }
      }
    }
    if (this.host) return this.host.client
    if (this.controller.signal.aborted) this.controller = new AbortController()
    if (!this.pending) {
      this.state = 'starting'
      this.pending = createOpencode({
        hostname: '127.0.0.1',
        port: 0,
        timeout: 10000,
        signal: this.controller.signal,
      })
    }
    try {
      const host = await this.pending
      if (this.controller.signal.aborted) {
        this.stop(host)
        throw new Error('Runtime stopped during startup')
      }
      this.host = host
      this.state = 'available'
      this.diagnostic = ''
      this.checkedAt = Date.now()
      return host.client
    } catch {
      this.state = 'unavailable'
      this.diagnostic = 'engine_start_failed_check_cli_path'
      throw new ServiceError(
        503,
        'The Atlas worker could not start its model engine. Check worker availability.',
        this.diagnostic,
      )
    } finally {
      this.pending = undefined
    }
  }
  async release() {
    this.owners = Math.max(0, this.owners - 1)
    if (this.owners) return
    this.state = 'stopping'
    this.controller.abort()
    try {
      const pending = await this.pending
      if (pending) this.stop(pending)
    } catch {
      /* aborted startup */
    }
    if (this.host) this.stop(this.host)
    this.host = undefined
    this.pending = undefined
    this.state = 'stopped'
  }
  degraded(reason: string) {
    this.state = 'degraded'
    this.diagnostic = reason
  }
}
const sharedEngine = new OpenCodeEngine()
function runtimeFailure(failure: unknown): ServiceError {
  if (failure instanceof ServiceError) return failure
  const raw = failure && typeof failure === 'object' ? (failure as Record<string, unknown>) : {}
  const data = raw.data && typeof raw.data === 'object' ? (raw.data as Record<string, unknown>) : {}
  const code = data.statusCode ?? raw.status
  const name = String(raw.name ?? '')
  if (code === 401 || code === 403 || name.includes('Auth'))
    return new ServiceError(
      503,
      'Provider authentication failed. Review this provider connection in Atlas.',
      'provider_authentication',
    )
  if (code === 429)
    return new ServiceError(
      503,
      'Provider rate limit reached. You may choose another connected model using Change model, or retry later. Atlas never switches to a paid or different provider automatically.',
      'provider_rate_limit',
    )
  if (name.includes('ModelNotFound'))
    return new ServiceError(400, 'The selected model is not available.', 'model_unavailable')
  return new ServiceError(
    503,
    'The model provider request failed. Check the provider connection and worker network availability.',
    'runtime_request_failed',
  )
}
export class OpenCodeLocalRuntime implements AgentRuntime {
  private workspace: WorkspaceGuard
  private closed = false
  constructor(
    workspacePath: string,
    private engine = sharedEngine,
    private promptTimeout = 60000,
  ) {
    this.workspace = new WorkspaceGuard(workspacePath)
    engine.acquire()
  }
  private async client() {
    if (this.closed) throw new ServiceError(503, 'Runtime adapter is closed')
    return this.engine.client()
  }
  async status() {
    try {
      await this.client()
      const providers = await this.catalogue()
      return {
        status: 'ready' as const,
        state: this.engine.state,
        diagnostic: this.engine.diagnostic,
        providers: providers.filter((p) => p.connected).map((p) => ({ id: p.id, name: p.name })),
      }
    } catch {
      return {
        status: 'unavailable' as const,
        state: this.engine.state,
        diagnostic: this.engine.diagnostic,
        providers: [],
      }
    }
  }
  async catalogue(): Promise<ProviderInfo[]> {
    const client = await this.client()
    const result = await client.provider.list({
      query: { directory: await this.workspace.assert() },
      signal: AbortSignal.timeout(10000),
      throwOnError: true,
    })
    return result.data.all.map((p) => ({
      id: p.id,
      name: p.name,
      connected: result.data.connected.includes(p.id),
      authentication: result.data.connected.includes(p.id) ? 'runtime-connected' : 'not-connected',
      models: Object.values(p.models).map((m) => ({
        providerID: p.id,
        modelID: m.id,
        name: m.name,
        context: m.limit?.context,
        output: m.limit?.output,
        inputPrice: m.cost?.input,
        outputPrice: m.cost?.output,
        toolCall:
          (m as unknown as { capabilities?: { toolcall?: boolean } }).capabilities?.toolcall ??
          m.tool_call ??
          false,
        reasoning:
          (m as unknown as { capabilities?: { reasoning?: boolean } }).capabilities?.reasoning ??
          m.reasoning ??
          false,
        available:
          result.data.connected.includes(p.id) &&
          ((m as unknown as { capabilities?: { toolcall?: boolean } }).capabilities?.toolcall ??
            m.tool_call ??
            false) &&
          m.status !== 'deprecated',
      })),
    }))
  }
  async validateModel(model: ModelSelection) {
    const providers = await this.catalogue()
    if (
      !providers.some(
        (p) =>
          p.id === model.providerID &&
          p.connected &&
          p.models.some((m) => m.modelID === model.modelID && m.available),
      )
    )
      throw new ServiceError(
        400,
        'Select a connected provider and a reported tool-capable model. Connect provider credentials in OpenCode.',
        'model_unavailable',
      )
  }
  async createSession(title = 'Atlas coding session') {
    try {
      const client = await this.client()
      const result = await client.session.create({
        query: { directory: await this.workspace.assert() },
        body: { title },
        signal: AbortSignal.timeout(10000),
        throwOnError: true,
      })
      return { id: result.data.id, created: result.data.time.created }
    } catch (failure) {
      throw runtimeFailure(failure)
    }
  }
  async prompt(
    sessionId: string,
    text: string,
    model?: ModelSelection,
    messageId?: string,
    operationSignal?: AbortSignal,
  ) {
    const client = await this.client(),
      directory = await this.workspace.assert()
    if (!model) {
      const config = await client.config.get({
        query: { directory },
        signal: AbortSignal.timeout(5000),
        throwOnError: true,
      })
      const configured = config.data.model
      if (configured?.includes('/')) {
        const index = configured.indexOf('/')
        model = { providerID: configured.slice(0, index), modelID: configured.slice(index + 1) }
      } else
        throw new ServiceError(
          400,
          'No explicit model is configured. Select a connected provider/model before execution.',
          'model_required',
        )
    }
    await this.validateModel(model)
    if (operationSignal?.aborted)
      throw new ServiceError(
        409,
        'Operation was cancelled before model execution',
        'operation_cancelled',
      )
    try {
      const result = await client.session.prompt({
        path: { id: sessionId },
        query: { directory },
        body: { model, messageID: messageId, parts: [{ type: 'text', text }] },
        signal: operationSignal
          ? AbortSignal.any([operationSignal, AbortSignal.timeout(this.promptTimeout)])
          : AbortSignal.timeout(this.promptTimeout),
        throwOnError: true,
      })
      if (result.data.info.error) throw runtimeFailure(result.data.info.error)
      this.engine.state = 'available'
      this.engine.diagnostic = ''
      return { id: result.data.info.id }
    } catch (failure) {
      if (operationSignal?.aborted)
        throw new ServiceError(
          409,
          'Local request cancelled; awaiting native cancellation confirmation',
          'operation_cancelled',
        )
      if (failure instanceof Error && ['TimeoutError', 'AbortError'].includes(failure.name)) {
        let cancelled = false
        try {
          cancelled = await this.abort(sessionId)
        } catch {
          this.engine.degraded('abort_failed_after_timeout')
        }
        if (!cancelled)
          throw new ServiceError(
            503,
            'Execution timed out and native cancellation is unconfirmed. The project stays locked until runtime idle is verified.',
            'cancellation_unconfirmed',
          )
        throw new ServiceError(
          504,
          'Model execution deadline exceeded; cancellation requested. Verify provider/network access before retrying.',
          'model_timeout',
        )
      }
      const diagnostic = runtimeFailure(failure)
      this.engine.degraded(diagnostic.code)
      throw diagnostic
    }
  }
  async abort(sessionId: string) {
    const client = await this.client()
    const result = await client.session.abort({
      path: { id: sessionId },
      query: { directory: await this.workspace.assert() },
      signal: AbortSignal.timeout(5000),
      throwOnError: true,
    })
    let confirmed = Boolean(result.data)
    if (confirmed) {
      const status = await client.session.status({
        query: { directory: await this.workspace.assert() },
        signal: AbortSignal.timeout(5000),
        throwOnError: true,
      })
      confirmed = !status.data[sessionId] || status.data[sessionId].type === 'idle'
    }
    if (!confirmed) this.engine.degraded('cancellation_unconfirmed')
    return confirmed
  }
  async messages(sessionId: string) {
    const client = await this.client()
    return normalizeMessages(
      (
        await client.session.messages({
          path: { id: sessionId },
          query: { directory: await this.workspace.assert() },
          signal: AbortSignal.timeout(10000),
          throwOnError: true,
        })
      ).data,
    )
  }
  async diff(sessionId: string) {
    const client = await this.client()
    return (
      await client.session.diff({
        path: { id: sessionId },
        query: { directory: await this.workspace.assert() },
        signal: AbortSignal.timeout(10000),
        throwOnError: true,
      })
    ).data
  }
  async reconcile(sessionId: string) {
    try {
      const client = await this.client()
      await client.session.get({
        path: { id: sessionId },
        query: { directory: await this.workspace.assert() },
        signal: AbortSignal.timeout(5000),
        throwOnError: true,
      })
      const statuses = await client.session.status({
        query: { directory: await this.workspace.assert() },
        signal: AbortSignal.timeout(5000),
        throwOnError: true,
      })
      return !statuses.data[sessionId] || statuses.data[sessionId].type === 'idle'
    } catch {
      return false
    }
  }
  async *events(signal: AbortSignal) {
    const client = await this.client()
    const stream = await client.global.event({ signal, throwOnError: true })
    for await (const item of stream.stream) yield normalizeRuntimeEvent(item)
  }
  async close() {
    if (!this.closed) {
      this.closed = true
      await this.engine.release()
    }
  }
}
