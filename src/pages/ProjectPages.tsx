import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Panel,
  SearchInput,
} from '../components/ui'
import { NewSessionButton, SessionList } from '../features/projects'
import { api } from '../services/api'
import { browserProjects } from '../services/browserProjects'
import { useResource } from '../hooks/useResource'
import type { Project } from '../types/api'
const loadProjects = (signal: AbortSignal) => api.projects(signal)
const loadHealth = (signal: AbortSignal) => api.health(signal)
export function MissingProject() {
  return (
    <div className="app-page-body">
      <h1>Project not found.</h1>
      <p>This project is unavailable. No substitute workspace has been opened.</p>
      <Button href="/projects">Back to projects</Button>
    </div>
  )
}
function CreateProject({ done }: { done: (project: Project) => void }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState(() =>
    ['localhost', '127.0.0.1'].includes(location.hostname) ? 'managed' : 'browser',
  )
  const [open, setOpen] = useState(false),
    [name, setName] = useState(''),
    [description, setDescription] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>New project</Button>
      <Dialog title="Create project" open={open} dismissible={!busy} onClose={() => setOpen(false)}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setBusy(true)
            setError('')
            if (!['browser', 'managed'].includes(mode)) {
              setError('Cloud project creation is disabled.')
              setBusy(false)
              return
            }
            if (mode === 'browser') {
              void browserProjects
                .create(name, description)
                .then((p) => {
                  setOpen(false)
                  navigate(`/browser-projects/${p.id}`)
                })
                .catch((e) => setError(e.message))
                .finally(() => setBusy(false))
              return
            }
            void api
              .createProject(name, description)
              .then((p) => {
                setOpen(false)
                done(p)
              })
              .catch((e) => setError(e.message))
              .finally(() => setBusy(false))
          }}
        >
          <p>
            Choose browser-local storage for editing on this device, or a backend-managed Git
            workspace for local OpenCode execution. Cloud creation is disabled.
          </p>
          <label className="form-field">
            Project name
            <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="form-field">
            Description
            <textarea
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="form-field">
            Workspace location
            <select value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="managed">Local backend — OpenCode on your machine</option>
              <option value="browser">Browser-local — no backend required</option>
              <option value="cloud" disabled>
                Cloud — disabled for now
              </option>
            </select>
          </label>
          {error && (
            <p role="alert" className="error-state">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <Button type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create project'}
            </Button>
            <Button secondary disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
export function ProjectModes() {
  return (
    <Panel title="Project modes">
      <div className="project-mode-links">
        <Button secondary href="/browser-projects">
          Browser-local projects
        </Button>
        <Button secondary href="/projects">
          Local backend projects
        </Button>
        <Button secondary href="/cloud-projects">
          Cloud — disabled
        </Button>
        <Button secondary href="/account">
          Your account
        </Button>
      </div>
      <p>
        Browser-local works on this website without the local API. OpenCode execution requires the
        backend on your machine. Cloud execution is not enabled.
      </p>
    </Panel>
  )
}
export function DashboardPage() {
  const projects = useResource(loadProjects),
    health = useResource(loadHealth)
  return (
    <>
      <PageHeader
        eyebrow="Workspace / Dashboard"
        title="Your work, in focus."
        description="Persistent projects and your local coding runtime."
        action={<Button href="/projects">Open projects</Button>}
      />
      <div className="app-page-body">
        <ProjectModes />
        <div className="model-summary">
          <Panel title="Projects">
            <p>
              {projects.data?.projects.filter((p) => p.status === 'active').length ?? '—'} active
              workspaces
            </p>
          </Panel>
          <Panel title="Runtime">
            {health.loading ? (
              <Loading />
            ) : health.error ? (
              <ErrorState message={health.error} retry={health.reload} />
            ) : (
              <>
                <Badge>{health.data?.runtime.state ?? health.data?.runtime.status}</Badge>
                <p>Execution is local to the backend, not hosted by this website.</p>
              </>
            )}
          </Panel>
        </div>
        <Panel title="Recently opened">
          {projects.loading ? (
            <Loading />
          ) : projects.error ? (
            <ErrorState message={projects.error} retry={projects.reload} />
          ) : projects.data?.projects.length ? (
            <div className="session-list">
              {projects.data.projects.slice(0, 8).map((p) => (
                <Link className="session-row" key={p.id} to={`/projects/${p.id}`}>
                  <strong>{p.name}</strong>
                  <Badge>{p.status}</Badge>
                  <time>{new Date(p.lastOpenedAt).toLocaleString()}</time>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="No projects yet">
              Create your first managed workspace. No demo project is seeded.
            </EmptyState>
          )}
        </Panel>
      </div>
    </>
  )
}
export function ProjectsPage() {
  const projects = useResource(loadProjects),
    navigate = useNavigate(),
    [search, setSearch] = useState(''),
    [sort, setSort] = useState('recent'),
    [view, setView] = useState<'grid' | 'list'>('grid')
  const rows = (projects.data?.projects ?? [])
    .filter((p) => `${p.name} ${p.description}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name) : b.lastOpenedAt - a.lastOpenedAt,
    )
  return (
    <>
      <PageHeader
        eyebrow="Workspace / Projects"
        title="Make something worthwhile."
        description="Real, durable projects. Each has its own managed directory and Git repository."
        action={<CreateProject done={(p) => navigate(`/projects/${p.id}`)} />}
      />
      <div className="app-page-body">
        <ProjectModes />
        <div className="project-toolbar">
          <SearchInput label="Search projects" value={search} onChange={setSearch} />
          <label>
            Sort projects
            <select
              aria-label="Sort projects"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="recent">Recently opened</option>
              <option value="name">Name</option>
            </select>
          </label>
          <Button secondary onClick={() => setView(view === 'grid' ? 'list' : 'grid')}>
            {view === 'grid' ? 'List view' : 'Grid view'}
          </Button>
          <Button secondary onClick={projects.reload}>
            Refresh projects
          </Button>
        </div>
        {projects.loading ? (
          <Loading />
        ) : projects.error ? (
          <ErrorState message={projects.error} retry={projects.reload} />
        ) : rows.length ? (
          <div className={view === 'grid' ? 'directory-grid' : 'session-list'}>
            {rows.map((p) => (
              <article className={view === 'grid' ? 'directory-card' : 'session-row'} key={p.id}>
                <Badge>{p.status}</Badge>
                <h2>
                  <Link to={`/projects/${p.id}`}>{p.name}</Link>
                </h2>
                <p>{p.description || 'No description'}</p>
                <small>Opened {new Date(p.lastOpenedAt).toLocaleString()}</small>
                <Button secondary href={`/projects/${p.id}`}>
                  Open project
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title={search ? 'No matching projects' : 'No projects yet'}>
            Create a project to begin. No workspace data is fabricated.
          </EmptyState>
        )}
      </div>
    </>
  )
}
export function ProjectPage() {
  const { projectId } = useParams()
  return projectId && /^[a-f0-9-]{36}$/.test(projectId) ? (
    <ExistingProjectPage key={projectId} />
  ) : (
    <MissingProject />
  )
}
function ExistingProjectPage() {
  const { projectId = '' } = useParams(),
    navigate = useNavigate()
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [project, inventory, sessions, git, activity] = await Promise.all([
        api.project(projectId, signal),
        api.workspace(signal, projectId),
        api.sessions(projectId, signal),
        api.gitStatus(projectId, signal),
        api.activity(projectId, signal),
      ])
      return { project, inventory, sessions, git, activity }
    },
    [projectId],
  )
  const resource = useResource(load),
    [editing, setEditing] = useState(false),
    [name, setName] = useState(''),
    [description, setDescription] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false),
    [confirmation, setConfirmation] = useState('')
  const p = resource.data?.project
  async function update(input: Parameters<typeof api.updateProject>[1]) {
    setBusy(true)
    setError('')
    try {
      await api.updateProject(projectId, input)
      setEditing(false)
      resource.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }
  if (resource.loading)
    return (
      <div className="app-page-body">
        <h1>Opening project</h1>
        <Loading />
      </div>
    )
  if (resource.error)
    return (
      <div className="app-page-body">
        <h1>Project unavailable</h1>
        <ErrorState message={resource.error} retry={resource.reload} />
        <Button secondary href="/projects">
          Back to projects
        </Button>
      </div>
    )
  if (!p) return <MissingProject />
  return (
    <>
      <PageHeader
        eyebrow="Workspace / Project"
        title={p.name}
        description={p.description || 'Managed local project'}
        action={<NewSessionButton projectId={projectId} disabled={p.status !== 'active'} />}
      />
      <div className="app-page-body">
        <div className="project-toolbar">
          <Button href={`/projects/${projectId}/editor`}>Open editor</Button>
          <Badge>{p.status}</Badge>
          <Button
            secondary
            onClick={() => {
              setName(p.name)
              setDescription(p.description)
              setEditing(true)
            }}
          >
            Edit project
          </Button>
          <Button
            secondary
            disabled={busy}
            onClick={() => void update({ status: p.status === 'archived' ? 'active' : 'archived' })}
          >
            {p.status === 'archived' ? 'Restore project' : 'Archive project'}
          </Button>
          <Button secondary onClick={() => setDeleting(true)}>
            Delete project
          </Button>
          <Button secondary onClick={resource.reload}>
            Refresh project
          </Button>
        </div>
        {error && (
          <p className="error-state" role="alert">
            {error}
          </p>
        )}
        <div className="model-summary">
          <Panel title="Workspace">
            <p>Independent, backend-managed directory. Paths are not exposed.</p>
            <p>
              {resource.data?.inventory.files.filter((f) => f.kind === 'file').length} visible files
            </p>
          </Panel>
          <Panel title="Git status">
            <p>
              {resource.data?.git.branch ?? 'No repository'} · {resource.data?.git.files.length}{' '}
              changes
            </p>
            <p>Git changes are not automatically attributed to an agent.</p>
          </Panel>
        </div>
        <Panel title="Sessions">
          <SessionList sessions={resource.data?.sessions.sessions ?? []} />
        </Panel>
        <Panel title="Project activity">
          {resource.data?.activity.events.length ? (
            <ol>
              {resource.data.activity.events.slice(0, 50).map((event) => (
                <li key={event.id}>
                  <code>{event.type}</code> {event.path ?? ''} ·{' '}
                  {new Date(event.created).toLocaleString()}
                </li>
              ))}
            </ol>
          ) : (
            <p>No recorded activity.</p>
          )}
        </Panel>
        <Panel title="File inventory">
          {resource.data?.inventory.files.length ? (
            <ul>
              {resource.data.inventory.files.slice(0, 200).map((f) => (
                <li key={f.path}>
                  <code>{f.path}</code> · {f.kind} · {f.bytes ?? 0} bytes
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Workspace is empty">
              Start a session to create files or use the editor file controls.
            </EmptyState>
          )}
        </Panel>
      </div>
      <Dialog
        title="Edit project"
        open={editing}
        onClose={() => setEditing(false)}
        dismissible={!busy}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void update({ name, description })
          }}
        >
          <label className="form-field">
            Project name
            <input required value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </label>
          <label className="form-field">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
            />
          </label>
          <Button type="submit" disabled={busy}>
            Save project
          </Button>
        </form>
      </Dialog>
      <Dialog
        title="Delete project registration"
        open={deleting}
        onClose={() => setDeleting(false)}
        dismissible={!busy}
      >
        <p>
          The workspace directory and historical data are retained. This removes the project from
          the active catalogue; it does not erase your source files.
        </p>
        <label className="form-field">
          Type {p.name} to confirm
          <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
        </label>
        <Button
          disabled={busy || confirmation !== p.name}
          onClick={() => {
            setBusy(true)
            void api
              .deleteProject(projectId, confirmation)
              .then(() => navigate('/projects'))
              .catch((e) => setError(e.message))
              .finally(() => setBusy(false))
          }}
        >
          Confirm delete project
        </Button>
        {error && <p role="alert">{error}</p>}
      </Dialog>
    </>
  )
}
