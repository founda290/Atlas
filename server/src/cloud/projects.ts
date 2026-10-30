import { randomUUID } from 'node:crypto'
export type CloudStatus = 'pending' | 'provisioning' | 'ready' | 'stopped' | 'failed' | 'archived'
export interface CloudProject {
  id: string
  ownerId: string
  name: string
  description: string
  status: CloudStatus
  createdAt: number
  updatedAt: number
}
export interface CloudRepository {
  list(ownerId: string): Promise<CloudProject[]>
  insert(project: CloudProject): Promise<void>
  get(ownerId: string, id: string): Promise<CloudProject | null>
  update(
    ownerId: string,
    id: string,
    change: Pick<CloudProject, 'name' | 'description' | 'status'>,
  ): Promise<CloudProject | null>
}
export interface CloudWorker {
  // Implement with an isolated worker, never the unauthenticated local Atlas runtime.
  available: boolean
  provision(input: {
    projectId: string
    ownerId: string
    idempotencyKey: string
    networkPolicy: 'restricted'
    maxRuntimeSeconds: number
  }): Promise<void>
  stop(input: { projectId: string; ownerId: string }): Promise<void>
}
export class CloudError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}
export const cloudPolicy = Object.freeze({
  enabled: false,
  reason:
    'Cloud projects are disabled for this release. No worker is provisioned and no cloud execution is billed.',
})
export class CloudProjects {
  constructor(
    private repository: CloudRepository,
    private worker: CloudWorker,
    private enabled = false,
  ) {}
  private allow(ownerId: string) {
    if (!ownerId) throw new CloudError(401, 'sign_in_required', 'Sign in to use cloud projects.')
    if (!this.enabled || !this.worker.available)
      throw new CloudError(503, 'cloud_disabled', cloudPolicy.reason)
  }
  async list(ownerId: string) {
    this.allow(ownerId)
    return this.repository.list(ownerId)
  }
  async create(ownerId: string, name: string, description = '') {
    this.allow(ownerId)
    if (
      typeof name !== 'string' ||
      !name.trim() ||
      name.length > 80 ||
      typeof description !== 'string' ||
      description.length > 2000
    )
      throw new CloudError(
        400,
        'invalid_project',
        'Use a project name of 1–80 characters and a description of at most 2,000 characters.',
      )
    const now = Date.now(),
      project: CloudProject = {
        id: randomUUID(),
        ownerId,
        name: name.trim(),
        description,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      }
    await this.repository.insert(project)
    try {
      await this.worker.provision({
        projectId: project.id,
        ownerId,
        idempotencyKey: project.id,
        networkPolicy: 'restricted',
        maxRuntimeSeconds: 900,
      })
      return (await this.repository.update(ownerId, project.id, {
        name: project.name,
        description,
        status: 'provisioning',
      }))!
    } catch {
      await this.repository.update(ownerId, project.id, {
        name: project.name,
        description,
        status: 'failed',
      })
      throw new CloudError(
        503,
        'worker_unavailable',
        'Cloud provisioning failed. The project is marked failed; no execution success is claimed.',
      )
    }
  }
  async update(
    ownerId: string,
    id: string,
    name: string,
    description: string,
    status: 'archived' | 'stopped',
  ) {
    this.allow(ownerId)
    if (
      !['archived', 'stopped'].includes(status) ||
      typeof name !== 'string' ||
      !name.trim() ||
      name.length > 80 ||
      typeof description !== 'string' ||
      description.length > 2000
    )
      throw new CloudError(400, 'invalid_project', 'Invalid cloud project update.')
    const project = await this.repository.get(ownerId, id)
    if (!project) throw new CloudError(404, 'not_found', 'Cloud project not found.')
    // Never archive while an owned worker can still execute. Stop must be acknowledged first.
    await this.worker.stop({ ownerId, projectId: id })
    return this.repository.update(ownerId, id, { name: name.trim(), description, status })
  }
}
