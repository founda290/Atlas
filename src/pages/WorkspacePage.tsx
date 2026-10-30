import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, ErrorState, Loading, Tabs } from '../components/ui'
import { Activity } from '../features/workspace/Activity'
import { GitChanges } from '../features/workspace/GitChanges'
import { FileEditor } from '../features/workspace/FileEditor'
import { Conversation } from '../features/workspace/Conversation'
import { FileExplorer } from '../features/workspace/FileExplorer'
import { NewSessionButton, ModelPicker } from '../features/projects'
import { usePreferences } from '../hooks/preferences'
import { useAgentSession } from '../hooks/useAgentSession'
import { useResource } from '../hooks/useResource'
import { useSessions } from '../hooks/useSessions'
import { api } from '../services/api'
import type { ModelSelection } from '../types/api'
import { MissingProject } from './ProjectPages'
export function WorkspacePage() {
  const { projectId, sessionId } = useParams()
  if (!projectId) return <MissingProject />
  if (!sessionId || !/^[A-Za-z0-9_-]{8,120}$/.test(sessionId))
    return (
      <div className="app-page-body">
        <ErrorState message="This session identifier is invalid." />
        <Button href={`/projects/${projectId}`} secondary>
          Back to project
        </Button>
      </div>
    )
  return (
    <SessionWorkspace
      key={`${projectId}:${sessionId}`}
      sessionId={sessionId}
      projectId={projectId}
    />
  )
}
function SessionWorkspace({ sessionId, projectId }: { sessionId: string; projectId: string }) {
  const navigate = useNavigate()
  const { preferences } = usePreferences()
  const session = useAgentSession(sessionId, projectId)
  const loadWorkspace = useCallback(
    (signal: AbortSignal) => api.workspace(signal, projectId),
    [projectId],
  )
  const workspace = useResource(loadWorkspace)
  const records = useSessions(projectId)
  const record = records.find((item) => item.id === sessionId)
  const [view, setView] = useState<'agent' | 'files' | 'activity' | 'changes'>('agent')
  const [selected, setSelected] = useState('')
  const [fileRevision, setFileRevision] = useState(0)
  const refreshFiles = () => {
    workspace.reload()
    setFileRevision((r) => r + 1)
  }
  const [selectionRevision, setSelectionRevision] = useState(0)
  const [pendingModel, setPendingModel] = useState<ModelSelection>()
  const [modelError, setModelError] = useState('')
  const statusLabel = !session.history.data
    ? session.history.loading
      ? 'Checking session'
      : 'Session unavailable'
    : session.stream === 'connected'
      ? session.status
      : 'Status unverified'
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
            <Link to={`/projects/${projectId}`}>Project workspace</Link>
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
          <NewSessionButton label="New session" projectId={projectId} />
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
              navigate(`/projects/${projectId}/sessions/${encodeURIComponent(event.target.value)}`)
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
          <Button href={`/projects/${projectId}`} secondary>
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
          {session.history.data?.historical && (
            <p className="activity-notice">
              Historical session: stored conversation is available, but this runtime session cannot
              currently be resumed. Start a new session or refresh after restoring the runtime.
            </p>
          )}
          <details className="session-model-picker">
            <summary>Session model</summary>
            <p>
              Current model:{' '}
              {record?.model
                ? `${record.model.providerID}/${record.model.modelID}`
                : 'No explicit selection'}
            </p>
            <ModelPicker projectId={projectId} onChange={setPendingModel} />
            <Button
              disabled={!pendingModel || session.busy}
              onClick={() => {
                if (pendingModel)
                  void api
                    .setModel(sessionId, projectId, pendingModel)
                    .then(() => {
                      setPendingModel(undefined)
                      setModelError('')
                      window.dispatchEvent(new Event('atlas:sessions'))
                    })
                    .catch((error) => setModelError(error.message))
              }}
            >
              Apply model to session
            </Button>
            {modelError && <p role="alert">{modelError}</p>}
          </details>
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
                  select={(path) => {
                    setSelected(path)
                    setSelectionRevision((r) => r + 1)
                  }}
                  refresh={refreshFiles}
                />
              )}
            </aside>
            <section
              className={`workspace-editor ${preferences.wrapCode ? 'wrap-code' : ''}`}
              aria-label="Project file editor"
            >
              <FileEditor
                projectId={projectId}
                selected={selected}
                selectionRevision={selectionRevision}
                revision={session.revision + fileRevision}
                readOnly={session.busy}
                onChange={refreshFiles}
              />
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
              <GitChanges
                key={projectId}
                projectId={projectId}
                active={view === 'changes'}
                revision={session.revision + fileRevision}
                onChange={refreshFiles}
              />
            </div>
          </div>
        </>
      )}
      <footer className="workspace-statusbar">
        <span>OpenCode / local execution</span>
        <span>Workspace: {projectId}</span>
        <Link to="/docs/security">Not a sandbox ↗</Link>
      </footer>
    </div>
  )
}
