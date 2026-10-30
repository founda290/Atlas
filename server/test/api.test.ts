// @vitest-environment node
// Deterministic test runtime only. Never imported by the frontend or production backend.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, symlink, writeFile, mkdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createAtlasServer } from '../src/app'
import { MAX_FILE_BYTES } from '../src/workspace-files'
import { WorkspaceGuard, type AgentEvent, type AgentRuntime } from '../src/runtime'
class TestRuntime implements AgentRuntime {
  diffEntries: unknown[] = []
  diffSessionIds: string[] = []
  failDiff = false
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
  async diff(sessionId: string) {
    this.diffSessionIds.push(sessionId)
    if (this.failDiff) throw new Error('test-only diff failure')
    return this.diffEntries
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

describe('Phase 4A bounded workspace file API', () => {
  const fileUrl = (file: string, workspace = 'atlas-test-workspace') =>
    `${base}/workspaces/${workspace}/file?path=${encodeURIComponent(file)}`
  it('returns actual source contents as a read-only UTF-8 response', async () => {
    const response = await fetch(fileUrl('actual.ts'))
    expect(response.status).toBe(200)
    expect((await response.json()).data).toEqual({
      workspaceId: 'atlas-test-workspace',
      path: 'actual.ts',
      content: 'export const test = true',
      bytes: 24,
      encoding: 'utf-8',
      readOnly: true,
    })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
  it('supports nested unicode names and empty files without substitutions', async () => {
    await mkdir(path.join(directory, 'src'))
    await writeFile(path.join(directory, 'src/hello world-λ.txt'), '')
    const response = await fetch(fileUrl('src/hello world-λ.txt'))
    expect(response.status).toBe(200)
    expect((await response.json()).data.content).toBe('')
  })
  it.each([
    '../outside.txt',
    '/etc/passwd',
    'C:\\windows\\file.txt',
    'src/../actual.ts',
    '%2e%2e/outside.txt',
    'a//b.txt',
    'actual.ts\0',
  ])('rejects unsafe path %s', async (value) => {
    const response = await fetch(fileUrl(value))
    expect(response.status).toBe(400)
    expect(JSON.stringify(await response.json())).not.toContain(directory)
  })
  it.each([
    '.env',
    '.env.example',
    '.envrc',
    '.ENV.production',
    '.git/config',
    '.aws/config',
    '.npmrc',
    'auth.json',
    'secrets.yaml',
    'private.key',
  ])('blocks sensitive path %s', async (value) => {
    const response = await fetch(fileUrl(value))
    expect(response.status).toBe(403)
    expect(JSON.stringify(await response.json())).not.toContain(directory)
  })
  it('preserves Unicode and UTF-8 BOM contents and reports byte size accurately', async () => {
    const content = '\uFEFFλ😀\n'
    await writeFile(path.join(directory, 'unicode.txt'), content)
    const data = (await (await fetch(fileUrl('unicode.txt'))).json()).data
    expect(data.content).toBe(content)
    expect(data.bytes).toBe(Buffer.byteLength(content, 'utf8'))
  })
  it('rejects symlink files and parent directories, including links inside the workspace', async () => {
    await symlink(path.join(directory, 'actual.ts'), path.join(directory, 'alias.ts'))
    await symlink(directory, path.join(directory, 'linked'))
    await symlink(tmpdir(), path.join(directory, 'escape'))
    expect((await fetch(fileUrl('alias.ts'))).status).toBe(403)
    expect((await fetch(fileUrl('escape/outside.ts'))).status).toBe(403)
    expect((await fetch(fileUrl('linked/actual.ts'))).status).toBe(403)
  })
  it('enforces the byte limit without truncating or exposing oversized content', async () => {
    await writeFile(path.join(directory, 'large.txt'), Buffer.alloc(MAX_FILE_BYTES, 65))
    expect((await fetch(fileUrl('large.txt'))).status).toBe(200)
    await writeFile(path.join(directory, 'large.txt'), Buffer.alloc(MAX_FILE_BYTES + 1, 65))
    const response = await fetch(fileUrl('large.txt'))
    expect(response.status).toBe(413)
    expect((await response.json()).data.content).toBeUndefined()
  })
  it('rejects binary, invalid UTF-8, unsupported types and directories', async () => {
    await writeFile(path.join(directory, 'binary.ts'), Buffer.from([65, 0, 66]))
    await writeFile(path.join(directory, 'invalid.ts'), Buffer.from([255]))
    await writeFile(path.join(directory, 'archive.zip'), 'not supported')
    await mkdir(path.join(directory, 'folder.ts'))
    for (const name of ['binary.ts', 'invalid.ts', 'archive.zip', 'folder.ts'])
      expect((await fetch(fileUrl(name))).status).toBe(415)
  })
  it('does not expose missing workspaces, missing files or a write operation', async () => {
    expect((await fetch(fileUrl('actual.ts', 'not-a-workspace'))).status).toBe(404)
    expect((await fetch(fileUrl('missing.ts'))).status).toBe(404)
    expect(
      (
        await fetch(fileUrl('actual.ts'), {
          method: 'POST',
          body: JSON.stringify({ content: 'changed' }),
        })
      ).status,
    ).toBe(404)
    expect(await readFile(path.join(directory, 'actual.ts'), 'utf8')).toBe(
      'export const test = true',
    )
  })
})

describe('Phase 4A on-demand session diffs', () => {
  it('uses the owning runtime session and filters unsafe or oversized diff entries', async () => {
    const session = await create()
    const safe = {
      file: 'actual.ts',
      before: 'before\n',
      after: 'after\n',
      additions: 1,
      deletions: 1,
    }
    runtime.diffEntries = [
      safe,
      { ...safe, file: '.env', after: 'not-returned-secret' },
      { ...safe, file: '../outside.ts' },
      { ...safe, file: 'large.ts', before: 'x'.repeat(MAX_FILE_BYTES + 1) },
    ]
    const response = await fetch(`${base}/sessions/${session.id}/diff`)
    expect(response.status).toBe(200)
    const result = (await response.json()).data
    expect(result.sessionId).toBe(session.id)
    expect(runtime.diffSessionIds).toEqual([session.runtimeSessionId])
    expect(result.diffs).toEqual([safe])
    expect(result.omitted).toBe(3)
    expect(result.source).toBe('opencode-session')
    expect(result.authoritativeFilesystem).toBe(false)
    expect(typeof result.fetchedAt).toBe('number')
    expect(JSON.stringify(result)).not.toContain('not-returned-secret')
  })
  it('returns an explicit empty runtime snapshot but never masks errors as no changes', async () => {
    const session = await create()
    expect((await (await fetch(`${base}/sessions/${session.id}/diff`)).json()).data.diffs).toEqual(
      [],
    )
    runtime.failDiff = true
    expect((await fetch(`${base}/sessions/${session.id}/diff`)).status).toBe(503)
    expect((await fetch(`${base}/sessions/missing-session/diff`)).status).toBe(404)
  })
})
