import { useCallback, useEffect, useRef, useMemo } from 'react'
import { diffLines } from 'diff'
import { Badge, EmptyState, ErrorState, Loading } from '../../components/ui'
import { useResource } from '../../hooks/useResource'
import { api } from '../../services/api'
import type { ObservedDiff } from './data'

export function SessionChanges({
  sessionId,
  active,
  revision,
}: {
  sessionId: string
  active: boolean
  revision: number
}) {
  const loader = useCallback(
    (signal: AbortSignal) => (active ? api.sessionDiff(sessionId, signal) : Promise.resolve(null)),
    [sessionId, active],
  )
  const snapshot = useResource(loader)
  const previous = useRef(revision)
  useEffect(() => {
    if (previous.current !== revision) {
      previous.current = revision
      if (active) snapshot.reload()
    }
  }, [revision, active, snapshot.reload])
  if (!active) return null
  return (
    <section className="changes-view" aria-label="Runtime session change review">
      <div className="workbench-panel-header">
        <h2>Change review</h2>
        <Badge>Runtime session diff</Badge>
        <button
          type="button"
          className="text-button"
          onClick={snapshot.reload}
          disabled={snapshot.loading}
        >
          Refresh diff
        </button>
      </div>
      <p className="activity-notice">
        Fetched on demand from OpenCode, not reconstructed from live events. This is a
        runtime-reported session diff, not an authoritative filesystem or Git comparison. There are
        no apply, revert or save operations.
      </p>
      {snapshot.loading ? (
        <Loading label="Fetching runtime session diff" />
      ) : snapshot.error ? (
        <ErrorState message={snapshot.error} retry={snapshot.reload} />
      ) : snapshot.data ? (
        <>
          <p className="activity-notice">
            Fetched {new Date(snapshot.data.fetchedAt).toLocaleTimeString()}. Files may change after
            refresh.{' '}
            {snapshot.data.omitted > 0 &&
              `${snapshot.data.omitted} ${snapshot.data.omitted === 1 ? 'entry' : 'entries'} omitted by path, type or size policy.`}
          </p>
          <DiffList diffs={snapshot.data.diffs} />
        </>
      ) : null}
    </section>
  )
}
function DiffList({ diffs }: { diffs: ObservedDiff[] }) {
  let linesRemaining = 6000
  let charsRemaining = 200000
  const entries = diffs.map((diff) => {
    const lines = diff.before.split('\n').length + diff.after.split('\n').length
    const chars = diff.before.length + diff.after.length
    const allowed =
      chars < 100000 && lines < 2000 && lines <= linesRemaining && chars <= charsRemaining
    if (allowed) {
      linesRemaining -= lines
      charsRemaining -= chars
    }
    return { diff, allowed }
  })
  return (
    <>
      {diffs.length ? (
        <div className="diff-list">
          {entries.map(({ diff, allowed }) => (
            <details key={diff.file} open>
              <summary>
                <code>{diff.file}</code>
                <span className="diff-added">+{diff.additions}</span>
                <span className="diff-removed">−{diff.deletions}</span>
              </summary>
              <DiffCode diff={diff} allowed={allowed} />
            </details>
          ))}
        </div>
      ) : (
        <EmptyState title="Runtime returned no visible diff entries">
          This is not proof that the filesystem is unchanged. Review local changes in your editor or
          Git; restricted or oversized entries may be omitted.
        </EmptyState>
      )}
    </>
  )
}

function DiffCode({ diff, allowed }: { diff: ObservedDiff; allowed: boolean }) {
  const parts = useMemo(
    () =>
      allowed
        ? diffLines(diff.before, diff.after, { timeout: 100, maxEditLength: 2000 })
        : undefined,
    [diff.before, diff.after, allowed],
  )
  if (!parts)
    return <p>Diff exceeds the safe rendering budget. Review this file in your local tools.</p>
  return (
    <pre className="diff-code" aria-label={`Runtime diff for ${diff.file}`}>
      {parts.map((part, index) => (
        <span
          key={index}
          className={
            part.added ? 'diff-line added' : part.removed ? 'diff-line removed' : 'diff-line'
          }
        >
          {part.value.split('\n').map((line, lineIndex, all) =>
            lineIndex === all.length - 1 && !line ? null : (
              <span key={lineIndex}>
                {part.added ? '+' : part.removed ? '−' : ' '} {line}
                {'\n'}
              </span>
            ),
          )}
        </span>
      ))}
    </pre>
  )
}
