import { randomUUID } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'

export type JobKind = 'chat_message' | 'workspace_task' | 'security_scan'
export type JobStatus =
  'queued' | 'running' | 'cancel_requested' | 'succeeded' | 'failed' | 'cancelled' | 'interrupted'
export interface SafeJob {
  id: string
  ownerId: string
  projectId: string | null
  kind: JobKind
  status: JobStatus
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
  availableAt: string
  startedAt: string | null
  finishedAt: string | null
  attemptCount: number
}
export interface EnqueueInput {
  ownerId: string
  projectId?: string | null
  kind: JobKind
  idempotencyKey: string
  payloadCiphertext: Buffer
  payloadNonce: Buffer
  payloadAuthTag: Buffer
  payloadKeyVersion: number
  availableAt?: Date
}
export interface ClaimedJob extends SafeJob {
  payloadCiphertext: Buffer
  payloadNonce: Buffer
  payloadAuthTag: Buffer
  payloadKeyVersion: number
  leaseOwner: string
  leaseToken: string
  leaseExpiresAt: string
}
const publicColumns =
  'id,owner_id,project_id,kind,status,error_code,error_message,created_at,updated_at,available_at,started_at,finished_at,attempt_count'
function safe(row: Record<string, unknown>): SafeJob {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    kind: row.kind as JobKind,
    status: row.status as JobStatus,
    errorCode: row.error_code == null ? null : String(row.error_code),
    errorMessage: row.error_message == null ? null : String(row.error_message),
    createdAt: new Date(row.created_at as string | number | Date).toISOString(),
    updatedAt: new Date(row.updated_at as string | number | Date).toISOString(),
    availableAt: new Date(row.available_at as string | number | Date).toISOString(),
    startedAt:
      row.started_at == null
        ? null
        : new Date(row.started_at as string | number | Date).toISOString(),
    finishedAt:
      row.finished_at == null
        ? null
        : new Date(row.finished_at as string | number | Date).toISOString(),
    attemptCount: Number(row.attempt_count),
  }
}
function validateOwner(ownerId: string) {
  if (typeof ownerId !== 'string' || ownerId.length < 1 || ownerId.length > 256)
    throw new Error('Invalid owner')
}
function validateLease(leaseOwner: string, leaseToken: string) {
  if (!leaseOwner || leaseOwner.length > 128 || !leaseToken) throw new Error('Invalid lease')
}

export class CloudJobQueue {
  constructor(private readonly pool: Pool) {}

  async enqueue(input: EnqueueInput): Promise<SafeJob> {
    validateOwner(input.ownerId)
    if (!input.idempotencyKey || input.idempotencyKey.length > 256)
      throw new Error('Invalid idempotency key')
    const id = randomUUID()
    const result = await this.pool.query(
      `INSERT INTO atlas_cloud.jobs (id,owner_id,project_id,kind,status,idempotency_key,payload_ciphertext,payload_nonce,payload_auth_tag,payload_key_version,available_at)
       VALUES ($1,$2,$3,$4,'queued',$5,$6,$7,$8,$9,COALESCE($10,now()))
       ON CONFLICT (owner_id,idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key
       RETURNING ${publicColumns}`,
      [
        id,
        input.ownerId,
        input.projectId ?? null,
        input.kind,
        input.idempotencyKey,
        input.payloadCiphertext,
        input.payloadNonce,
        input.payloadAuthTag,
        input.payloadKeyVersion,
        input.availableAt ?? null,
      ],
    )
    return safe(result.rows[0]!)
  }

