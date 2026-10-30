import { lazy, Suspense, useEffect, useRef, useState, useCallback } from 'react'
import {
  useBeforeUnload,
  useBlocker,
  useInRouterContext,
  UNSAFE_DataRouterContext,
} from 'react-router-dom'
import { useContext } from 'react'
import { Badge, Button, Dialog, EmptyState, Loading } from '../../components/ui'
import { api } from '../../services/api'
import type { FileContent } from '../../types/api'
const CodeEditor = lazy(() => import('./CodeEditor'))
interface Tab {
  file: FileContent
  draft: string
}
function NavigationGuard({ dirty }: { dirty: boolean }) {
  const blocker = useBlocker(dirty),
    handled = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (blocker.state !== 'blocked') {
      handled.current = undefined
      return
    }
    if (handled.current === blocker.location.key) return
    handled.current = blocker.location.key
    if (blocker.state === 'blocked') {
      if (window.confirm('Discard unsaved file changes and leave this workspace?'))
        blocker.proceed()
      else blocker.reset()
    }
  }, [blocker])
  return null
}
export function FileEditor({
  projectId,
  selected,
  revision = 0,
  selectionRevision = 0,
  readOnly = false,
  onChange,
}: {
  projectId: string
  selected: string
  revision?: number
  selectionRevision?: number
  readOnly?: boolean
  onChange: () => void
}) {
  const [tabs, setTabs] = useState<Tab[]>([]),
    [active, setActive] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [action, setAction] = useState(''),
    [actionPath, setActionPath] = useState(''),
    [destination, setDestination] = useState(''),
    [folder, setFolder] = useState(false),
    [confirm, setConfirm] = useState('')
  const ref = useRef(tabs)
  ref.current = tabs
  const dirty = tabs.some((t) => t.draft !== t.file.content),
    router = useContext(UNSAFE_DataRouterContext),
    inRouter = useInRouterContext()
  useBeforeUnload(
    useCallback(
      (event) => {
        if (dirty) {
          event.preventDefault()
          event.returnValue = ''
        }
      },
      [dirty],
    ),
  )
  useEffect(() => {
    if (!dirty || router || !inRouter) return
    const handler = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest('a[href]')
      if (anchor && !window.confirm('Discard unsaved file changes?')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [dirty, router, inRouter])
  useEffect(() => {
    if (!selected) return
    setActive(selected)
    setNotice('')
    setError('')
    if (ref.current.some((t) => t.file.path === selected)) return
    const controller = new AbortController()
    setLoading(true)
    api
      .readFile(projectId, selected, controller.signal)
      .then((file) => {
        if (!controller.signal.aborted)
          setTabs((current) => [
            ...current.filter((t) => t.file.path !== selected),
            { file, draft: file.content },
          ])
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [selected, projectId, selectionRevision])
  const previous = useRef(revision)
  useEffect(() => {
    if (previous.current === revision) return
    previous.current = revision
    for (const tab of ref.current) {
      if (tab.draft !== tab.file.content) continue
      void api
        .readFile(projectId, tab.file.path)
        .then((file) =>
          setTabs((current) =>
            current.map((t) =>
              t.file.path === file.path && t.draft === t.file.content
                ? { file, draft: file.content }
                : t,
            ),
          ),
        )
        .catch(() => setNotice('A file changed or disappeared; reload its tab to reconcile.'))
    }
  }, [revision, projectId])
  const current = tabs.find((t) => t.file.path === active)
  async function save() {
    if (!current || readOnly || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    const submitted = current.draft
    try {
      const file = await api.writeFile(projectId, active, submitted, current.file.version)
      setTabs((rows) =>
        rows.map((t) =>
          t.file.path === active
            ? { file, draft: t.draft === submitted ? file.content : t.draft }
            : t,
        ),
      )
      setNotice('Saved by backend.')
      onChange()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }
  async function reload() {
    if (!current) return
    if (
      current.draft !== current.file.content &&
      !window.confirm('Discard unsaved edits and reload from disk?')
    )
      return
    setLoading(true)
    setError('')
    try {
      const file = await api.readFile(projectId, active)
      setTabs((rows) =>
        rows.map((t) => (t.file.path === active ? { file, draft: file.content } : t)),
      )
      setNotice('Reloaded from disk.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reload failed')
    } finally {
      setLoading(false)
    }
  }
  function close(path: string) {
    const tab = tabs.find((t) => t.file.path === path)
    if (
      tab &&
      tab.draft !== tab.file.content &&
      !window.confirm(`Discard unsaved changes to ${path}?`)
    )
      return
    setTabs((rows) => rows.filter((t) => t.file.path !== path))
    if (active === path) setActive(tabs.find((t) => t.file.path !== path)?.file.path ?? '')
  }
  async function mutate() {
    setBusy(true)
    setError('')
    try {
      const tab = tabs.find((t) => t.file.path === actionPath)
      if ((action === 'rename' || action === 'delete') && !folder && !tab)
        throw new Error('Open the file first so its expected version can be checked.')
      if (
        tab &&
        tab.draft !== tab.file.content &&
        !window.confirm('Discard unsaved tab changes for this operation?')
      )
        return
      if (action === 'create')
        await api.createFile(projectId, actionPath, folder ? 'directory' : 'file')
      if (action === 'rename')
        await api.renameFile(projectId, actionPath, destination, tab?.file.version ?? '')
      if (action === 'delete')
        await api.deleteFile(projectId, actionPath, tab?.file.version ?? '', confirm)
      if (action !== 'create') {
        setTabs((rows) => rows.filter((t) => t.file.path !== actionPath))
        if (active === actionPath) setActive('')
      }
      setAction('')
      setNotice('Filesystem operation confirmed by backend.')
      onChange()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="file-editor-pane" aria-label="Project code editor">
      {router && <NavigationGuard dirty={dirty} />}
      <div className="workbench-panel-header">
        <h2>Editor</h2>
        <Badge>{readOnly ? 'Read-only' : 'Project files'}</Badge>
        <Button
          secondary
          disabled={readOnly || busy}
          onClick={() => {
            setAction('create')
            setActionPath('')
            setConfirm('')
            setFolder(false)
            setError('')
          }}
        >
          New file / folder
        </Button>
        <Button
          secondary
          disabled={readOnly || busy}
          onClick={() => {
            setAction('rename')
            setActionPath('')
            setDestination('')
            setFolder(true)
            setError('')
          }}
        >
          Rename empty folder
        </Button>
        <Button
          secondary
          disabled={readOnly || busy}
          onClick={() => {
            setAction('delete')
            setActionPath('')
            setConfirm('')
            setFolder(true)
            setError('')
          }}
        >
          Delete empty folder
        </Button>
      </div>
      {tabs.length > 0 && (
        <div className="editor-tabs" role="tablist" aria-label="Open files">
          {tabs.map((t, index) => (
            <div key={t.file.path} role="presentation">
              <button
                id={`editor-tab-${projectId}-${encodeURIComponent(t.file.path)}`}
                aria-controls={`editor-panel-${projectId}`}
                role="tab"
                tabIndex={active === t.file.path ? 0 : -1}
                aria-selected={active === t.file.path}
                type="button"
                onKeyDown={(event) => {
                  let next = index
                  if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
                  else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length
                  else if (event.key === 'Home') next = 0
                  else if (event.key === 'End') next = tabs.length - 1
                  else return
                  event.preventDefault()
                  setActive(tabs[next].file.path)
                  document
                    .getElementById(
                      `editor-tab-${projectId}-${encodeURIComponent(tabs[next].file.path)}`,
                    )
                    ?.focus()
                }}
                onClick={() => {
                  setActive(t.file.path)
                  setError('')
                }}
              >
                {t.file.path}
                {t.draft !== t.file.content ? ' •' : ''}
              </button>
            </div>
          ))}
        </div>
      )}
      {error && (
        <p className="error-state" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="save-notice" role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <Loading label="Loading source file" />
      ) : current ? (
        <>
          <div className="editor-actions">
            <code>{active}</code>
            <button
              className="text-button"
              type="button"
              aria-label={`Close ${active}`}
              onClick={() => close(active)}
            >
              Close file
            </button>
            <Button
              disabled={readOnly || busy || current.draft === current.file.content}
              onClick={() => void save()}
            >
              Save file
            </Button>
            <Button secondary disabled={busy} onClick={() => void reload()}>
              Reload file
            </Button>
            <button
              className="text-button"
              disabled={readOnly || busy}
              onClick={() => {
                setAction('rename')
                setActionPath(active)
                setFolder(false)
                setError('')
              }}
            >
              Rename file
            </button>
            <button
              className="text-button"
              disabled={readOnly || busy}
              onClick={() => {
                setAction('delete')
                setActionPath(active)
                setFolder(false)
                setConfirm('')
                setError('')
              }}
            >
              Delete file
            </button>
          </div>
          <div
            className="file-source"
            role="tabpanel"
            id={`editor-panel-${projectId}`}
            aria-labelledby={`editor-tab-${projectId}-${encodeURIComponent(active)}`}
          >
            <Suspense fallback={<Loading label="Loading code editor" />}>
              <CodeEditor
                key={`${projectId}:${active}`}
                path={active}
                value={current.draft}
                readOnly={readOnly || current.file.readOnly || busy}
                onSave={() => void save()}
                onChange={(draft) =>
                  setTabs((rows) => rows.map((t) => (t.file.path === active ? { ...t, draft } : t)))
                }
              />
            </Suspense>
          </div>
          <p className="activity-notice">
            {current.draft === current.file.content
              ? 'Matches the last confirmed disk version.'
              : 'Unsaved changes.'}{' '}
            Ctrl/Cmd+S saves; Ctrl/Cmd+F finds. External edits produce a conflict, not a silent
            overwrite.
          </p>
        </>
      ) : (
        <EmptyState title="Open a project file">
          Select a file in Explorer, or create a new text file. No sample content is inserted.
        </EmptyState>
      )}
      <Dialog
        title={`${action === 'create' ? 'Create' : action === 'rename' ? 'Rename' : 'Delete'} project path`}
        open={!!action}
        dismissible={!busy}
        onClose={() => setAction('')}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void mutate()
          }}
        >
          <label className="form-field">
            Relative path
            <input required value={actionPath} onChange={(e) => setActionPath(e.target.value)} />
          </label>
          <label className="checkbox-field">
            <input type="checkbox" checked={folder} onChange={(e) => setFolder(e.target.checked)} />
            Folder (rename/delete supports empty folders only)
          </label>
          {action === 'rename' && (
            <label className="form-field">
              Destination path
              <input
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </label>
          )}
          {action === 'delete' && (
            <>
              <p>
                This deletes the path from disk. It is not attributed to the agent and cannot be
                undone through this dialog.
              </p>
              <label className="form-field">
                Type the exact path to confirm
                <input required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </label>
            </>
          )}
          {error && (
            <p role="alert" className="error-state">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy || (action === 'delete' && confirm !== actionPath)}>
            Confirm {action}
          </Button>
        </form>
      </Dialog>
    </section>
  )
}
