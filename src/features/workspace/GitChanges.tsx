import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge, Button, EmptyState, ErrorState, Loading } from '../../components/ui'
import { api } from '../../services/api'
import { useResource } from '../../hooks/useResource'
import type { GitFile } from '../../types/api'
export function GitChanges({
  projectId,
  active,
  revision,
  onChange,
}: {
  projectId: string
  active: boolean
  revision: number
  onChange: () => void
}) {
  const [comparison, setComparison] = useState('working'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const loader = useCallback(
    (signal: AbortSignal) =>
      active ? api.gitDiff(projectId, comparison, signal) : Promise.resolve(null),
    [projectId, comparison, active],
  )
  const resource = useResource(loader),
    previous = useRef(revision)
  useEffect(() => {
    if (previous.current !== revision) {
      previous.current = revision
      if (active) resource.reload()
    }
  }, [revision, active, resource.reload])
  async function action(kind: 'stage' | 'unstage' | 'revert', file: GitFile) {
    const confirm =
      kind === 'revert'
        ? window.prompt(
            `Discard unstaged edits in ${file.path}? This includes any user edits, not just agent changes. Type the exact path to confirm.`,
          )
        : undefined
    if (kind === 'revert' && confirm !== file.path) return
    setBusy(true)
    setError('')
    try {
      await api.gitAction(projectId, kind, file.path, file.version, confirm ?? undefined)
      resource.reload()
      onChange()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Git action failed')
    } finally {
      setBusy(false)
    }
  }
  if (!active) return null
  return (
    <section className="changes-view" aria-label="Authoritative Git change review">
      <div className="workbench-panel-header">
        <h2>Git change review</h2>
        <Badge>Actual Git state</Badge>
        <button
          className="text-button"
          type="button"
          disabled={resource.loading || busy}
          onClick={resource.reload}
        >
          Refresh diff
        </button>
      </div>
      <div className="editor-actions">
        <label>
          Compare
          <select
            aria-label="Git comparison"
            value={comparison}
            onChange={(e) => setComparison(e.target.value)}
          >
            <option value="working">Working tree vs index</option>
            <option value="staged">Index vs HEAD</option>
            <option value="head">Working tree vs HEAD</option>
          </select>
        </label>
      </div>
      <p className="activity-notice">
        Git changes may include pre-existing user work. Atlas does not claim all changes are
        agent-generated. Stage means add to the Git index, not commit or approval of agent
        ownership. Revert only restores selected existing tracked files from the index.
      </p>
      {error && <ErrorState message={error} />}{' '}
      {resource.loading ? (
        <Loading label="Fetching actual Git diff" />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : resource.data ? (
        <>
          <p className="activity-notice">
            Branch: {resource.data.branch ?? 'not a repository'}. {resource.data.omitted} entries
            omitted by file/size policy.
          </p>
          {resource.data.diffs.length ? (
            <div className="diff-list">
              {resource.data.diffs.map((file) => (
                <details key={file.path} open>
                  <summary>
                    <code>
                      {file.status} {file.path}
                    </code>
                    <span className="diff-added">+{file.additions}</span>
                    <span className="diff-removed">−{file.deletions}</span>
                  </summary>
                  <div className="editor-actions">
                    <Button
                      secondary
                      disabled={busy || (file.status !== '??' && file.status[1] === ' ')}
                      onClick={() => void action('stage', file)}
                    >
                      Stage {file.path}
                    </Button>
                    <Button
                      secondary
                      disabled={busy || [' ', '?'].includes(file.status[0])}
                      onClick={() => void action('unstage', file)}
                    >
                      Unstage {file.path}
                    </Button>
                    <Button
                      secondary
                      disabled={
                        busy ||
                        file.status === '??' ||
                        file.status[1] === ' ' ||
                        /[DRCU]/.test(file.status)
                      }
                      onClick={() => void action('revert', file)}
                    >
                      Discard unstaged {file.path}
                    </Button>
                  </div>
                  <pre className="diff-code" aria-label={`Git diff for ${file.path}`}>
                    {file.unified.length < 200000
                      ? file.unified
                      : 'Diff exceeds rendering budget. Review in local Git tools.'}
                  </pre>
                </details>
              ))}
            </div>
          ) : (
            <EmptyState title="No visible changes in this comparison">
              Other comparisons or omitted files may still contain changes.
            </EmptyState>
          )}
        </>
      ) : null}
    </section>
  )
}
