import { useState, useCallback, useId } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, Button, Dialog, EmptyState, Icon, Loading } from '../components/ui'
import { useResource } from '../hooks/useResource'
import { ErrorState } from '../components/ui'
import { api } from '../services/api'
import type { SessionRecord, ModelSelection } from '../types/api'
export function dateLabel(value: number) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
export function NewSessionButton({
  label = 'New coding session',
  disabled = false,
  projectId,
}: {
  label?: string
  disabled?: boolean
  projectId: string
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [model, setModel] = useState<ModelSelection>()
  const navigate = useNavigate()
  async function create() {
    if (!title.trim()) {
      setError('Give this session a title.')
      return
    }
    setError('')
    setBusy(true)
    try {
      const created = await api.createSession(title.trim(), projectId, model)
      window.dispatchEvent(new Event('atlas:sessions'))
      setOpen(false)
      navigate(`/projects/${projectId}/sessions/${created.id}`)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Session creation failed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Button
        disabled={disabled}
        onClick={() => {
          setOpen(true)
          setError('')
        }}
      >
        <Icon name="plus" />
        {label}
      </Button>
      <Dialog
        title="Start a coding session"
        dismissible={!busy}
        open={open}
        onClose={() => {
          if (!busy) setOpen(false)
        }}
      >
        <p>
          Create a real session in this workspace. A connected model must be selected before you
          send a message.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (!busy) void create()
          }}
        >
          <div className="form-field">
            <label htmlFor="session-title">Session title</label>
            <input
              id="session-title"
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              disabled={busy}
              autoComplete="off"
              aria-describedby="session-title-hint"
            />
            <small id="session-title-hint">A short description of the work. No secrets.</small>
          </div>
          <ModelPicker projectId={projectId} onChange={setModel} />
          {error && (
            <p className="error-state" role="alert">
              {error}
            </p>
          )}
          {busy && <Loading label="Creating a session" />}
          <div className="dialog-actions">
            <Button type="submit" disabled={busy}>
              {busy ? 'Creating session…' : 'Create session'}
            </Button>
            <Button secondary onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
export function SessionList({ sessions, limit }: { sessions: SessionRecord[]; limit?: number }) {
  return (
    <>
      {sessions.length ? (
        <div className="session-list">
          {sessions.slice(0, limit).map((session) => (
            <Link
              className="session-row"
              key={session.id}
              to={`/projects/${session.workspaceId}/sessions/${session.id}`}
            >
              <span className="session-symbol" aria-hidden="true">
                ↳
              </span>
              <div>
                <strong>{session.title}</strong>
                <small>Project session · {dateLabel(session.updated)}</small>
              </div>
              <Badge>{session.status} · last known</Badge>
              <span className="sr-only">Continue session</span>
              <Icon name="arrow" />
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="No sessions in this browser">
          Create a real session to begin. Only sessions created here are indexed; backend restarts
          invalidate their Atlas IDs.
        </EmptyState>
      )}
    </>
  )
}

export function ModelPicker({
  projectId,
  onChange,
}: {
  projectId: string
  onChange: (value: ModelSelection | undefined) => void
}) {
  const load = useCallback((signal: AbortSignal) => api.providers(projectId, signal), [projectId])
  const resource = useResource(load),
    id = useId()
  const models =
    resource.data?.providers.flatMap((p) =>
      p.connected
        ? p.models
            .filter((m) => m.available && m.toolCall)
            .map((m) => ({ ...m, providerName: p.name }))
        : [],
    ) ?? []
  return (
    <div className="form-field">
      <label htmlFor={id}>Coding model</label>
      <select
        id={id}
        defaultValue=""
        onChange={(e) => {
          const selected = models.find((m) => `${m.providerID}/${m.modelID}` === e.target.value)
          onChange(
            selected ? { providerID: selected.providerID, modelID: selected.modelID } : undefined,
          )
        }}
      >
        <option value="">Select a connected model</option>
        {models.map((m) => (
          <option key={`${m.providerID}/${m.modelID}`} value={`${m.providerID}/${m.modelID}`}>
            {m.providerName} / {m.name}
          </option>
        ))}
      </select>
      {resource.loading ? (
        <Loading label="Discovering project models" />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !models.length ? (
        <p>
          No connected tool-capable models were reported by this workspace. Nothing is available to
          select yet.
        </p>
      ) : (
        <small>Runtime-reported configuration, not a credential or network test.</small>
      )}
      <button className="text-button" type="button" onClick={resource.reload}>
        Refresh models
      </button>
    </div>
  )
}
