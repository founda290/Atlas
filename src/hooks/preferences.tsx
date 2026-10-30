import { createContext, useContext, useState, type ReactNode } from 'react'
export interface Preferences {
  theme: 'dark' | 'light'
  density: 'comfortable' | 'compact'
  wrapCode: boolean
}
export const defaultPreferences: Preferences = {
  theme: 'dark',
  density: 'comfortable',
  wrapCode: true,
}
function read(): Preferences {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem('atlas-preferences-v1') ?? '{}')
    const value = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
    return {
      theme: value.theme === 'light' ? 'light' : 'dark',
      density: value.density === 'compact' ? 'compact' : 'comfortable',
      wrapCode: value.wrapCode !== false,
    }
  } catch {
    return defaultPreferences
  }
}
const Context = createContext<{
  preferences: Preferences
  save: (value: Preferences) => void
} | null>(null)
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(read)
  function save(value: Preferences) {
    localStorage.setItem('atlas-preferences-v1', JSON.stringify(value))
    setPreferences(value)
  }
  return <Context.Provider value={{ preferences, save }}>{children}</Context.Provider>
}
export function usePreferences() {
  const value = useContext(Context)
  if (!value) throw new Error('Preferences provider is missing')
  return value
}
