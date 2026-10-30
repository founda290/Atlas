import { realpath } from 'node:fs/promises'
import path from 'node:path'
import { normalizeRuntimeEvent } from './events.js'
import { createOpencode, type OpencodeClient } from '@opencode-ai/sdk'

export type RuntimeStatus = 'ready' | 'unavailable' | 'error'
export type AgentEvent = {
  id: string
  type: string
  sessionId: string
  created: number
  data: Record<string, unknown>
}

export interface AgentRuntime {
  status(): Promise<{
    status: RuntimeStatus
    version?: string
    providers: Array<{ id: string; name: string }>
  }>
  createSession(title?: string): Promise<{ id: string; created: number }>
  prompt(sessionId: string, text: string): Promise<{ id: string }>
  abort(sessionId: string): Promise<boolean>
  messages(sessionId: string): Promise<unknown[]>
  diff(sessionId: string): Promise<unknown[]>
  events(signal: AbortSignal): AsyncIterable<AgentEvent>
  close(): Promise<void>
}

export class WorkspaceGuard {
  readonly id = 'atlas-test-workspace'
  constructor(private readonly configuredPath: string) {}
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
    if (relative.startsWith('..') || path.isAbsolute(relative))
      throw new Error('Path escapes configured workspace')
    return target
  }
}

export class OpenCodeLocalRuntime implements AgentRuntime {
  private host?: { client: OpencodeClient; server: { url: string; close(): void } }
  private pending?: Promise<{ client: OpencodeClient; server: { url: string; close(): void } }>
  private readonly workspace: WorkspaceGuard
  constructor(workspacePath: string) {
    this.workspace = new WorkspaceGuard(workspacePath)
  }
  private async client() {
    if (this.host) return this.host.client
    this.pending ??= createOpencode({ hostname: '127.0.0.1', port: 0, timeout: 10000 })
    try {
      this.host = await this.pending
      return this.host.client
    } finally {
      this.pending = undefined
    }
  }
  async status() {
    try {
      const client = await this.client()
      const result = await client.config.providers({ throwOnError: true })
      return {
        status: 'ready' as const,
        providers: (result.data.providers ?? []).map((p) => ({ id: p.id, name: p.name })),
      }
    } catch {
      return { status: 'unavailable' as const, providers: [] }
    }
  }
  async createSession(title = 'Atlas local session') {
    const client = await this.client()
    const directory = await this.workspace.assert()
    const result = await client.session.create({
      query: { directory },
      body: { title },
      throwOnError: true,
    })
    return { id: result.data.id, created: result.data.time.created }
  }
  async prompt(sessionId: string, text: string) {
    const client = await this.client()
    const directory = await this.workspace.assert()
    const result = await client.session.prompt({
      path: { id: sessionId },
      query: { directory },
      body: { parts: [{ type: 'text', text }] },
      throwOnError: true,
    })
    return { id: result.data.info.id }
  }
  async abort(sessionId: string) {
    const client = await this.client()
    const directory = await this.workspace.assert()
    const result = await client.session.abort({
      path: { id: sessionId },
      query: { directory },
      throwOnError: true,
    })
    return Boolean(result.data)
  }
  async messages(sessionId: string) {
    const client = await this.client()
    const directory = await this.workspace.assert()
    const result = await client.session.messages({
      path: { id: sessionId },
      query: { directory },
      throwOnError: true,
    })
    return result.data
  }
  async diff(sessionId: string) {
    const client = await this.client()
    const directory = await this.workspace.assert()
    const result = await client.session.diff({
      path: { id: sessionId },
      query: { directory },
      throwOnError: true,
    })
    return result.data
  }
  async *events(signal: AbortSignal) {
    const client = await this.client()
    const stream = await client.global.event({ signal, throwOnError: true })
    for await (const item of stream.stream) {
      yield normalizeRuntimeEvent(item)
    }
  }
  async close() {
    this.host?.server.close()
    this.host = undefined
  }
}
