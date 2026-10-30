import type { Pool } from 'pg'
import type { CloudProject, CloudRepository } from './projects.js'
function project(row: Record<string, unknown>): CloudProject {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    name: String(row.name),
    description: String(row.description),
    status: row.status as CloudProject['status'],
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }
}
// Separate schema from local single-user metadata. All resource queries include the verified owner.
export class PostgresCloudRepository implements CloudRepository {
  constructor(private pool: Pool) {}
  async list(ownerId: string) {
    const result = await this.pool.query(
      'SELECT * FROM atlas_cloud.projects WHERE owner_id=$1 ORDER BY updated_at DESC,id LIMIT 100',
      [ownerId],
    )
    return result.rows.map(project)
  }
  async get(ownerId: string, id: string) {
    const result = await this.pool.query(
      'SELECT * FROM atlas_cloud.projects WHERE owner_id=$1 AND id=$2',
      [ownerId, id],
    )
    return result.rows[0] ? project(result.rows[0]) : null
  }
  async insert(p: CloudProject) {
    await this.pool.query(
      'INSERT INTO atlas_cloud.projects (id,owner_id,name,description,status,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [p.id, p.ownerId, p.name, p.description, p.status, p.createdAt, p.updatedAt],
    )
  }
  async update(
    ownerId: string,
    id: string,
    change: Pick<CloudProject, 'name' | 'description' | 'status'>,
  ) {
    const result = await this.pool.query(
      'UPDATE atlas_cloud.projects SET name=$3,description=$4,status=$5,updated_at=$6 WHERE owner_id=$1 AND id=$2 RETURNING *',
      [ownerId, id, change.name, change.description, change.status, Date.now()],
    )
    return result.rows[0] ? project(result.rows[0]) : null
  }
}
