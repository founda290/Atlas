import { DatabaseSync } from 'node:sqlite'
import { Pool } from 'pg'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import type { ProjectRow, StoredSession } from '../domain.js'

interface Sql {
  query(sql: string, args?: unknown[]): Promise<Record<string, unknown>[]>
  close(): Promise<void>
}
const migrations = [
  `CREATE TABLE IF NOT EXISTS atlas_projects (id TEXT PRIMARY KEY, name_key TEXT NOT NULL UNIQUE, payload TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS atlas_sessions (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES atlas_projects(id), payload TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS atlas_messages (session_id TEXT NOT NULL REFERENCES atlas_sessions(id), id TEXT NOT NULL, ordinal INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(session_id,id))`,
  `CREATE TABLE IF NOT EXISTS atlas_events (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES atlas_projects(id), session_id TEXT, created_at BIGINT NOT NULL, payload TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS atlas_sessions_project ON atlas_sessions(project_id)`,
  `CREATE INDEX IF NOT EXISTS atlas_events_project ON atlas_events(project_id,created_at)`,
]
export class Store {
  private constructor(
    private sql: Sql,
    readonly kind: 'sqlite' | 'postgres',
  ) {}
  static async open(directory: string, databaseUrl?: string) {
    let sql: Sql
    if (databaseUrl) {
      // Never log connection strings. TLS policy comes from the server-side connection URL.
      try {
        const url = new URL(databaseUrl)
        if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error()
      } catch {
        throw new Error('Use a valid server-side PostgreSQL connection URL')
      }
      const pool = new Pool({
        connectionString: databaseUrl,
        max: 1,
        connectionTimeoutMillis: 5000,
        statement_timeout: 10000,
      })
      const client = await pool.connect().catch(async () => {
        await pool.end()
        throw new Error(
          'Atlas PostgreSQL connection failed; verify server-side database configuration',
        )
      })
      client.on('error', () => undefined)
      sql = {
        query: async (statement, args = []) => {
          let index = 0
          return (
            await client.query(
              statement.replace(/\?/g, () => `$${++index}`),
              args,
            )
          ).rows
        },
        close: async () => {
          client.release()
          await pool.end()
        },
      }
    } else {
      await mkdir(directory, { recursive: true, mode: 0o700 })
      const db = new DatabaseSync(path.join(directory, 'atlas.sqlite'))
      db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;')
      sql = {
        query: async (statement, args = []) => {
          const prepared = db.prepare(statement)
          if (/^\s*(SELECT|PRAGMA)/i.test(statement))
            return prepared.all(...(args as (string | number | null)[])) as Record<
              string,
              unknown
            >[]
          prepared.run(...(args as (string | number | null)[]))
          return []
        },
        close: async () => db.close(),
      }
    }
    const store = new Store(sql, databaseUrl ? 'postgres' : 'sqlite')
    const migrate = !databaseUrl || process.env.ATLAS_DATABASE_MIGRATE === '1'
    try {
      if (migrate) {
        await sql.query('BEGIN')
        if (databaseUrl) await sql.query('SELECT pg_advisory_xact_lock(188800444)')
        await sql.query(
          'CREATE TABLE IF NOT EXISTS atlas_migrations (version INTEGER PRIMARY KEY, applied_at BIGINT NOT NULL)',
        )
      }
      const applied = await sql.query('SELECT version FROM atlas_migrations')
      if (applied.some((row) => Number(row.version) > 1))
        throw new Error('Database schema is newer than this Atlas version')
      if (!applied.some((row) => Number(row.version) === 1)) {
        if (!migrate) throw new Error('Run versioned migrations explicitly')
        for (const statement of migrations) await sql.query(statement)
        await sql.query(
          'INSERT INTO atlas_migrations(version,applied_at) VALUES(?,?) ON CONFLICT(version) DO NOTHING',
          [1, Date.now()],
        )
      }
      if (migrate) await sql.query('COMMIT')
      return store
    } catch {
      if (migrate) await sql.query('ROLLBACK').catch(() => undefined)
      await sql.close()
      throw new Error(
        databaseUrl
          ? 'Atlas PostgreSQL initialization failed. Verify server-only configuration and apply migrations explicitly using ATLAS_DATABASE_MIGRATE=1 against an approved database.'
          : 'Atlas local database initialization failed',
      )
    }
  }
  async healthy() {
    try {
      await this.sql.query('SELECT 1')
      return true
    } catch {
      return false
    }
  }
  async projects() {
    return this.decode<ProjectRow>(await this.sql.query('SELECT payload FROM atlas_projects'))
  }
  async project(id: string) {
    return this.decode<ProjectRow>(
      await this.sql.query('SELECT payload FROM atlas_projects WHERE id=?', [id]),
    )[0]
  }
  async saveProject(row: ProjectRow) {
    await this.sql.query(
      'INSERT INTO atlas_projects(id,name_key,payload) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name_key=excluded.name_key,payload=excluded.payload',
      [
        row.id,
        row.status === 'deleted' ? `deleted:${row.id}` : row.name.toLocaleLowerCase('en-US'),
        JSON.stringify(row),
      ],
    )
  }
  async sessions(projectId?: string) {
    return this.decode<StoredSession>(
      await this.sql.query(
        `SELECT payload FROM atlas_sessions${projectId ? ' WHERE project_id=?' : ''}`,
        projectId ? [projectId] : [],
      ),
    )
  }
  async session(id: string) {
    return this.decode<StoredSession>(
      await this.sql.query('SELECT payload FROM atlas_sessions WHERE id=?', [id]),
    )[0]
  }
  async saveSession(session: StoredSession) {
    await this.sql.query(
      'INSERT INTO atlas_sessions(id,project_id,payload) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
      [session.id, session.workspaceId, JSON.stringify(session)],
    )
  }
  private messageWrites = new Map<string, Promise<void>>()
  async saveMessages(sessionId: string, messages: unknown[]) {
    const previous = this.messageWrites.get(sessionId) ?? Promise.resolve()
    const next = previous.catch(() => undefined).then(() => this.writeMessages(sessionId, messages))
    this.messageWrites.set(sessionId, next)
    try {
      await next
    } finally {
      if (this.messageWrites.get(sessionId) === next) this.messageWrites.delete(sessionId)
    }
  }
  private async writeMessages(sessionId: string, messages: unknown[]) {
    const existing = await this.sql.query(
      'SELECT id,ordinal FROM atlas_messages WHERE session_id=?',
      [sessionId],
    )
    let nextOrdinal = existing.reduce((max, row) => Math.max(max, Number(row.ordinal) + 1), 0)
    for (const [index, item] of messages.entries()) {
      if (!item || typeof item !== 'object') continue
      const info = item as { info?: { id?: unknown }; id?: unknown }
      const id = typeof info.id === 'string' ? info.id : info.info?.id
      if (typeof id !== 'string') continue
      const ordinal =
        messages.length > 1
          ? index
          : Number(existing.find((row) => row.id === id)?.ordinal ?? nextOrdinal++)
      const payload = JSON.stringify(item)
      if (Buffer.byteLength(payload) > 1024 * 1024) continue
      await this.sql.query(
        'INSERT INTO atlas_messages(session_id,id,ordinal,payload) VALUES(?,?,?,?) ON CONFLICT(session_id,id) DO UPDATE SET payload=excluded.payload,ordinal=excluded.ordinal',
        [sessionId, id, ordinal, payload],
      )
    }
  }
  async messages(sessionId: string) {
    const rows = await this.sql.query(
      'SELECT id,payload FROM atlas_messages WHERE session_id=? ORDER BY ordinal,id',
      [sessionId],
    )
    if (rows.every((row) => /^msg_[0-9a-f]{12}[A-Za-z0-9]{14}$/.test(String(row.id))))
      rows.sort((a, b) => (String(a.id) < String(b.id) ? -1 : 1))
    return this.decode<unknown>(rows)
  }
  async event(projectId: string, event: Record<string, unknown>, sessionId?: string) {
    const id = typeof event.id === 'string' ? event.id : crypto.randomUUID()
    const created = Date.now()
    // Persist bounded event metadata, not arbitrary tool output or configuration objects.
    const data =
      event.data && typeof event.data === 'object' ? (event.data as Record<string, unknown>) : {}
    const part =
      data.part && typeof data.part === 'object' ? (data.part as Record<string, unknown>) : {}
    const state =
      part.state && typeof part.state === 'object' ? (part.state as Record<string, unknown>) : {}
    const payload = {
      id,
      type: event.type,
      created,
      sessionId,
      path: event.path,
      tool: typeof part.tool === 'string' ? part.tool.slice(0, 100) : undefined,
      toolStatus: typeof state.status === 'string' ? state.status.slice(0, 40) : undefined,
      errorCode: typeof event.errorCode === 'string' ? event.errorCode.slice(0, 100) : undefined,
    }
    await this.sql.query(
      'INSERT INTO atlas_events(id,project_id,session_id,created_at,payload) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING',
      [id, projectId, sessionId ?? null, created, JSON.stringify(payload)],
    )
    await this.sql.query(
      'DELETE FROM atlas_events WHERE project_id=? AND id NOT IN (SELECT id FROM atlas_events WHERE project_id=? ORDER BY created_at DESC,id DESC LIMIT 10000)',
      [projectId, projectId],
    )
  }
  async activity(projectId: string) {
    return this.decode<unknown>(
      await this.sql.query(
        'SELECT payload FROM atlas_events WHERE project_id=? ORDER BY created_at DESC,id DESC LIMIT 200',
        [projectId],
      ),
    )
  }
  private decode<T>(rows: Record<string, unknown>[]): T[] {
    return rows.map((row) => JSON.parse(String(row.payload)) as T)
  }
  async close() {
    await Promise.allSettled([...this.messageWrites.values()])
    await this.sql.close()
  }
}
