import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, ErrorState, Loading, Tabs } from '../components/ui'
import { Activity } from '../features/workspace/Activity'
import { SessionChanges } from '../features/workspace/SessionChanges'
import { Conversation } from '../features/workspace/Conversation'
import { FileDetails, FileExplorer } from '../features/workspace/FileExplorer'
import { EditorEmpty } from '../features/workspace/WorkspaceStates'
import { NewSessionButton } from '../features/projects'
import { usePreferences } from '../hooks/preferences'
import { useAgentSession } from '../hooks/useAgentSession'
import { useResource } from '../hooks/useResource'
import { useSessions } from '../hooks/useSessions'
import { api } from '../services/api'
import { WORKSPACE_ID } from '../types/api'
import { MissingProject } from './ProjectPages'
const loadWorkspace = (signal: AbortSignal) => api.workspace(signal)
export function WorkspacePage() {
  const { projectId, sessionId } = useParams()
  if (projectId !== WORKSPACE_ID) return <MissingProject />
  if (!sessionId || !/^[A-Za-z0-9_-]{8,120}$/.test(sessionId))
    return (
      <div className="app-page-body">
        <ErrorState message="This session identifier is invalid." />
        <Button href={`/projects/${WORKSPACE_ID}`} secondary>
          Back to project
        </Button>
      </div>
    )
  return <SessionWorkspace key={sessionId} sessionId={sessionId} />
}
function SessionWorkspace({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate()
  const { preferences } = usePreferences()
  const session = useAgentSession(sessionId)
  const workspace = useResource(loadWorkspace)
  const records = useSessions().filter((record) => record.workspaceId === WORKSPACE_ID)
  const record = records.find((item) => item.id === sessionId)
  const [view, setView] = useState<'agent' | 'files' | 'activity' | 'changes'>('agent')
  const [selected, setSelected] = useState('')
  const statusLabel = !session.history.data
    ? session.history.loading
      ? 'Checking session'
      : 'Session unavailable'
    : session.stream === 'connected'
      ? session.status
      : 'Status unverified'
  const file = workspace.data?.files.find((item) => item.path === selected)
  useEffect(() => {
    if (session.revision) workspace.reload()
  }, [session.revision, workspace.reload])
  return (
    <div className={`coding-workspace workspace-view-${view}`}>
      <header className="workspace-project-header">
        <div>
          <nav aria-label="Breadcrumb">
            <Link to="/projects">Projects</Link>
            <span aria-hidden="true">/</span>
            <Link to={`/projects/${WORKSPACE_ID}`}>Local test workspace</Link>
          </nav>
          <h1>{record?.title ?? 'Coding session'}</h1>
          <code>{sessionId}</code>
        </div>
        <div className="workspace-header-actions">
          <Badge
            tone={
              session.status === 'failed'
                ? 'warning'
                : session.status === 'running'
                  ? 'success'
                  : 'neutral'
            }
          >
            {statusLabel}
          </Badge>
          <NewSessionButton label="New session" />
        </div>
      </header>
      <div className="workspace-navigation">
        <Tabs
          label="Workspace panels"
          value={view}
          onChange={setView}
          items={[
            { id: 'agent', label: 'Agent' },
            { id: 'files', label: 'Files' },
            { id: 'activity', label: 'Activity' },
            { id: 'changes', label: 'Changes' },
          ]}
        />
        <div className="session-switcher">
          <label htmlFor="session-switcher" className="sr-only">
            Session history
          </label>
          <select
            id="session-switcher"
            value={sessionId}
            onChange={(event) => {
              navigate(
                `/projects/${WORKSPACE_ID}/sessions/${encodeURIComponent(event.target.value)}`,
              )
            }}
          >
            <option value={sessionId}>{record?.title ?? 'Current session'}</option>
            {records
              .filter((item) => item.id !== sessionId)
              .map((item) => (
                <option value={item.id} key={item.id}>
                  {item.title}
                </option>
              ))}
          </select>
        </div>
      </div>
      {session.history.loading && !session.history.data ? (
        <Loading label="Loading session history" />
      ) : session.history.error && !session.history.data ? (
        <div className="workspace-failure">
          <ErrorState message={session.history.error} retry={session.history.reload} />
          <p>
            The session may have disappeared after a backend restart. Atlas does not substitute
            another session.
          </p>
          <Button href={`/projects/${WORKSPACE_ID}`} secondary>
            Return to project
          </Button>
        </div>
      ) : (
        <>
          <div className="stream-status" role="status">
            <span className={`stream-dot ${session.stream}`} aria-hidden="true" />
            {session.stream === 'connected'
              ? 'Event stream connected'
              : session.stream === 'reconnecting'
                ? 'Event stream disconnected. Reconnecting; missed activity cannot be replayed.'
                : 'Connecting to session events…'}
            <button type="button" className="text-button" onClick={session.history.reload}>
              Refresh messages
            </button>
          </div>
          {session.error && (
            <div className="error-state" role="alert">
              {session.error}
            </div>
          )}
          {session.history.error && (
            <ErrorState message={session.history.error} retry={session.history.reload} />
          )}
          <div className="live-workbench">
            <aside className="workspace-explorer">
              {workspace.loading ? (
                <Loading label="Loading file inventory" />
              ) : workspace.error ? (
                <ErrorState message={workspace.error} retry={workspace.reload} />
              ) : (
                <FileExplorer
                  files={workspace.data?.files ?? []}
                  selected={selected}
                  select={(path) => setSelected(path)}
                  refresh={workspace.reload}
                />
              )}
            </aside>
            <section
              className={`workspace-editor ${preferences.wrapCode ? 'wrap-code' : ''}`}
              aria-label="Read-only file viewer"
            >
              <div className="workbench-panel-header">
                <h2>{file ? file.path.split('/').pop() : 'File details'}</h2>
                <Badge>Read-only</Badge>
              </div>
              {file ? <FileDetails file={file} revision={session.revision} /> : <EditorEmpty />}
            </section>
            <div className="workspace-agent">
              <Conversation
                messages={session.messages}
                busy={session.busy}
                cancelling={session.status === 'cancelling'}
                connected={session.stream === 'connected'}
                send={session.send}
                cancel={session.cancel}
              />
            </div>
            <div className="workspace-activity">
              <Activity events={session.events} />
            </div>
            <div className="workspace-changes">
              <SessionChanges
                key={sessionId}
                sessionId={sessionId}
                active={view === 'changes'}
                revision={session.revision}
              />
            </div>
          </div>
        </>
      )}
      <footer className="workspace-statusbar">
        <span>OpenCode / local execution</span>
        <span>Workspace: {WORKSPACE_ID}</span>
        <Link to="/docs/security">Not a sandbox ↗</Link>
      </footer>
    </div>
  )
}
