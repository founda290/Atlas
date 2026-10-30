import type { SessionRecord } from '../types/api'
const key = 'atlas-session-index-v1'
function isSession(item: unknown): item is SessionRecord {
  if (!item || typeof item !== 'object') return false
  const value = item as Record<string, unknown>
  return (
    typeof value.id === 'string' &&
    typeof value.runtimeSessionId === 'string' &&
    typeof value.workspaceId === 'string' &&
    typeof value.title === 'string' &&
    typeof value.created === 'number' &&
    typeof value.updated === 'number' &&
    typeof value.status === 'string' &&
    ['ready', 'running', 'cancelling', 'completed', 'cancelled', 'failed'].includes(value.status)
  )
}
export function readSessions(): SessionRecord[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(raw) ? raw.filter(isSession) : []
  } catch {
    return []
  }
}
export function saveSession(session: SessionRecord) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(
        [session, ...readSessions().filter((item) => item.id !== session.id)].slice(0, 100),
      ),
    )
  } catch {
    /* Session still exists server-side; browser indexing is optional. */
  }
  window.dispatchEvent(new Event('atlas:sessions'))
}
