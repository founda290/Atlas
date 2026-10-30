// @vitest-environment node
// Deterministic test runtime only. Never imported by the frontend or production backend.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createAtlasServer } from '../src/app'
import { WorkspaceGuard, type AgentEvent, type AgentRuntime } from '../src/runtime'
class TestRuntime implements AgentRuntime {
  private next = 0
  private resolvePrompt?: () => void
  private push?: (event: AgentEvent | null) => void
  async status() {
    return { status: 'ready' as const, providers: [] }
  }
  async createSession() {
    return { id: `test-runtime-${++this.next}`, created: Date.now() }
  }
  async prompt() {
    await new Promise<void>((resolve) => {
      this.resolvePrompt = resolve
    })
    return { id: 'test-message' }
  }
  async abort() {
    return true
  }
  async messages() {
    return []
  }
  async diff() {
    return []
  }
  async *events(signal: AbortSignal) {
    while (!signal.aborted) {
      const event = await new Promise<AgentEvent | null>((resolve) => {
        this.push = resolve
        signal.addEventListener('abort', () => resolve(null), { once: true })
      })
      if (event) yield event
      else return
    }
  }
  send(event: AgentEvent) {
    this.push?.(event)
  }
  complete() {
    this.resolvePrompt?.()
  }
  async close() {
    this.push?.(null)
    this.resolvePrompt?.()
  }
}
let directory: string
let app: ReturnType<typeof createAtlasServer>
let runtime: TestRuntime
let base: string
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'atlas-test-'))
  await writeFile(path.join(directory, 'actual.ts'), 'export const test = true')
  runtime = new TestRuntime()
  app = createAtlasServer(runtime, new WorkspaceGuard(directory))
  await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve))
  const address = app.server.address()
  if (!address || typeof address === 'string') throw new Error('No test port')
  base = `http://127.0.0.1:${address.port}/api/v1`
})
afterEach(async () => {
  await app.close()
  await rm(directory, { recursive: true, force: true })
})
async function create() {
  const response = await fetch(`${base}/sessions`, {
    method: 'POST',
    body: JSON.stringify({ workspaceId: 'atlas-test-workspace' }),
  })
  expect(response.status).toBe(201)
  return (await response.json()).data as { id: string; runtimeSessionId: string }
}
describe('existing API regression coverage', () => {
  it('returns actual inventory and skips symlinks/secrets', async () => {
    await symlink(tmpdir(), path.join(directory, 'outside'))
    await writeFile(path.join(directory, '.env'), 'TEST_SECRET=never-in-inventory')
    const response = await fetch(`${base}/workspaces/atlas-test-workspace/status`)
    expect((await response.json()).data.files).toEqual([
      { path: 'actual.ts', kind: 'file', bytes: 24 },
    ])
  })
  it('creates sessions promptly without awaiting the infinite event subscription', async () => {
    const session = await create()
    expect(session.id).not.toBe(session.runtimeSessionId)
  })
  it('validates identifiers, body JSON and prompt contents', async () => {
    expect((await fetch(`${base}/sessions/invalid/messages`)).status).toBe(404)
    const session = await create()
    const url = `${base}/sessions/${session.id}/messages`
    expect((await fetch(url, { method: 'POST', body: 'bad-json' })).status).toBe(400)
    expect(
      (await fetch(url, { method: 'POST', body: JSON.stringify({ text: '  ' }) })).status,
    ).toBe(400)
  })
  it('rejects concurrent prompts and cancels through the runtime', async () => {
    const session = await create()
    const url = `${base}/sessions/${session.id}`
    expect(
      (
        await fetch(`${url}/messages`, {
          method: 'POST',
          body: JSON.stringify({ text: 'test instruction' }),
        })
      ).status,
    ).toBe(202)
    expect(
      (
        await fetch(`${url}/messages`, {
          method: 'POST',
          body: JSON.stringify({ text: 'second instruction' }),
        })
      ).status,
    ).toBe(409)
    const cancelled = await fetch(`${url}/cancel`, { method: 'POST' })
    expect((await cancelled.json()).data.status).toBe('cancelled')
    runtime.complete()
    const controller = new AbortController()
    const stream = await fetch(`${url}/events`, { signal: controller.signal })
    const reader = stream.body!.getReader()
    const first = new TextDecoder().decode((await reader.read()).value)
    expect(first).toContain('"status":"cancelled"')
    controller.abort()
    await reader.cancel().catch(() => undefined)
  })
  it('maps runtime IDs into the correct Atlas-scoped SSE stream', async () => {
    const session = await create()
    const other = await create()
    const controller = new AbortController()
    const stream = await fetch(`${base}/sessions/${session.id}/events`, {
      signal: controller.signal,
    })
    const reader = stream.body!.getReader()
    await reader.read()
    runtime.send({
      id: 'test-event',
      type: 'message.part.updated',
      sessionId: session.runtimeSessionId,
      created: 1,
      data: { part: { text: 'test-only streamed text' } },
    })
    const next = new TextDecoder().decode((await reader.read()).value)
    expect(next).toContain(session.id)
    expect(next).not.toContain(other.id)
    expect(next).toContain('test-only streamed text')
    controller.abort()
    await reader.cancel().catch(() => undefined)
  })
})
