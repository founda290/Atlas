export type RuntimeLifecycle =
  'stopped' | 'starting' | 'available' | 'unavailable' | 'degraded' | 'stopping' | 'error'
export interface ModelSelection {
  providerID: string
  modelID: string
}
export interface ModelInfo extends ModelSelection {
  name: string
  context?: number
  output?: number
  toolCall: boolean
  reasoning: boolean
  available: boolean
}
export interface ProviderInfo {
  id: string
  name: string
  connected: boolean
  authentication: 'runtime-connected' | 'not-connected'
  models: ModelInfo[]
}
export interface Project {
  id: string
  name: string
  description: string
  workspaceId: string
  createdAt: number
  updatedAt: number
  lastOpenedAt: number
  status: 'active' | 'archived' | 'deleted'
}
export interface ProjectRow extends Project {
  rootPath: string
}
export interface StoredSession {
  id: string
  runtimeSessionId: string
  workspaceId: string
  title: string
  status: string
  created: number
  updated: number
  model?: ModelSelection
  resumable?: boolean
  lastError?: { code: string; message: string }
}
export interface PublicFile {
  path: string
  kind: 'file' | 'directory'
  bytes: number
  modifiedAt: number
}
export class ServiceError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'request_failed',
  ) {
    super(message)
  }
}
export function text(value: unknown, name: string, max: number, optional = false) {
  if (optional && value === undefined) return ''
  if (
    typeof value !== 'string' ||
    (!optional && !value.trim()) ||
    value.length > max ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)
  )
    throw new ServiceError(400, `Invalid ${name}`)
  return value.trim()
}
export function publicProject(row: ProjectRow): Project {
  return {
    id: row.id,
    workspaceId: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastOpenedAt: row.lastOpenedAt,
  }
}
