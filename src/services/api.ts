import type {
  Project,
  ModelSelection,
  ProviderInfo,
  FileContent,
  GitStatus,
  GitReview,
} from '../types/api'
import type {
  Health,
  Session,
  WorkspaceInventory,
  SessionStatus,
  SessionRecord,
  WorkspaceFileContent,
  SessionDiffSnapshot,
} from '../types/api'
import { WORKSPACE_ID } from '../types/api'

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api/v1${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(
      'Atlas API could not be reached. Start the local backend with npm run server:start.',
      0,
    )
  }
  let result: { data?: T & { error?: { message?: string } } }
  try {
    result = await response.json()
  } catch {
    throw new ApiError(
      'The Atlas API did not return JSON. Start the backend and use the Vite API proxy.',
      response.status,
    )
  }
  if (!response.ok || result.data?.error)
    throw new ApiError(
      result.data?.error?.message ?? `Request failed (${response.status}).`,
      response.status,
    )
  if (result.data === undefined)
    throw new ApiError('The API returned an incomplete response.', response.status)
  return result.data
}
const post = (body?: unknown): RequestInit => ({
  method: 'POST',
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})
export const api = {
  projects: (signal?: AbortSignal) => request<{ projects: Project[] }>('/projects', { signal }),
  activity: (id: string, signal?: AbortSignal) =>
    request<{
      events: { id: string; type: string; created: number; sessionId?: string; path?: string }[]
    }>(`/projects/${encodeURIComponent(id)}/activity`, { signal }),
  project: (id: string, signal?: AbortSignal) =>
    request<Project>(`/projects/${encodeURIComponent(id)}`, { signal }),
  createProject: (name: string, description: string) =>
    request<Project>('/projects', post({ name, description, location: 'managed' })),
  updateProject: (
    id: string,
    input: Partial<Pick<Project, 'name' | 'description' | 'status'>> & { open?: boolean },
  ) =>
    request<Project>(`/projects/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  deleteProject: (id: string, confirmName: string) =>
    request<{ deleted: boolean; directoryRetained: boolean }>(
      `/projects/${encodeURIComponent(id)}`,
      { method: 'DELETE', body: JSON.stringify({ confirmName }) },
    ),
  sessions: (projectId: string, signal?: AbortSignal) =>
    request<{ sessions: SessionRecord[] }>(`/projects/${encodeURIComponent(projectId)}/sessions`, {
      signal,
    }),
  providers: (projectId?: string, signal?: AbortSignal) =>
    request<{ providers: ProviderInfo[] }>(
      `/providers${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`,
      { signal },
    ),
  readFile: (id: string, path: string, signal?: AbortSignal) =>
    request<FileContent>(
      `/projects/${encodeURIComponent(id)}/files/content?path=${encodeURIComponent(path)}`,
      { signal },
    ),
  writeFile: (id: string, path: string, content: string, expectedVersion: string) =>
    request<FileContent>(`/projects/${encodeURIComponent(id)}/files/content`, {
      method: 'PUT',
      body: JSON.stringify({ path, content, expectedVersion }),
    }),
  createFile: (id: string, path: string, kind: 'file' | 'directory', content = '') =>
    request<unknown>(`/projects/${encodeURIComponent(id)}/files`, post({ path, kind, content })),
  renameFile: (id: string, path: string, destination: string, expectedVersion: string) =>
    request<unknown>(`/projects/${encodeURIComponent(id)}/files`, {
      method: 'PATCH',
      body: JSON.stringify({ path, destination, expectedVersion }),
    }),
  deleteFile: (id: string, path: string, expectedVersion: string, confirmPath: string) =>
    request<unknown>(`/projects/${encodeURIComponent(id)}/files`, {
      method: 'DELETE',
      body: JSON.stringify({ path, expectedVersion, confirmPath }),
    }),
  gitStatus: (id: string, signal?: AbortSignal) =>
    request<GitStatus>(`/projects/${encodeURIComponent(id)}/git/status`, { signal }),
  gitDiff: (id: string, comparison: string, signal?: AbortSignal) =>
    request<GitReview>(`/projects/${encodeURIComponent(id)}/diff?comparison=${comparison}`, {
      signal,
    }),
  gitAction: (
    id: string,
    action: 'stage' | 'unstage' | 'revert',
    path: string,
    expectedVersion: string,
    confirmPath?: string,
  ) =>
    request<GitStatus>(
      `/projects/${encodeURIComponent(id)}/git/${action}`,
      post({ path, expectedVersion, confirmPath }),
    ),
  setModel: (id: string, projectId: string, model: ModelSelection) =>
    request<{ model: ModelSelection }>(
      `/sessions/${encodeURIComponent(id)}/model?projectId=${encodeURIComponent(projectId)}`,
      post(model),
    ),
  health: (signal?: AbortSignal) => request<Health>('/health', { signal }),
  workspace: (signal?: AbortSignal, projectId = WORKSPACE_ID) =>
    request<WorkspaceInventory>(`/workspaces/${encodeURIComponent(projectId)}/status`, { signal }),
  file: (path: string, signal?: AbortSignal) =>
    request<WorkspaceFileContent>(
      `/workspaces/${WORKSPACE_ID}/file?path=${encodeURIComponent(path)}`,
      { signal },
    ),
  sessionDiff: (id: string, signal?: AbortSignal) =>
    request<SessionDiffSnapshot>(`/sessions/${encodeURIComponent(id)}/diff`, { signal }),
  createSession: (title: string, projectId = WORKSPACE_ID, model?: ModelSelection) =>
    request<Session>(
      projectId === WORKSPACE_ID
        ? '/sessions'
        : `/projects/${encodeURIComponent(projectId)}/sessions`,
      post({ workspaceId: projectId, title, model }),
    ),
  history: (id: string, signal?: AbortSignal, projectId?: string) =>
    request<{
      sessionId: string
      messages: unknown[]
      error?: string
      errorCode?: string
      historical?: boolean
      resumable?: boolean
      status?: SessionStatus
    }>(
      `/sessions/${encodeURIComponent(id)}/messages${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`,
      { signal },
    ),
  prompt: (id: string, text: string, projectId?: string) =>
    request<{ status: SessionStatus }>(
      `/sessions/${encodeURIComponent(id)}/messages${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`,
      post({ text }),
    ),
  cancel: (id: string, projectId?: string) =>
    request<{ status: SessionStatus; cancelled: boolean }>(
      `/sessions/${encodeURIComponent(id)}/cancel${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`,
      post(),
    ),
}

// Integration boundaries: no speculative endpoints and no successful simulations.
export const capabilities = {
  authentication: false,
  projectCrud: true,
  fileContent: true,
  fileWrite: true,
  modelDiscovery: true,
  modelSelection: true,
  diff: true,
  terminalStream: false,
} as const
export async function authenticate(): Promise<never> {
  throw new Error(
    'Account authentication is not enabled in this local preview. No credentials were sent or stored. You can open the local workspace without an account.',
  )
}
export async function register(): Promise<never> {
  throw new Error(
    'Account creation is not enabled. No account was created and no credentials were sent or stored.',
  )
}
