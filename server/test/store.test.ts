// @vitest-environment node
// PostgreSQL protocol tests only: no remote database, credentials or Neon writes.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Store } from '../src/database/store'
const fake = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
  end: vi.fn(),
  on: vi.fn(),
  connect: vi.fn(),
}))
vi.mock('pg', () => ({
  Pool: vi.fn(function () {
    return { connect: fake.connect, end: fake.end }
  }),
}))
beforeEach(() => {
  vi.stubEnv('ATLAS_DATABASE_MIGRATE', '')
  fake.query.mockResolvedValue({ rows: [{ version: 1 }] })
  fake.connect.mockResolvedValue({ query: fake.query, release: fake.release, on: fake.on })
  fake.end.mockResolvedValue(undefined)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})
describe('explicit PostgreSQL migration boundary', () => {
  it('does not execute DDL on an existing PostgreSQL database without migration opt-in', async () => {
    const store = await Store.open('/unused', 'postgres://test:fixture@localhost/test')
    expect(fake.query.mock.calls.map(([sql]) => sql)).toEqual([
      'SELECT version FROM atlas_migrations',
    ])
    await store.close()
    expect(fake.release).toHaveBeenCalledOnce()
    expect(fake.end).toHaveBeenCalledOnce()
  })
  it('fails closed on an uninitialized remote schema without leaking connection/error data', async () => {
    fake.query.mockRejectedValue(new Error('not-returned-secret'))
    await expect(Store.open('/unused', 'postgres://test:fixture@localhost/test')).rejects.toThrow(
      'apply migrations explicitly',
    )
    expect(
      fake.query.mock.calls.some(([sql]) => /CREATE|INSERT|UPDATE|DELETE/.test(String(sql))),
    ).toBe(false)
    expect(fake.release).toHaveBeenCalledOnce()
  })
  it('runs versioned migrations inside one dedicated-connection transaction and advisory lock', async () => {
    vi.stubEnv('ATLAS_DATABASE_MIGRATE', '1')
    fake.query.mockResolvedValue({ rows: [] })
    const store = await Store.open('/unused', 'postgres://test:fixture@localhost/test')
    const calls = fake.query.mock.calls.map(([sql]) => sql)
    expect(calls[0]).toBe('BEGIN')
    expect(calls[1]).toContain('pg_advisory_xact_lock')
    expect(calls.at(-1)).toBe('COMMIT')
    expect(calls.some((sql) => String(sql).includes('VALUES($1,$2)'))).toBe(true)
    expect(fake.connect).toHaveBeenCalledTimes(1)
    await store.close()
  })
  it('rolls back a migration error and rejects newer schemas rather than applying downgrades', async () => {
    vi.stubEnv('ATLAS_DATABASE_MIGRATE', '1')
    fake.query.mockImplementation(async (sql: string) => {
      if (sql === 'SELECT version FROM atlas_migrations') return { rows: [{ version: 2 }] }
      return { rows: [] }
    })
    await expect(Store.open('/unused', 'postgres://test:fixture@localhost/test')).rejects.toThrow(
      'initialization failed',
    )
    expect(fake.query).toHaveBeenLastCalledWith('ROLLBACK', [])
    expect(fake.query.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(false)
  })
})