  async list(ownerId: string, limit = 50, offset = 0): Promise<SafeJob[]> {
    validateOwner(ownerId)
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isInteger(offset) ||
      offset < 0
    )
      throw new Error('Invalid pagination')
    const result = await this.pool.query(
      `SELECT ${publicColumns} FROM atlas_cloud.jobs WHERE owner_id=$1 ORDER BY created_at DESC,id LIMIT $2 OFFSET $3`,
      [ownerId, limit, offset],
    )
    return result.rows.map(safe)
  }

  async get(ownerId: string, id: string): Promise<SafeJob | null> {
    validateOwner(ownerId)
    const result = await this.pool.query(
      `SELECT ${publicColumns} FROM atlas_cloud.jobs WHERE owner_id=$1 AND id=$2 LIMIT 1`,
      [ownerId, id],
    )
    return result.rows[0] ? safe(result.rows[0]) : null
  }

  async claimNext(workerId: string, leaseMs = 30_000): Promise<ClaimedJob | null> {
    if (
      !workerId ||
      workerId.length > 128 ||
      !Number.isInteger(leaseMs) ||
      leaseMs < 1000 ||
      leaseMs > 3_600_000
    )
      throw new Error('Invalid claim parameters')
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `UPDATE atlas_cloud.jobs SET status='interrupted',updated_at=now(),finished_at=now(),lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL,heartbeat_at=NULL WHERE status='running' AND lease_expires_at<=now()`,
      )
      const selected = await client.query(
        `SELECT id FROM atlas_cloud.jobs WHERE status='queued' AND available_at<=now() ORDER BY available_at,created_at,id FOR UPDATE SKIP LOCKED LIMIT 1`,
      )
      if (!selected.rows[0]) {
        await client.query('COMMIT')
        return null
      }
      const token = randomUUID()
      const claimed = await client.query(
        `UPDATE atlas_cloud.jobs SET status='running',started_at=COALESCE(started_at,now()),updated_at=now(),attempt_count=attempt_count+1,lease_owner=$2,lease_token=$3,lease_expires_at=now()+($4 * interval '1 millisecond'),heartbeat_at=now() WHERE id=$1 RETURNING ${publicColumns},payload_ciphertext,payload_nonce,payload_auth_tag,payload_key_version,lease_owner,lease_token,lease_expires_at`,
        [selected.rows[0].id, workerId, token, leaseMs],
      )
      await client.query('COMMIT')
      const row = claimed.rows[0]!
      return {
        ...safe(row),
        payloadCiphertext: row.payload_ciphertext as Buffer,
        payloadNonce: row.payload_nonce as Buffer,
        payloadAuthTag: row.payload_auth_tag as Buffer,
        payloadKeyVersion: Number(row.payload_key_version),
        leaseOwner: String(row.lease_owner),
        leaseToken: String(row.lease_token),
        leaseExpiresAt: new Date(row.lease_expires_at as string | Date).toISOString(),
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async heartbeat(
    id: string,
    leaseOwner: string,
    leaseToken: string,
    leaseMs = 30_000,
  ): Promise<boolean> {
    validateLease(leaseOwner, leaseToken)
    const result = await this.pool.query(
      `UPDATE atlas_cloud.jobs SET heartbeat_at=now(),lease_expires_at=now()+($4 * interval '1 millisecond'),updated_at=now() WHERE id=$1 AND lease_owner=$2 AND lease_token=$3 AND status='running' AND lease_expires_at>now()`,
      [id, leaseOwner, leaseToken, leaseMs],
    )
    return (result.rowCount ?? 0) === 1
  }

  async complete(
    id: string,
    leaseOwner: string,
    leaseToken: string,
    resultCiphertext: Buffer,
    resultNonce: Buffer,
    resultAuthTag: Buffer,
    resultKeyVersion: number,
  ): Promise<boolean> {
    validateLease(leaseOwner, leaseToken)
    const result = await this.pool.query(
      `UPDATE atlas_cloud.jobs SET status='succeeded',result_ciphertext=$4,result_nonce=$5,result_auth_tag=$6,result_key_version=$7,updated_at=now(),finished_at=now(),lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL,heartbeat_at=NULL WHERE id=$1 AND lease_owner=$2 AND lease_token=$3 AND status='running' AND lease_expires_at>now()`,
      [id, leaseOwner, leaseToken, resultCiphertext, resultNonce, resultAuthTag, resultKeyVersion],
    )
    return (result.rowCount ?? 0) === 1
  }

  async fail(
    id: string,
    leaseOwner: string,
    leaseToken: string,
    errorCode: string,
    errorMessage: string,
  ): Promise<boolean> {
    validateLease(leaseOwner, leaseToken)
    const result = await this.pool.query(
      `UPDATE atlas_cloud.jobs SET status='failed',error_code=$4,error_message=$5,updated_at=now(),finished_at=now(),lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL,heartbeat_at=NULL WHERE id=$1 AND lease_owner=$2 AND lease_token=$3 AND status='running' AND lease_expires_at>now()`,
      [id, leaseOwner, leaseToken, errorCode.slice(0, 80), errorMessage.slice(0, 500)],
    )
    return (result.rowCount ?? 0) === 1
  }

  async cancel(ownerId: string, id: string): Promise<SafeJob | null> {
    validateOwner(ownerId)
    const result = await this.pool.query(
      `UPDATE atlas_cloud.jobs SET status=CASE WHEN status='queued' THEN 'cancelled' ELSE 'cancel_requested' END,updated_at=now(),finished_at=CASE WHEN status='queued' THEN now() ELSE finished_at END WHERE owner_id=$1 AND id=$2 AND status IN ('queued','running') RETURNING ${publicColumns}`,
      [ownerId, id],
    )
    if (result.rows[0]) return safe(result.rows[0])
    return this.get(ownerId, id)
  }
}

// Exported for deterministic protocol fakes in tests; production uses PoolClient from pg.
export type JobQueueClient = PoolClient
