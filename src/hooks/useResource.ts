import { useCallback, useEffect, useState } from 'react'

export function useResource<T>(loader: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<{ data?: T; loading: boolean; error: string }>({
    loading: true,
    error: '',
  })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setState((current) => ({ ...current, loading: true, error: '' }))
    loader(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, loading: false, error: '' })
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState((current) => ({
            ...current,
            loading: false,
            error: error instanceof Error ? error.message : 'The request failed.',
          }))
      })
    return () => controller.abort()
  }, [loader, attempt])
  return { ...state, reload: useCallback(() => setAttempt((value) => value + 1), []) }
}
