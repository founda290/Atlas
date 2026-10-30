import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Dialog, EmptyState, Loading, PageHeader, Panel } from '../components/ui'
import { browserPath, browserProjects, type BrowserProject } from '../services/browserProjects'
const CodeEditor = lazy(() => import('../features/workspace/CodeEditor'))
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })),
    link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function AwakeControl() {
  const [enabled, setEnabled] = useState(false),
    [status, setStatus] = useState('Screen wake lock is off.'),
    lock = useRef<WakeLockSentinel | null>(null)
  useEffect(() => {
    let disposed = false
    async function acquire() {
      if (!enabled || document.visibilityState !== 'visible') return
      try {
        if (!navigator.wakeLock) {
          setStatus('Screen wake lock is unsupported in this browser.')
          return
        }
        const value = await navigator.wakeLock.request('screen')
        if (disposed) {
          await value.release()
          return
        }
        lock.current = value
        setStatus('Screen wake lock active while this tab is visible.')
        value.addEventListener('release', () => {
          if (!disposed) {
            lock.current = null
            setStatus('Wake lock released by the browser. Return to this tab to retry.')
          }
        })
      } catch {
        if (!disposed)
          setStatus('Wake lock was denied or released. Keep the device awake manually.')
      }
    }
    const visible = () => {
      if (document.visibilityState === 'visible' && !lock.current) void acquire()
    }
    if (enabled) void acquire()
    else setStatus('Screen wake lock is off.')
    document.addEventListener('visibilitychange', visible)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', visible)
      void lock.current?.release()
      lock.current = null
    }
  }, [enabled])
  return (
    <div className="browser-awake">
      <label className="checkbox-field">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Keep this screen awake (optional)
      </label>
      <p role="status" className="fine-print">
        {status} This does not keep background code running or prevent OS sleep.
      </p>
    </div>
  )
}
export function BrowserProjectsPage() {
  const { browserId } = useParams(),
    navigate = useNavigate(),
    [projects, setProjects] = useState<BrowserProject[]>([]),
    [project, setProject] = useState<BrowserProject | null>(null),
    [selected, setSelected] = useState(''),
    [draft, setDraft] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [creating, setCreating] = useState(false),
    [name, setName] = useState(''),
    [description, setDescription] = useState(''),
    [path, setPath] = useState(''),
    [confirmName, setConfirmName] = useState(''),
    [deleting, setDeleting] = useState(false)
  const file = project?.files.find((f) => f.path === selected),
    dirty = !!file && draft !== file.content
  const discardConfirmed = useRef(false)
  const blocker = useBlocker(() => dirty && !discardConfirmed.current)
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm('Discard unsaved browser file changes and leave?')) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker])
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await browserProjects.list()
      setProjects(list)
      if (browserId) {
        const value = await browserProjects.get(browserId)
        setProject(value)
      } else {
        setProject(null)
        setSelected('')
        setDraft('')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Browser storage unavailable.')
    } finally {
      setLoading(false)
    }
  }, [browserId])
  useEffect(() => {
    discardConfirmed.current = false
    setSelected('')
    setDraft('')
    setProject(null)
    void reload()
  }, [reload])
  function select(next: string) {
    if (dirty && !confirm('Discard unsaved changes before switching files?')) return
    setSelected(next)
    setDraft(project?.files.find((f) => f.path === next)?.content ?? '')
    setNotice('')
  }
  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed.')
    } finally {
      setBusy(false)
    }
  }
  async function save() {
    if (!project || !file || busy) return
    await run(async () => {
      const result = await browserProjects.update(project.id, project.revision, (p) => {
        const f = p.files.find((v) => v.path === selected)
        if (!f) throw new Error('File no longer exists.')
        f.content = draft
      })
      setProject(result)
      setNotice('Saved to this browser’s IndexedDB. Not uploaded to the cloud.')
    })
  }
  function exportWork() {
    if (!project) return
    const copy = {
      ...project,
      files: project.files.map((f) => (f.path === selected ? { ...f, content: draft } : f)),
    }
    try {
      download('atlas-project.json', browserProjects.export(copy))
      setNotice('Export includes the current editor draft. Keep this backup somewhere safe.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.')
    }
  }
  return (
    <>
      <PageHeader
        title={project?.name ?? 'Browser-local projects'}
        eyebrow="Projects / On this device"
        description="Real source files stored in this browser. No server, account or cloud runner required."
        action={
          project ? (
            <Button href="/browser-projects">All browser projects</Button>
          ) : (
            <Button
              onClick={() => {
                setName('')
                setDescription('')
                setCreating(true)
              }}
            >
              New browser project
            </Button>
          )
        }
      />
      <div className="app-page-body">
        <Panel title="Choose where your work lives">
          <div className="project-mode-links">
            <Badge>Browser-local</Badge>
            <Link className="text-link" to="/projects">
              Local backend / OpenCode →
            </Link>
            <Link className="text-link" to="/cloud-projects">
              Cloud — disabled →
            </Link>
            <Link className="text-link" to="/account">
              Account →
            </Link>
          </div>
          <p>
            Browser projects do not run OpenCode, shell commands, Git or background agents. They are
            not automatically synced or encrypted by your account. Export before clearing browser
            data; private browsing may discard everything.
          </p>
          <AwakeControl />
        </Panel>
        {error && (
          <p role="alert" className="error-state">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="save-notice">
            {notice}
          </p>
        )}
        {!browserId && (
          <Panel title="On this browser">
            <label className="form-field">
              Import an exported Atlas project
              <input
                type="file"
                accept=".json,application/json"
                disabled={busy}
                onChange={(event) => {
                  const input = event.currentTarget,
                    upload = input.files?.[0]
                  if (!upload) return
                  void run(async () => {
                    if (upload.size > 12 * 1024 * 1024) throw new Error('Import is too large.')
                    const p = await browserProjects.import(await upload.text())
                    input.value = ''
                    navigate(`/browser-projects/${p.id}`)
                  })
                }}
              />
            </label>
            {loading ? (
              <Loading />
            ) : projects.length ? (
              <div className="session-list">
                {projects.map((p) => (
                  <Link key={p.id} className="session-row" to={`/browser-projects/${p.id}`}>
                    <strong>{p.name}</strong>
                    <span>
                      {p.files.length} files · revision {p.revision}
                    </span>
                    <time>{new Date(p.updated).toLocaleString()}</time>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="No browser projects yet">
                Create one or import an exported project. No examples are seeded.
              </EmptyState>
            )}
          </Panel>
        )}
        {browserId && loading && !project && <Loading />}
        {project && (
          <>
            <Panel title="Project controls">
              <p>{project.description || 'No description.'}</p>
              <div className="project-mode-links">
                <Button secondary href="/browser-projects">
                  All browser projects
                </Button>
                <Button secondary onClick={exportWork}>
                  Export project & draft
                </Button>
                <Button
                  secondary
                  disabled={busy}
                  onClick={() => {
                    if (
                      !dirty ||
                      confirm('Discard unsaved draft and reload from browser storage?')
                    ) {
                      setSelected('')
                      setDraft('')
                      void reload()
                    }
                  }}
                >
                  Reload from storage
                </Button>
                <Button
                  secondary
                  disabled={busy}
                  onClick={() => {
                    setName(project.name)
                    setDescription(project.description)
                    setCreating(true)
                  }}
                >
                  Rename / description
                </Button>
                <Button secondary disabled={busy} onClick={() => setDeleting(true)}>
                  Delete browser project
                </Button>
              </div>
            </Panel>
            <div className="browser-editor-grid">
              <Panel title="Source files">
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    void run(async () => {
                      if (dirty)
                        throw new Error('Save or discard the current draft before creating a file.')
                      const next = browserPath(path)
                      const result = await browserProjects.update(
                        project.id,
                        project.revision,
                        (p) => {
                          if (p.files.some((f) => f.path === next))
                            throw new Error('File already exists.')
                          p.files.push({ path: next, content: '' })
                        },
                      )
                      setProject(result)
                      setSelected(next)
                      setDraft('')
                      setPath('')
                    })
                  }}
                >
                  <label className="form-field">
                    New file path
                    <input
                      required
                      maxLength={240}
                      placeholder="src/main.ts"
                      value={path}
                      onChange={(event) => setPath(event.target.value)}
                    />
                  </label>
                  <Button type="submit" secondary disabled={busy}>
                    Create file
                  </Button>
                </form>
                <nav aria-label="Browser source files">
                  {project.files.map((f) => (
                    <button
                      type="button"
                      key={f.path}
                      className="browser-file-button"
                      aria-current={selected === f.path ? 'true' : undefined}
                      onClick={() => select(f.path)}
                    >
                      {f.path}
                      {selected === f.path && dirty ? ' •' : ''}
                    </button>
                  ))}
                </nav>
              </Panel>
              <Panel title={selected || 'Editor'}>
                {file ? (
                  <>
                    <div className="project-mode-links">
                      <Badge>{dirty ? 'Unsaved draft' : 'Saved in this browser'}</Badge>
                      <Button disabled={!dirty || busy} onClick={() => void save()}>
                        Save browser file
                      </Button>
                      <Button
                        secondary
                        disabled={busy}
                        onClick={() => {
                          if (
                            !confirm(
                              `Delete ${selected}? Unsaved changes to this file will be lost.`,
                            )
                          )
                            return
                          void run(async () => {
                            const result = await browserProjects.update(
                              project.id,
                              project.revision,
                              (p) => {
                                p.files = p.files.filter((f) => f.path !== selected)
                              },
                            )
                            setProject(result)
                            setSelected('')
                            setDraft('')
                          })
                        }}
                      >
                        Delete file
                      </Button>
                      <Button
                        secondary
                        disabled={busy || dirty}
                        onClick={() => {
                          const destination = prompt('New relative source path', selected)
                          if (!destination || destination === selected) return
                          void run(async () => {
                            browserPath(destination)
                            const result = await browserProjects.update(
                              project.id,
                              project.revision,
                              (p) => {
                                const item = p.files.find((f) => f.path === selected)
                                if (!item) throw new Error('File not found.')
                                item.path = destination
                              },
                            )
                            setProject(result)
                            setSelected(destination)
                          })
                        }}
                      >
                        Rename file
                      </Button>
                    </div>
                    <Suspense fallback={<Loading label="Loading editor" />}>
                      <CodeEditor
                        key={`${project.id}/${selected}`}
                        path={selected}
                        value={draft}
                        onChange={setDraft}
                        onSave={() => void save()}
                        readOnly={busy}
                      />
                    </Suspense>
                    <p className="fine-print">
                      Ctrl/Cmd+S saves to browser storage. Use Export project & draft to back up
                      unsaved work too.
                    </p>
                  </>
                ) : (
                  <EmptyState title="Select or create a source file">
                    Nested source paths create virtual folders. Files remain here after ordinary
                    reloads, subject to browser retention policies.
                  </EmptyState>
                )}
              </Panel>
            </div>
          </>
        )}
        <Dialog
          title={project ? 'Edit browser project' : 'Create browser project'}
          open={creating}
          dismissible={!busy}
          onClose={() => setCreating(false)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void run(async () => {
                if (project) {
                  const result = await browserProjects.update(project.id, project.revision, (p) => {
                    p.name = name.trim()
                    p.description = description
                  })
                  setProject(result)
                } else {
                  const p = await browserProjects.create(name, description)
                  navigate(`/browser-projects/${p.id}`)
                }
                setCreating(false)
                setName('')
                setDescription('')
              })
            }}
          >
            <label className="form-field">
              Browser project name
              <input
                required
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="form-field">
              Browser project description
              <textarea
                maxLength={2000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <Button type="submit" disabled={busy}>
              {project ? 'Save project details' : 'Create on this browser'}
            </Button>
          </form>
        </Dialog>
        <Dialog
          title="Delete browser project"
          open={deleting}
          dismissible={!busy}
          onClose={() => setDeleting(false)}
        >
          <p>
            This permanently deletes the browser copy. Export first. Type the exact project name:{' '}
            {project?.name}
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!project) return
              void run(async () => {
                await browserProjects.remove(project.id, project.revision, confirmName)
                discardConfirmed.current = true
                setDeleting(false)
                setConfirmName('')
                setSelected('')
                setDraft('')
                setProject(null)
                navigate('/browser-projects')
              })
            }}
          >
            <label className="form-field">
              Confirm browser project name
              <input
                required
                value={confirmName}
                onChange={(event) => setConfirmName(event.target.value)}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <Button type="submit" disabled={busy || confirmName !== project?.name}>
              Permanently delete browser copy
            </Button>
          </form>
        </Dialog>
      </div>
    </>
  )
}
