import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../services/api'
import {
  asRecord,
  asString,
  historyDiffs,
  parseDiffs,
  parseMessages,
  type ObservedDiff,
} from '../features/workspace/data'
import type { Message, RuntimeEvent, SessionStatus } from '../types/api'
import { useResource } from './useResource'
const statuses: SessionStatus[] = [
  'interrupted',
  'ready',
  'running',
  'cancelling',
  'completed',
  'cancelled',
  'failed',
]
export function useAgentSession(id: string, projectId?: string) {
  const loader = useCallback(
    (signal: AbortSignal) => api.history(id, signal, projectId),
    [id, projectId],
  )
  const history = useResource(loader)
  const [messages, setMessages] = useState<Message[]>([])
  const [events, setEvents] = useState<RuntimeEvent[]>([])
  const [diffs, setDiffs] = useState<ObservedDiff[]>([])
  const [status, setStatus] = useState<SessionStatus>('ready')
  const [stream, setStream] = useState<'connecting' | 'connected' | 'reconnecting'>('connecting')
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [revision, setRevision] = useState(0)
  const partText = useRef(new Map<string, { messageId: string; text: string }>())
  const partKinds = useRef(new Map<string, string>())
  const roles = useRef(new Map<string, 'user' | 'assistant'>())
  const valid = !!history.data && history.data.resumable !== false
  const busy = status === 'running' || status === 'cancelling' || submitting
  const setKnownStatus = useCallback((next: SessionStatus) => {
    setStatus(next)
  }, [])
  useEffect(() => {
    setMessages([])
    setEvents([])
    setDiffs([])
    setError('')
    setErrorCode('')
    setStatus('ready')
    setStream('connecting')
    partText.current.clear()
    partKinds.current.clear()
    roles.current.clear()
  }, [id, projectId])
  useEffect(() => {
    if (!history.data) return
    if (history.data.error) setError(history.data.error)
    if (history.data.errorCode) setErrorCode(history.data.errorCode)
    if (history.data.status) setKnownStatus(history.data.status)
    const historyMessages = history.data.messages
    const parsed = parseMessages(historyMessages)
    setMessages(parsed)
    parsed.forEach((message) => roles.current.set(message.id, message.role))
    setDiffs((current) => {
      const fromHistory = historyDiffs(historyMessages)
      return fromHistory.length ? fromHistory : current
    })
  }, [history.data, setKnownStatus])
  useEffect(() => {
    if (!valid) return
    const source = new EventSource(
      `/api/v1/sessions/${encodeURIComponent(id)}/events${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`,
    )
    const seen = new Set<string>()
    const connected = (event: MessageEvent) => {
      setStream('connected')
      try {
        const data = asRecord(JSON.parse(event.data))
        if (statuses.includes(data.status as SessionStatus))
          setKnownStatus(data.status as SessionStatus)
      } catch {
        setError('The event stream sent an unreadable status.')
      }
      history.reload()
    }
    const receive = (event: MessageEvent) => {
      try {
        const raw = asRecord(JSON.parse(event.data))
        if (typeof raw.sessionId === 'string' && raw.sessionId !== id) return
        if (event.lastEventId && seen.has(event.lastEventId)) return
        if (event.lastEventId) {
          seen.add(event.lastEventId)
          if (seen.size > 2000) seen.delete(seen.values().next().value!)
        }
        const type = asString(raw.type) || event.type
        const data = asRecord(raw.data)
        const item: RuntimeEvent = {
          id: event.lastEventId || undefined,
          type,
          sessionId: id,
          created: typeof raw.created === 'number' ? raw.created : Date.now(),
          error: asString(raw.error),
          data,
        }
        setEvents((current) => [...current.slice(-199), item])
        if (type === 'message.updated') {
          const info = asRecord(data.info)
          if (typeof info.id === 'string' && (info.role === 'user' || info.role === 'assistant')) {
            const role = info.role
            roles.current.set(info.id, role)
            setMessages((current) =>
              current.map((message) => (message.id === info.id ? { ...message, role } : message)),
            )
          }
        }
        if (type === 'session.error') {
          setErrorCode(asString(raw.errorCode))
          setError(
            asString(raw.error) || 'Runtime execution error; check local provider configuration.',
          )
        }
        if (type === 'message.part.updated') {
          const part = asRecord(data.part)
          if (typeof part.id === 'string' && typeof part.type === 'string')
            partKinds.current.set(part.id, part.type)
        }
        if (
          type === 'message.part.updated' ||
          (type === 'message.part.delta' &&
            data.field === 'text' &&
            partKinds.current.get(asString(data.partID)) === 'text')
        ) {
          const part =
            type === 'message.part.delta'
              ? {
                  type: 'text',
                  messageID: data.messageID,
                  id: data.partID,
                  text:
                    (partText.current.get(asString(data.partID))?.text ?? '') +
                    asString(data.delta),
                }
              : asRecord(data.part)
          const messageId = asString(part.messageID)
          const partId = asString(part.id)
          if (messageId && partId && part.type === 'text') {
            partText.current.set(partId, { messageId, text: asString(part.text) })
            const text = [...partText.current.values()]
              .filter((value) => value.messageId === messageId)
              .map((value) => value.text)
              .join('\n')
            setMessages((current) => {
              const existing = current.find((message) => message.id === messageId)
              return existing
                ? current.map((message) =>
                    message.id === messageId ? { ...message, text } : message,
                  )
                : [
                    ...current,
                    {
                      id: messageId,
                      role: roles.current.get(messageId) ?? 'assistant',
                      text,
                      tools: [],
                    },
                  ]
            })
          }
        }
        if (type === 'session.diff') setDiffs(parseDiffs(data.diff))
        if (type === 'session.started') setKnownStatus('running')
        const terminal: Record<string, SessionStatus> = {
          'session.completed': 'completed',
          'session.failed': 'failed',
          'session.cancelled': 'cancelled',
        }
        if (terminal[type]) {
          setKnownStatus(terminal[type])
          setRevision((value) => value + 1)
          history.reload()
          if (type === 'session.failed') {
            setErrorCode(asString(raw.errorCode))
            setError(
              asString(raw.error) ||
                'The model operation failed. No successful response was returned.',
            )
          }
        }
      } catch {
        setError('An unreadable runtime event was received. Refresh message history to recover.')
      }
    }
    source.addEventListener('connected', connected)
    const types = [
      'session.started',
      'session.completed',
      'session.failed',
      'session.cancelled',
      'message.updated',
      'message.part.updated',
      'message.part.delta',
      'message.delta',
      'message.completed',
      'tool.started',
      'tool.completed',
      'tool.failed',
      'workspace.changed',
      'session.diff',
      'session.error',
      'session.status',
      'session.idle',
      'permission.updated',
    ]
    types.forEach((type) => source.addEventListener(type, receive))
    source.onerror = () => setStream('reconnecting')
    return () => source.close()
  }, [id, projectId, valid, history.reload, setKnownStatus])
  async function send(text: string) {
    if (busy || !text.trim() || history.data?.resumable === false) return false
    if (text.length > 20_000) {
      setError('Instructions must be under 20,000 characters.')
      return false
    }
    setSubmitting(true)
    setError('')
    setErrorCode('')
    try {
      const result = await api.prompt(id, text.trim(), projectId)
      setKnownStatus(result.status)
      return true
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Instruction submission failed.')
      return false
    } finally {
      setSubmitting(false)
    }
  }
  async function cancel() {
    setError('')
    try {
      const result = await api.cancel(id, projectId)
      setKnownStatus(result.status)
      history.reload()
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Cancellation failed. The operation may still be running.',
      )
    }
  }
  return { messages, events, diffs, status, stream, busy, send, cancel, error, errorCode, history, revision }
}
