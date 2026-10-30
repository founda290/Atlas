import { describe, expect, it } from 'vitest'
import { buildFileTree, historyDiffs, parseDiffs, parseMessages } from '../features/workspace/data'
import { validateAccount } from '../features/auth'
import { readSessions, saveSession } from '../services/session-store'
import { WORKSPACE_ID } from '../types/api'
import { normalizeRuntimeEvent } from '../../server/src/events'
describe('account validation', () => {
  it('validates required fields, password length and acknowledgement', () => {
    const errors = validateAccount(
      { name: '', email: 'bad', password: 'short', confirm: 'other', terms: false },
      true,
    )
    expect(Object.keys(errors)).toEqual(['name', 'email', 'password', 'confirm', 'terms'])
  })
  it('accepts valid input without creating an account', () => {
    expect(
      validateAccount(
        {
          name: 'Developer',
          email: 'developer@example.com',
          password: 'long-test-password',
          confirm: 'long-test-password',
          terms: true,
        },
        true,
      ),
    ).toEqual({})
  })
  it('does not apply registration policy to existing login passwords', () => {
    expect(
      validateAccount(
        { name: '', email: 'developer@example.com', password: 'short', confirm: '', terms: false },
        false,
      ),
    ).toEqual({})
  })
})
describe('runtime message boundaries', () => {
  it('parses text and tool state without rendering unknown payloads', () => {
    expect(
      parseMessages([
        null,
        {},
        {
          info: { id: 'a', role: 'assistant' },
          parts: [
            { type: 'text', text: 'Real message' },
            { type: 'tool', tool: 'read', state: { status: 'completed' } },
          ],
        },
      ]),
    ).toEqual([{ id: 'a', role: 'assistant', text: 'Real message', tools: ['read · completed'] }])
  })
  it('accepts only complete, observed diff records', () => {
    const diff = { file: 'example.ts', before: 'old\n', after: 'new\n', additions: 1, deletions: 1 }
    expect(parseDiffs([{}, diff])).toEqual([diff])
    expect(historyDiffs([{ info: { summary: { diffs: [diff] } } }])).toEqual([diff])
  })
  it('expands the SDK global event envelope and nested session identity', () => {
    const normalized = normalizeRuntimeEvent({
      directory: '/test',
      payload: {
        type: 'message.part.updated',
        properties: { part: { sessionID: 'runtime-session', text: 'delta' } },
      },
    })
    expect(normalized.sessionId).toBe('runtime-session')
    expect(normalized.type).toBe('message.part.updated')
  })
})
describe('inventory and local session index', () => {
  it('builds and sorts a real folder tree', () => {
    const tree = buildFileTree([
      { path: 'z.ts', bytes: 5 },
      { path: 'src/b.ts', bytes: 10 },
      { path: 'src/a.ts', bytes: 2 },
    ])
    expect(tree.map((node) => node.name)).toEqual(['src', 'z.ts'])
    expect(tree[0].children.map((node) => node.name)).toEqual(['a.ts', 'b.ts'])
    expect(tree[0].children[1].bytes).toBe(10)
  })
  it('handles corrupt browser storage without demo sessions', () => {
    localStorage.setItem('atlas-session-index-v1', '{broken')
    expect(readSessions()).toEqual([])
  })
  it('indexes actual response metadata once per session', () => {
    const session = {
      id: 'real-api-id',
      runtimeSessionId: 'runtime',
      workspaceId: WORKSPACE_ID,
      title: 'API response title',
      created: 1,
      updated: 1,
      status: 'ready' as const,
    }
    saveSession(session)
    saveSession({ ...session, status: 'completed' })
    expect(readSessions()).toHaveLength(1)
    expect(readSessions()[0].status).toBe('completed')
  })
})
