// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, symlink, writeFile, readFile, link, lstat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createEngineeringServer } from '../src/engineering'
import type { AgentRuntime } from '../src/runtime'
import type { ModelSelection } from '../src/domain'
class Runtime implements AgentRuntime {
  private count = 0
  block = false
  ack = true
  closed = 0
  finish?: () => void
  rows = new Map<string, unknown[]>()
  async status() {
    return { status: 'ready' as const, providers: [{ id: 'test', name: 'Test-only provider' }] }
  }
  async catalogue() {
    return [
      {
        id: 'test',
        name: 'Test-only provider',
        connected: true,
        authentication: 'runtime-connected' as const,
        models: [
          {
            providerID: 'test',
            modelID: 'fixture',
            name: 'Test-only model',
            available: true,
            toolCall: true,
            reasoning: false,
          },
        ],
      },
    ]
  }
  async validateModel(m: ModelSelection) {
    if (m.providerID !== 'test' || m.modelID !== 'fixture') throw new Error('Test model invalid')
  }
  async createSession() {
    const id = `runtime-${++this.count}`
    this.rows.set(id, [])
    return { id, created: Date.now() }
  }
  async prompt(id: string, text: string, _model?: ModelSelection, messageId?: string) {
    if (this.block)
      await new Promise<void>((resolve) => {
        this.finish = resolve
      })
    this.rows.set(id, [
      ...(this.rows.get(id) ?? []),
      { info: { id: messageId, role: 'user' }, parts: [{ type: 'text', text }] },
      {
        info: { id: `assistant-${messageId}`, role: 'assistant' },
        parts: [{ type: 'text', text: 'Test-only response' }],
      },
    ])
    return { id: `assistant-${messageId}` }
  }
  async abort() {
    return this.ack
  }
  async messages(id: string) {
    if (!this.rows.has(id)) throw new Error('Runtime session no longer available')
    return this.rows.get(id)!
  }
  async reconcile(id: string) {
    return this.rows.has(id) && !this.block
  }
  async diff() {
    return []
  }
  async *events(signal: AbortSignal) {
    await new Promise<void>((resolve) => {
      if (signal.aborted) resolve()
      else signal.addEventListener('abort', () => resolve(), { once: true })
    })
    return
  }
  async close() {
    this.closed++
    this.finish?.()
  }
}
let factories: Runtime[] = []
let directory: string, app: Awaited<ReturnType<typeof createEngineeringServer>>, base: string
async function start() {
  app = await createEngineeringServer({
    dataDir: directory,
    runtimeFactory: () => {
      const runtime = new Runtime()
      factories.push(runtime)
      return runtime
    },
  })
  await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve))
  const address = app.server.address()
  if (!address || typeof address === 'string') throw new Error()
  base = `http://127.0.0.1:${address.port}/api/v1`
}
async function call(
  endpoint: string,
  method = 'GET',
  body?: unknown,
  headers?: Record<string, string>,
) {
  const res = await fetch(base + endpoint, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return { status: res.status, data: (await res.json()).data }
}
const project = (name = 'Engineering') =>
  call('/projects', 'POST', { name, description: 'Persistent test project', location: 'managed' })
beforeEach(async () => {
  factories = []
  directory = await mkdtemp(path.join(tmpdir(), 'atlas-engineering-'))
  await start()
})
afterEach(async () => {
  await app.close()
  await rm(directory, { recursive: true, force: true })
})
describe('managed engineering API', () => {
  it('creates real Git directories, persists project metadata and never exposes host paths', async () => {
    const p = await project()
    expect(p.status).toBe(201)
    expect(JSON.stringify(p)).not.toContain(directory)
    expect((await app.projects.get(p.data.id)).rootPath).toBe(
      path.join(directory, 'projects', p.data.id),
    )
    expect((await call(`/projects/${p.data.id}/git/status`)).data.repository).toBe(true)
    expect((await project('engineering')).status).toBe(409)
    expect((await project('../bad')).status).toBe(400)
    await app.close()
    await start()
    expect((await call('/projects')).data.projects[0].name).toBe('Engineering')
    expect(
      (await call(`/projects/${p.data.id}`, 'PATCH', { name: 'Renamed', description: 'Updated' }))
        .status,
    ).toBe(200)
    expect((await call(`/projects/${p.data.id}`, 'PATCH', { status: 'archived' })).status).toBe(200)
    expect(
      (await call(`/projects/${p.data.id}/files`, 'POST', { path: 'a.ts', content: '' })).status,
    ).not.toBe(201)
    expect((await call(`/projects/${p.data.id}`, 'PATCH', { status: 'active' })).status).toBe(200)
    expect((await call(`/projects/${p.data.id}`, 'DELETE', { confirmName: 'wrong' })).status).toBe(
      400,
    )
    expect(
      (await call(`/projects/${p.data.id}`, 'DELETE', { confirmName: 'Renamed' })).data
        .directoryRetained,
    ).toBe(true)
    expect((await call('/projects')).data.projects).toHaveLength(0)
    expect((await call(`/projects/${p.data.id}`)).status).toBe(404)
  })
  it('creates/reads/CAS-writes/renames/deletes actual files and empty folders', async () => {
    const p = (await project()).data.id,
      root = `/projects/${p}`
    expect((await call(`${root}/files`, 'POST', { path: 'src', kind: 'directory' })).status).toBe(
      201,
    )
    expect(
      (
        await call(`${root}/files`, 'POST', {
          path: 'src/main.ts',
          kind: 'file',
          content: 'export const value = 1\n',
        })
      ).status,
    ).toBe(201)
    const initial = (await call(`${root}/files/content?path=src/main.ts`)).data
    const saved = await call(`${root}/files/content`, 'PUT', {
      path: 'src/main.ts',
      content: 'export const value = 2\n',
      expectedVersion: initial.version,
    })
    expect(saved.status).toBe(200)
    expect(
      (
        await call(`${root}/files/content`, 'PUT', {
          path: 'src/main.ts',
          content: 'stale',
          expectedVersion: initial.version,
        })
      ).status,
    ).toBe(409)
    expect(await readFile(path.join(directory, 'projects', p, 'src/main.ts'), 'utf8')).toContain(
      'value = 2',
    )
    expect(
      (
        await call(`${root}/files`, 'PATCH', {
          path: 'src/main.ts',
          destination: 'src/renamed.ts',
          expectedVersion: saved.data.version,
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await call(`${root}/files`, 'DELETE', {
          path: 'src/renamed.ts',
          expectedVersion: saved.data.version,
          confirmPath: 'wrong',
        })
      ).status,
    ).toBe(400)
    expect(
      (
        await call(`${root}/files`, 'DELETE', {
          path: 'src/renamed.ts',
          expectedVersion: saved.data.version,
          confirmPath: 'src/renamed.ts',
        })
      ).status,
    ).toBe(200)
    expect(
      (await call(`${root}/files`, 'PATCH', { path: 'src', destination: 'empty' })).status,
    ).toBe(200)
    expect(
      (await call(`${root}/files`, 'DELETE', { path: 'empty', confirmPath: 'empty' })).status,
    ).toBe(200)
  })
  it('rejects traversal, secrets, symlinks, hard links, origins and unrestricted locations', async () => {
    const p = (await project()).data.id,
      root = `/projects/${p}`
    expect((await call('/projects', 'POST', { name: 'unsafe', location: '/etc' })).status).toBe(400)
    for (const file of ['../escape.ts', '/tmp/escape.ts', '.env', 'a\\b.ts', '.git/config'])
      expect(
        (await call(`${root}/files`, 'POST', { path: file, content: 'x' })).status,
      ).toBeGreaterThanOrEqual(400)
    await symlink(tmpdir(), path.join(directory, 'projects', p, 'outside'))
    expect(
      (await call(`${root}/files`, 'POST', { path: 'outside/escaped.ts', content: 'x' })).status,
    ).toBe(403)
    expect(
      (await call('/projects', 'GET', undefined, { origin: 'https://evil.example' })).status,
    ).toBe(403)
    expect(
      (await call('/projects', 'GET', undefined, { 'sec-fetch-site': 'cross-site' })).status,
    ).toBe(403)
    await writeFile(path.join(directory, 'projects', p, '.env'), 'not-returned-secret')
    expect(JSON.stringify((await call(`${root}/files`)).data)).not.toContain('.env')
  })
  it('gets authoritative Git diffs, stages/unstages and version-checks selected unstaged reverts', async () => {
    const p = (await project()).data.id,
      root = `/projects/${p}`
    await call(`${root}/files`, 'POST', { path: 'code.ts', content: 'export const value = 1\n' })
    let status = (await call(`${root}/git/status`)).data
    expect(status.files[0].status).toBe('??')
    const diff = (await call(`${root}/diff`)).data
    expect(diff.source).toBe('git')
    expect(diff.diffs[0].unified).toContain('+export const value = 1')
    expect(
      (await call(`${root}/git/stage`, 'POST', { path: 'code.ts', expectedVersion: 'stale' }))
        .status,
    ).toBe(409)
    expect(
      (
        await call(`${root}/git/stage`, 'POST', {
          path: 'code.ts',
          expectedVersion: status.files[0].version,
        })
      ).status,
    ).toBe(200)
    status = (await call(`${root}/git/status`)).data
    expect(status.files[0].status).toBe('A ')
    expect((await call(`${root}/diff?comparison=staged`)).data.diffs).toHaveLength(1)
    expect(
      (
        await call(`${root}/git/unstage`, 'POST', {
          path: 'code.ts',
          expectedVersion: status.files[0].version,
        })
      ).status,
    ).toBe(200)
    status = (await call(`${root}/git/status`)).data
    await call(`${root}/git/stage`, 'POST', {
      path: 'code.ts',
      expectedVersion: status.files[0].version,
    })
    execFileSync(
      'git',
      [
        '-C',
        path.join(directory, 'projects', p),
        '-c',
        'user.name=Atlas Tests',
        '-c',
        'user.email=tests@example.invalid',
        'commit',
        '-m',
        'Baseline',
      ],
      { stdio: 'ignore' },
    )
    const file = (await call(`${root}/files/content?path=code.ts`)).data
    await call(`${root}/files/content`, 'PUT', {
      path: 'code.ts',
      content: 'export const value = 2\n',
      expectedVersion: file.version,
    })
    status = (await call(`${root}/git/status`)).data
    expect(
      (
        await call(`${root}/git/revert`, 'POST', {
          path: 'code.ts',
          expectedVersion: status.files[0].version,
          confirmPath: 'wrong',
        })
      ).status,
    ).toBe(400)
    expect(
      (
        await call(`${root}/git/revert`, 'POST', {
          path: 'code.ts',
          expectedVersion: status.files[0].version,
          confirmPath: 'code.ts',
        })
      ).status,
    ).toBe(200)
    expect((await call(`${root}/files/content?path=code.ts`)).data.content).toContain('value = 1')
  })
  it('persists selected session models and messages and restores historical sessions without pretending to resume', async () => {
    const p = (await project()).data.id,
      other = (await project('Other')).data.id
    const created = await call(`/projects/${p}/sessions`, 'POST', {
      workspaceId: p,
      title: 'Durable session',
      model: { providerID: 'test', modelID: 'fixture' },
    })
    expect(created.status).toBe(201)
    const id = created.data.id,
      context = `?projectId=${p}`
    expect((await call(`/sessions/${id}/messages?projectId=${other}`)).status).toBe(404)
    expect((await call(`/sessions/${id}/messages`, 'POST', { text: 'no context' })).status).toBe(
      404,
    )
    expect(
      (
        await call(`/sessions/${id}/messages${context}`, 'POST', {
          text: 'Persist this instruction',
        })
      ).status,
    ).toBe(202)
    // Wait on persisted terminal status, bounded and only inside a test.
    await expect
      .poll(async () => (await call(`/projects/${p}/sessions`)).data.sessions[0].status)
      .toBe('completed')
    expect((await call(`/sessions/${id}/messages${context}`)).data.messages).toHaveLength(2)
    await app.close()
    await start()
    const history = await call(`/sessions/${id}/messages${context}`)
    expect(history.data.historical).toBe(true)
    expect(history.data.messages).toHaveLength(2)
    expect(
      (
        await call(`/sessions/${id}/messages${context}`, 'POST', {
          text: 'must not silently restart',
        })
      ).status,
    ).toBe(409)
    expect((await call(`/projects/${p}/sessions`)).data.sessions[0].model).toEqual({
      providerID: 'test',
      modelID: 'fixture',
    })
  })
  it('rejects real hardlinks, malformed UTF-8, binary/oversized content and stale deletes without changing disk', async () => {
    const p = (await project()).data.id,
      prefix = `/projects/${p}`,
      root = path.join(directory, 'projects', p)
    await writeFile(path.join(directory, 'outside.ts'), 'outside unchanged')
    await link(path.join(directory, 'outside.ts'), path.join(root, 'linked.ts'))
    expect((await call(`${prefix}/files/content?path=linked.ts`)).status).toBe(403)
    expect(
      (
        await call(`${prefix}/files/content`, 'PUT', {
          path: 'linked.ts',
          content: 'overwrite',
          expectedVersion: 'x',
        })
      ).status,
    ).toBe(403)
    expect(await readFile(path.join(directory, 'outside.ts'), 'utf8')).toBe('outside unchanged')
    for (const [file, bytes, status] of [
      ['invalid.ts', Buffer.from([255, 254]), 415],
      ['binary.ts', Buffer.from([0, 1]), 415],
      ['large.ts', Buffer.alloc(256 * 1024 + 1, 65), 413],
    ] as const) {
      await writeFile(path.join(root, file), bytes)
      expect((await call(`${prefix}/files/content?path=${file}`)).status).toBe(status)
    }
    expect(
      (await call(`${prefix}/files`, 'POST', { path: 'invalid-unicode.ts', content: '\ud800' }))
        .status,
    ).toBe(415)
    await call(`${prefix}/files`, 'POST', { path: 'normal.ts', content: 'safe' })
    expect(
      (
        await call(`${prefix}/files`, 'DELETE', {
          path: 'normal.ts',
          expectedVersion: 'stale',
          confirmPath: 'normal.ts',
        })
      ).status,
    ).toBe(409)
    expect(await readFile(path.join(root, 'normal.ts'), 'utf8')).toBe('safe')
  })
  it('bounds body/media types and refuses cross-project paths, conflicting creates, populated-folder moves and replaced project roots', async () => {
    const p = (await project()).data.id,
      prefix = `/projects/${p}`
    expect(
      (await call('/projects', 'POST', { name: 'Big', description: 'x'.repeat(2 * 1024 * 1024) }))
        .status,
    ).toBe(413)
    expect(
      (await call('/projects', 'POST', { name: 'Bad media' }, { 'content-type': 'text/plain' }))
        .status,
    ).toBe(415)
    await call(`${prefix}/files`, 'POST', { path: 'src', kind: 'directory' })
    await call(`${prefix}/files`, 'POST', { path: 'src/a.ts', content: 'first' })
    expect(
      (await call(`${prefix}/files`, 'POST', { path: 'src/a.ts', content: 'second' })).status,
    ).toBe(409)
    expect(
      (await call(`${prefix}/files`, 'PATCH', { path: 'src', destination: 'moved' })).status,
    ).toBe(409)
    expect(
      (await call(`${prefix}/files`, 'DELETE', { path: 'src', confirmPath: 'src' })).status,
    ).toBe(409)
    await rm(path.join(directory, 'projects', p), { recursive: true })
    await symlink(tmpdir(), path.join(directory, 'projects', p))
    expect((await call(`${prefix}/files`)).status).toBe(403)
  })
  it('refuses malicious Git clean filters before status can execute them and rejects metadata symlinks', async () => {
    const p = (await project()).data.id,
      prefix = `/projects/${p}`,
      root = path.join(directory, 'projects', p),
      marker = path.join(directory, 'filter-executed')
    await call(`${prefix}/files`, 'POST', { path: 'safe.ts', content: 'safe' })
    execFileSync('git', ['-C', root, '-c', 'core.hooksPath=/dev/null', 'add', '--', 'safe.ts'])
    await writeFile(path.join(root, '.gitattributes'), '*.ts filter=malicious\n')
    execFileSync('git', ['-C', root, 'config', 'filter.malicious.clean', `touch ${marker}`])
    expect((await call(`${prefix}/git/status`)).status).toBe(409)
    await expect(lstat(marker)).rejects.toMatchObject({ code: 'ENOENT' })
    execFileSync('git', ['-C', root, 'config', '--remove-section', 'filter.malicious'])
    await rm(path.join(root, '.git/config'))
    await symlink(path.join(directory, 'outside-config'), path.join(root, '.git/config'))
    expect((await call(`${prefix}/git/status`)).status).toBe(409)
  })
  it('handles unborn HEAD, staged renames, deletes and literal metacharacter names using real Git', async () => {
    const p = (await project()).data.id,
      prefix = `/projects/${p}`,
      root = path.join(directory, 'projects', p),
      file = 'literal;echo injected.ts'
    await call(`${prefix}/files`, 'POST', { path: file, content: 'export const value = 1\n' })
    let state = (await call(`${prefix}/git/status`)).data.files[0]
    await call(`${prefix}/git/stage`, 'POST', { path: file, expectedVersion: state.version })
    expect((await call(`${prefix}/diff?comparison=head`)).data.diffs).toHaveLength(1)
    execFileSync(
      'git',
      [
        '-C',
        root,
        '-c',
        'user.name=Tests',
        '-c',
        'user.email=tests@example.invalid',
        'commit',
        '-m',
        'Baseline',
      ],
      { stdio: 'ignore' },
    )
    execFileSync('git', ['-C', root, 'mv', '--', file, 'renamed.ts'])
    expect((await call(`${prefix}/diff?comparison=working`)).data.diffs).toHaveLength(0)
    const renamed = (await call(`${prefix}/diff?comparison=staged`)).data.diffs[0]
    expect(renamed.oldPath).toBe(file)
    expect(renamed.unified).toContain('rename to renamed.ts')
    expect(
      (
        await call(`${prefix}/git/unstage`, 'POST', {
          path: 'renamed.ts',
          expectedVersion: renamed.version,
        })
      ).status,
    ).toBe(200)
    expect(
      (await call(`${prefix}/git/status`)).data.files.some(
        (f: { path: string; status: string }) => f.path === file && f.status === ' D',
      ),
    ).toBe(true)
    await expect(lstat(path.join(root, 'injected.ts'))).rejects.toMatchObject({ code: 'ENOENT' })
  })
  it('allows only one coding operation per project and keeps unconfirmed cancellation locked until actual idle reconciliation', async () => {
    const p = (await project()).data.id,
      prefix = `/projects/${p}`,
      body = { workspaceId: p, title: 'Concurrency test' }
    const first = (await call(`${prefix}/sessions`, 'POST', body)).data.id,
      second = (await call(`${prefix}/sessions`, 'POST', body)).data.id
    const runtime = factories[1]
    runtime.block = true
    runtime.ack = false
    expect(
      (
        await call(`/sessions/${first}/messages?projectId=${p}`, 'POST', {
          text: 'Blocked test operation',
        })
      ).status,
    ).toBe(202)
    expect(
      (
        await call(`/sessions/${second}/messages?projectId=${p}`, 'POST', {
          text: 'Must not overlap',
        })
      ).status,
    ).toBe(409)
    expect(
      (await call(`${prefix}/files`, 'POST', { path: 'a.ts', content: 'unsafe overlap' })).status,
    ).toBe(409)
    const cancellation = await call(`/sessions/${first}/cancel?projectId=${p}`, 'POST', {})
    expect(cancellation.data.cancelled).toBe(false)
    expect(cancellation.data.status).toBe('cancelling')
    expect(
      (await call(`${prefix}/files`, 'POST', { path: 'a.ts', content: 'still locked' })).status,
    ).toBe(409)
    runtime.block = false
    runtime.finish?.()
    expect((await call(`/sessions/${first}/messages?projectId=${p}`)).data.status).toBe(
      'interrupted',
    )
    expect(
      (await call(`${prefix}/files`, 'POST', { path: 'a.ts', content: 'safe after verified idle' }))
        .status,
    ).toBe(201)
  })
  it('caches concurrently requested project adapters and closes each owned runtime exactly once', async () => {
    const p = (await project()).data.id
    await Promise.all([call(`/providers?projectId=${p}`), call(`/providers?projectId=${p}`)])
    expect(factories).toHaveLength(2)
    await call(`/projects/${p}/sessions`, 'POST', { workspaceId: p, title: 'Ownership test' })
    await app.close()
    expect(factories.map((r) => r.closed)).toEqual([1, 1])
  })
  it('restores interrupted state after restart, preserves ordered turns and records project activity', async () => {
    const p = (await project()).data.id,
      prefix = `/projects/${p}`
    const session = (
      await call(`${prefix}/sessions`, 'POST', { workspaceId: p, title: 'Ordered turns' })
    ).data.id
    for (const text of ['First instruction', 'Second instruction']) {
      await call(`/sessions/${session}/messages?projectId=${p}`, 'POST', { text })
      await expect
        .poll(async () => (await call(`${prefix}/sessions`)).data.sessions[0].status)
        .toBe('completed')
    }
    const history = (await call(`/sessions/${session}/messages?projectId=${p}`)).data.messages
    expect(history.map((m: { info: { role: string } }) => m.info.role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
    ])
    expect(history[0].parts[0].text).toBe('First instruction')
    expect(history[2].parts[0].text).toBe('Second instruction')
    const row = (await app.store.session(session))!
    row.status = 'running'
    await app.store.saveSession(row)
    await app.close()
    await start()
    expect((await call(`${prefix}/sessions`)).data.sessions[0].status).toBe('interrupted')
    expect(
      (await call(`${prefix}/activity`)).data.events.some(
        (event: { type: string }) => event.type === 'session.started',
      ),
    ).toBe(true)
  })
})
