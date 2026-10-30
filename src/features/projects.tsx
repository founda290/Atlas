import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, Button, Dialog, EmptyState, Icon, Loading } from '../components/ui'
import { api } from '../services/api'
import { saveSession } from '../services/session-store'
import type { SessionRecord } from '../types/api'
import { WORKSPACE_ID } from '../types/api'
export function dateLabel(value: number) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
export function ProjectLimitDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="One workspace, for now">
      <p>
        The current backend exposes one dedicated local workspace. Project creation, rename and
        deletion are not implemented; no project has been created.
      </p>
      <p>
        To use a different directory, configure <code>ATLAS_TEST_WORKSPACE</code> before starting
        the backend. This requires a restart and clears the in-memory session mappings.
      </p>
      <div className="dialog-actions">
        <Button href="/docs/projects">Workspace setup guide</Button>
        <Button secondary onClick={onClose}>
          Keep exploring
        </Button>
      </div>
    </Dialog>
  )
}
export function NewSessionButton({
  label = 'New coding session',
  disabled = false,
}: {
  label?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  async function create() {
    if (!title.trim()) {
      setError('Give this session a title.')
      return
    }
    setError('')
    setBusy(true)
    try {
      const created = await api.createSession(title.trim())
      saveSession({ ...created, title: title.trim(), updated: created.created })
      setOpen(false)
      navigate(`/projects/${WORKSPACE_ID}/sessions/${created.id}`)
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
          Create a real session in the local workspace. OpenCode and a configured provider must be
          available.
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
          {error && (
            <p className="error-state" role="alert">
              {error}
            </p>
          )}
          {busy && <Loading label="Creating a session with the local runtime" />}
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
                <small>Local test workspace · {dateLabel(session.updated)}</small>
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
