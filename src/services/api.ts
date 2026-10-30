import type {
  Health,
  Session,
  WorkspaceInventory,
  SessionStatus,
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
  health: (signal?: AbortSignal) => request<Health>('/health', { signal }),
  workspace: (signal?: AbortSignal) =>
    request<WorkspaceInventory>(`/workspaces/${WORKSPACE_ID}/status`, { signal }),
  file: (path: string, signal?: AbortSignal) =>
    request<WorkspaceFileContent>(
      `/workspaces/${WORKSPACE_ID}/file?path=${encodeURIComponent(path)}`,
      { signal },
    ),
  sessionDiff: (id: string, signal?: AbortSignal) =>
    request<SessionDiffSnapshot>(`/sessions/${encodeURIComponent(id)}/diff`, { signal }),
  createSession: (title: string) =>
    request<Session>('/sessions', post({ workspaceId: WORKSPACE_ID, title })),
  history: (id: string, signal?: AbortSignal) =>
    request<{ sessionId: string; messages: unknown[] }>(
      `/sessions/${encodeURIComponent(id)}/messages`,
      { signal },
    ),
  prompt: (id: string, text: string) =>
    request<{ status: SessionStatus }>(
      `/sessions/${encodeURIComponent(id)}/messages`,
      post({ text }),
    ),
  cancel: (id: string) =>
    request<{ status: SessionStatus; cancelled: boolean }>(
      `/sessions/${encodeURIComponent(id)}/cancel`,
      post(),
    ),
}

// Integration boundaries: no speculative endpoints and no successful simulations.
export const capabilities = {
  authentication: false,
  projectCrud: false,
  fileContent: true,
  fileWrite: false,
  modelDiscovery: false,
  modelSelection: false,
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
