import { useCallback, useEffect } from 'react'
import { api } from '../services/api'
import { useResource } from './useResource'
export function useSessions(projectId?: string) {
  const load = useCallback(
    (signal: AbortSignal) =>
      projectId ? api.sessions(projectId, signal) : Promise.resolve({ sessions: [] }),
    [projectId],
  )
  const resource = useResource(load)
  useEffect(() => {
    window.addEventListener('atlas:sessions', resource.reload)
    return () => window.removeEventListener('atlas:sessions', resource.reload)
  }, [resource.reload])
  return resource.data?.sessions ?? []
}
