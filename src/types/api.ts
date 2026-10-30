export const WORKSPACE_ID = 'atlas-test-workspace'
export type SessionStatus =
  'ready' | 'running' | 'cancelling' | 'completed' | 'cancelled' | 'failed'
export interface Provider {
  id: string
  name: string
}
export interface Health {
  atlas: string
  runtime: { status: 'ready' | 'unavailable' | 'error'; version?: string; providers: Provider[] }
}
export interface WorkspaceFile {
  path: string
  kind: string
  bytes?: number
}
export interface WorkspaceInventory {
  workspaceId: string
  files: WorkspaceFile[]
}
export interface Session {
  id: string
  runtimeSessionId: string
  workspaceId: string
  created: number
  status: SessionStatus
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
