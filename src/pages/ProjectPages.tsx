import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Icon,
  Loading,
  PageHeader,
  Panel,
  SearchInput,
  Tabs,
} from '../components/ui'
import { NewSessionButton, ProjectLimitDialog, SessionList } from '../features/projects'
import { useResource } from '../hooks/useResource'
import { useSessions } from '../hooks/useSessions'
import { api } from '../services/api'
import { WORKSPACE_ID } from '../types/api'
const loadWorkspace = (signal: AbortSignal) => api.workspace(signal)
const loadHealth = (signal: AbortSignal) => api.health(signal)
export function DashboardPage() {
  const workspace = useResource(loadWorkspace)
  const health = useResource(loadHealth)
  const sessions = useSessions().filter((item) => item.workspaceId === WORKSPACE_ID)
  const [newProject, setNewProject] = useState(false)
  return (
    <>
      <PageHeader
        eyebrow="Workspace / Overview"
        title="Good work starts with context."
        description="Welcome to your local development workspace. Pick up a session or prepare your environment for the next change."
        action={
          <Button onClick={() => setNewProject(true)}>
            <Icon name="plus" />
            New project
          </Button>
        }
      />
      <div className="app-page-body">
        <div className="dashboard-grid">
          <Panel
            title="Your project"
            eyebrow="Local workspace"
            action={
              <Link className="text-link" to="/projects">
                View all →
              </Link>
            }
          >
            {workspace.loading ? (
              <Loading />
            ) : workspace.error ? (
              <ErrorState message={workspace.error} retry={workspace.reload} />
            ) : (
              <div className="dashboard-project">
                <span className="project-icon">
                  <Icon name="folder" />
                </span>
                <div>
                  <h3>Local test workspace</h3>
                  <p>{WORKSPACE_ID}</p>
                  <span className="muted">
                    {workspace.data?.files.length} files in current inventory · modification time
                    not exposed
                  </span>
                </div>
                <Badge tone="success">Inventory available</Badge>
                <Button secondary href={`/projects/${WORKSPACE_ID}`}>
                  Open project →
                </Button>
              </div>
            )}
          </Panel>
          <Panel
            title="Runtime status"
            eyebrow="Environment"
            action={
              <button type="button" className="text-button" onClick={health.reload}>
                Refresh
              </button>
            }
          >
            {health.loading ? (
              <Loading label="Checking the actual runtime" />
            ) : health.error ? (
              <ErrorState message={health.error} retry={health.reload} />
            ) : (
              <>
                <dl className="detail-list">
                  <div>
                    <dt>Atlas backend</dt>
                    <dd>
                      <Badge tone="success">Reachable</Badge>
                    </dd>
                  </div>
                  <div>
                    <dt>OpenCode</dt>
                    <dd>
                      <Badge tone={health.data?.runtime.status === 'ready' ? 'success' : 'warning'}>
                        {health.data?.runtime.status}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt>Providers reported</dt>
                    <dd>{health.data?.runtime.providers.length ?? 0}</dd>
                  </div>
                  <div>
                    <dt>Credentials</dt>
                    <dd>Not verified by Atlas</dd>
                  </div>
                </dl>
                <Link className="text-link" to="/models">
                  Provider details →
                </Link>
              </>
            )}
          </Panel>
        </div>
        <Panel
          title="Recent coding sessions"
          eyebrow="Continue the thread"
          action={<NewSessionButton disabled={!workspace.data} />}
        >
          <SessionList sessions={sessions} limit={5} />
        </Panel>
        <Panel title="Get your environment ready" eyebrow="Getting started">
          <ol className="getting-started">
            <li>
              <span>01</span>
              <div>
                <Link to="/projects">Open the local project</Link>
                <p>One dedicated workspace is available. Project provisioning is not enabled.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <Link to="/docs/runtime">Configure the local runtime</Link>
                <p>Install OpenCode and start the Atlas backend.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <Link to="/docs/providers">Choose a model in OpenCode</Link>
                <p>Configure credentials locally. Atlas does not store your keys.</p>
              </div>
            </li>
            <li>
              <span>04</span>
              <div>
                <Link to={`/projects/${WORKSPACE_ID}`}>Start your first coding session</Link>
                <p>Send a focused instruction, then review the real result locally.</p>
              </div>
            </li>
          </ol>
        </Panel>
      </div>
      <ProjectLimitDialog open={newProject} onClose={() => setNewProject(false)} />
    </>
  )
}
export function ProjectsPage() {
  const workspace = useResource(loadWorkspace)
  const sessions = useSessions().filter((item) => item.workspaceId === WORKSPACE_ID)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('name')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [newProject, setNewProject] = useState(false)
  const projects = workspace.data
    ? [
        {
          name: 'Local test workspace',
          id: workspace.data.workspaceId,
          files: workspace.data.files.length,
        },
      ]
    : []
  const filtered = projects
    .filter((project) =>
      `${project.name} ${project.id}`.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => (sort === 'files' ? b.files - a.files : a.name.localeCompare(b.name)))
  return (
    <>
      <PageHeader
        eyebrow="Workspace / Projects"
        title="A home for the work."
        description="The current backend exposes one fixed local workspace. Your project inventory comes from the API, not demo data."
        action={
          <Button onClick={() => setNewProject(true)}>
            <Icon name="plus" />
            New project
          </Button>
        }
      />
      <div className="app-page-body">
        <div className="list-toolbar">
          <SearchInput
            label="Search projects"
            value={search}
            onChange={setSearch}
            placeholder="Search by project name…"
          />
          <label className="select-label">
            <span className="sr-only">Sort projects</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="name">Name: A–Z</option>
              <option value="files">File count: high to low</option>
            </select>
          </label>
          <Tabs
            label="Project presentation"
            value={view}
            onChange={setView}
            items={[
              { id: 'grid', label: 'Grid' },
              { id: 'list', label: 'List' },
            ]}
          />
        </div>
        {workspace.loading ? (
          <Loading label="Loading the local project" />
        ) : workspace.error ? (
          <ErrorState message={workspace.error} retry={workspace.reload} />
        ) : (
          <>
            <p className="result-count" role="status">
              {filtered.length} project{filtered.length === 1 ? '' : 's'} · single-workspace preview
            </p>
            <div className={`projects-view projects-${view}`}>
              {filtered.map((project) => (
                <article className="project-card" key={project.id}>
                  <div className="project-card-top">
                    <span className="project-icon">
                      <Icon name="folder" />
                    </span>
                    <Badge tone="success">Inventory available</Badge>
                  </div>
                  <h2>{project.name}</h2>
                  <p>A dedicated local directory for real OpenCode sessions.</p>
                  <code>{project.id}</code>
                  <dl className="project-metadata">
                    <div>
                      <dt>Files</dt>
                      <dd>{project.files}</dd>
                    </div>
                    <div>
                      <dt>Sessions in this browser</dt>
                      <dd>{sessions.length}</dd>
                    </div>
                    <div>
                      <dt>Last modified</dt>
                      <dd>Not exposed</dd>
                    </div>
                  </dl>
                  <Button href={`/projects/${project.id}`} secondary>
                    Open project <Icon name="arrow" />
                  </Button>
                </article>
              ))}
            </div>
            {!filtered.length && (
              <EmptyState
                title="No matching projects"
                action={
                  <Button secondary onClick={() => setSearch('')}>
                    Clear search
                  </Button>
                }
              >
                Try another project name. New workspace provisioning is not implemented.
              </EmptyState>
            )}
            <p className="inline-note">
              Project rename and delete are unavailable. Session counts include only actual sessions
              created in this browser, not all runtime sessions.
            </p>
          </>
        )}
      </div>
      <ProjectLimitDialog open={newProject} onClose={() => setNewProject(false)} />
    </>
  )
}
export function ProjectPage() {
  const { projectId } = useParams()
  return projectId === WORKSPACE_ID ? <LocalProjectPage /> : <MissingProject />
}
export function MissingProject() {
  return (
    <>
      <PageHeader
        eyebrow="Workspace / Projects"
        title="Project not found."
        description="This identifier is not the configured local workspace. No fallback project has been substituted."
      />
      <div className="app-page-body">
        <Button href="/projects" secondary>
          Back to projects
        </Button>
      </div>
    </>
  )
}
function LocalProjectPage() {
  const workspace = useResource(loadWorkspace)
  const sessions = useSessions().filter((item) => item.workspaceId === WORKSPACE_ID)
  const [search, setSearch] = useState('')
  const [configure, setConfigure] = useState(false)
  return (
    <>
      <PageHeader
        eyebrow="Projects / Local workspace"
        title="Local test workspace"
        description="A dedicated directory for building context and working with OpenCode. Session mappings are valid only while the backend stays running."
        action={<NewSessionButton disabled={!workspace.data} />}
      />
      <div className="app-page-body">
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <Link to="/projects">Projects</Link>
          <span aria-hidden="true">/</span>
          <span>Local test workspace</span>
        </nav>
        {workspace.loading ? (
          <Loading />
        ) : workspace.error ? (
          <ErrorState message={workspace.error} retry={workspace.reload} />
        ) : (
          <>
            <div className="project-overview-grid">
              <Panel title="Workspace information" eyebrow="Project details">
                <dl className="detail-list">
                  <div>
                    <dt>Workspace</dt>
                    <dd>
                      <code>{workspace.data?.workspaceId}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Inventory</dt>
                    <dd>{workspace.data?.files.length} files</dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>Server-configured directory</dd>
                  </div>
                  <div>
                    <dt>Latest local activity</dt>
                    <dd>
                      {sessions[0]
                        ? new Date(sessions[0].updated).toLocaleString()
                        : 'No sessions indexed here'}
                    </dd>
                  </div>
                </dl>
                <Button secondary onClick={() => setConfigure(true)}>
                  Workspace configuration
                </Button>
              </Panel>
              <Panel title="Working here" eyebrow="Execution boundary">
                <p>
                  Instructions run through your locally configured OpenCode engine. Use your local
                  editor for editing and Git for authoritative change review. Sessions include
                  bounded read-only text previews and runtime-reported diffs.
                </p>
                <p>There is no sandbox, approval gate, project deletion or remote provisioning.</p>
                <Button secondary href="/docs/security">
                  Security & limitations
                </Button>
              </Panel>
            </div>
            <Panel
              title="Coding sessions"
              eyebrow="Activity in this browser"
              action={<NewSessionButton />}
            >
              <SessionList sessions={sessions} />
            </Panel>
            <Panel
              title="File inventory"
              eyebrow="Read-only"
              action={
                <button type="button" className="text-button" onClick={workspace.reload}>
                  Refresh inventory
                </button>
              }
            >
              <SearchInput label="Search workspace files" value={search} onChange={setSearch} />
              {workspace.data?.files.length ? (
                <div className="inventory-list">
                  {workspace.data.files
                    .filter((file) => file.path.toLowerCase().includes(search.toLowerCase()))
                    .map((file) => (
                      <div key={file.path}>
                        <Icon name="file" />
                        <code>{file.path}</code>
                        <span>{file.bytes ?? 'Unknown'} bytes</span>
                      </div>
                    ))}
                  {!workspace.data.files.some((file) =>
                    file.path.toLowerCase().includes(search.toLowerCase()),
                  ) && (
                    <EmptyState title="No matching files">
                      Try another path or clear the search.
                    </EmptyState>
                  )}
                </div>
              ) : (
                <EmptyState title="This workspace is empty">
                  Add files using your local tools, then refresh the inventory. Atlas has no
                  file-upload or creation endpoint.
                </EmptyState>
              )}
            </Panel>
          </>
        )}
      </div>
      <ProjectLimitDialog open={configure} onClose={() => setConfigure(false)} />
    </>
  )
}
