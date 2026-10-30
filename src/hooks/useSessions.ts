import { useEffect, useState } from 'react'
import { readSessions } from '../services/session-store'
export function useSessions() {
  const [sessions, setSessions] = useState(readSessions)
  useEffect(() => {
    const update = () => setSessions(readSessions())
    window.addEventListener('atlas:sessions', update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener('atlas:sessions', update)
      window.removeEventListener('storage', update)
    }
  }, [])
  return sessions
}
