import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { account, type AccountUser } from '../services/account'
interface AccountState {
  user: AccountUser | null
  loading: boolean
  error: string
  refresh: () => Promise<AccountUser | null>
  signOut: () => Promise<void>
}
const Context = createContext<AccountState | null>(null)
export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(null),
    [loading, setLoading] = useState(account.configured),
    [error, setError] = useState('')
  const generation = useRef(0)
  const refresh = useCallback(async () => {
    const current = ++generation.current
    setLoading(true)
    try {
      const value = await account.session()
      if (current === generation.current) {
        setUser(value)
        setError('')
      }
      return value
    } catch {
      if (current === generation.current) {
        setUser(null)
        setError('Account session could not be checked. Check your connection and sign in again.')
      }
      return null
    } finally {
      if (current === generation.current) setLoading(false)
    }
  }, [])
  useEffect(() => {
    void refresh()
    const update = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    const channel =
      typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('atlas-account') : null
    if (channel) channel.onmessage = () => void refresh()
    return () => {
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
      channel?.close()
    }
  }, [refresh])
  async function signOut() {
    await account.signOut()
    generation.current++
    setLoading(false)
    setUser(null)
    const channel =
      typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('atlas-account') : null
    channel?.postMessage('changed')
    channel?.close()
  }
  return (
    <Context.Provider value={{ user, loading, error, refresh, signOut }}>
      {children}
    </Context.Provider>
  )
}
export function useAccount() {
  const value = useContext(Context)
  if (!value) throw new Error('AccountProvider missing')
  return value
}
