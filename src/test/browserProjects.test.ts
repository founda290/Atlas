import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { browserPath, browserProjects } from '../services/browserProjects'
afterEach(async () => {
  for (const p of await browserProjects.list())
    await browserProjects.remove(p.id, p.revision, p.name)
})
describe('real IndexedDB browser projects', () => {
  it('creates, durably reopens, edits, renames and explicitly deletes projects', async () => {
    const p = await browserProjects.create('Browser work', 'On this device')
    expect((await browserProjects.get(p.id)).name).toBe('Browser work')
    const next = await browserProjects.update(p.id, p.revision, (value) => {
      value.files.push({ path: 'src/main.ts', content: 'export const value = 1\n' })
      value.name = 'Renamed'
    })
    expect((await browserProjects.get(p.id)).files[0].content).toContain('value = 1')
    expect(next.revision).toBe(2)
    await expect(browserProjects.remove(next.id, next.revision, 'Wrong')).rejects.toThrow(
      'confirmation',
    )
    await browserProjects.remove(next.id, next.revision, 'Renamed')
    await expect(browserProjects.get(p.id)).rejects.toThrow('not found')
  })
  it('serializes competing saves and preserves the committed source on CAS conflict', async () => {
    const p = await browserProjects.create('Conflicts', '', [
      { path: 'main.ts', content: 'original' },
    ])
    const results = await Promise.allSettled([
      browserProjects.update(p.id, 1, (v) => {
        v.files[0].content = 'first'
      }),
      browserProjects.update(p.id, 1, (v) => {
        v.files[0].content = 'second'
      }),
    ])
    expect(results.filter((v) => v.status === 'fulfilled')).toHaveLength(1)
    expect((await browserProjects.get(p.id)).files[0].content).toBe('first')
  })
  it('exports and imports actual files under a fresh project identity', async () => {
    const original = await browserProjects.create('Portable', '', [
        { path: 'README.md', content: '# Real source\n' },
      ]),
      imported = await browserProjects.import(browserProjects.export(original))
    expect(imported.id).not.toBe(original.id)
    expect(imported.files).toEqual(original.files)
    await expect(browserProjects.import('{"version":99}')).rejects.toThrow('Unsupported')
  })
  it('rejects traversal/secrets, binary, oversized text, duplicates and file/folder collisions', async () => {
    for (const path of [
      '../outside',
      '/absolute',
      '.env',
      'nested/.git/config',
      'key.pem',
      'a\\b',
      'a/%2e%2e/x',
    ])
      expect(() => browserPath(path)).toThrow()
    for (const files of [
      [{ path: 'a', content: '\0' }],
      [{ path: 'a', content: 'x'.repeat(256 * 1024 + 1) }],
      [{ path: 'a', content: '\ud800' }],
      [
        { path: 'a', content: '' },
        { path: 'a/b', content: '' },
      ],
      [
        { path: 'a', content: '' },
        { path: 'a', content: '' },
      ],
    ])
      await expect(browserProjects.create('Rejected', '', files)).rejects.toThrow()
    expect(await browserProjects.list()).toEqual([])
  })
  it('aborts invalid mutations without corrupting persisted files', async () => {
    const p = await browserProjects.create('Atomic', '', [{ path: 'a.ts', content: 'safe' }])
    await expect(
      browserProjects.update(p.id, 1, (value) => {
        value.files[0].content = 'bad\0'
      }),
    ).rejects.toThrow('UTF-8')
    expect((await browserProjects.get(p.id)).files[0].content).toBe('safe')
  })
})
