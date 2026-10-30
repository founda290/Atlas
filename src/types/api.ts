export const WORKSPACE_ID = 'atlas-test-workspace'
export type SessionStatus =
  'interrupted' | 'ready' | 'running' | 'cancelling' | 'completed' | 'cancelled' | 'failed'
export interface Provider {
  id: string
  name: string
}
export interface Health {
  atlas: string
  runtime: {
    status: 'ready' | 'unavailable' | 'error'
    state?: string
    diagnostic?: string
    version?: string
    providers: Provider[]
  }
}
export interface WorkspaceFile {
  path: string
  kind: string
  bytes?: number
}
export interface WorkspaceInventory {
  workspaceId: string
  files: WorkspaceFile[]
  truncated?: boolean
}
export interface Session {
  id: string
  runtimeSessionId: string
  workspaceId: string
  created: number
  status: SessionStatus
  model?: ModelSelection
  resumable?: boolean
}
export interface SessionRecord extends Session {
  title: string
  updated: number
}
export interface RuntimeEvent {
  id?: string
  type: string
  sessionId: string
  created?: number
  error?: string
  data?: Record<string, unknown>
}
export interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  tools: string[]
}

export interface WorkspaceFileContent {
  workspaceId: string
  path: string
  content: string
  bytes: number
  encoding: 'utf-8'
  readOnly: true
}
export interface SessionDiffSnapshot {
  sessionId: string
  diffs: { file: string; before: string; after: string; additions: number; deletions: number }[]
  omitted: number
  source: 'opencode-session'
  authoritativeFilesystem: false
  fetchedAt: number
}

export interface Project {
  id: string
  workspaceId: string
  name: string
  description: string
  status: 'active' | 'archived' | 'deleted'
  createdAt: number
  updatedAt: number
  lastOpenedAt: number
}
export interface ModelSelection {
  providerID: string
  modelID: string
}
export interface ModelInfo extends ModelSelection {
  name: string
  available: boolean
  toolCall: boolean
  reasoning: boolean
  context?: number
  output?: number
}
export interface ProviderInfo {
  id: string
  name: string
  connected: boolean
  authentication: string
  models: ModelInfo[]
}
export interface FileContent extends Omit<WorkspaceFileContent, 'readOnly'> {
  version: string
  modifiedAt: number
  readOnly: boolean
}
export interface GitFile {
  path: string
  status: string
  oldPath?: string
  version: string
}
export interface GitStatus {
  repository: boolean
  branch: string | null
  files: GitFile[]
  omitted: number
  attribution: 'unattributed'
}
export interface GitReview extends GitStatus {
  diffs: (GitFile & {
    file: string
    before: string
    after: string
    unified: string
    additions: number
    deletions: number
  })[]
  comparison: string
  source: 'git'
  authoritativeFilesystem: true
  fetchedAt: number
}
