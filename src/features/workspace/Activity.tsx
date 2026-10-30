import { diffLines } from 'diff'
import { Badge, EmptyState } from '../../components/ui'
import type { RuntimeEvent } from '../../types/api'
import { asRecord, asString, type ObservedDiff } from './data'
export function Activity({ events }: { events: RuntimeEvent[] }) {
  return (
    <section className="activity-view">
      <div className="workbench-panel-header">
        <h2>Execution activity</h2>
        <Badge>Live events only</Badge>
      </div>
      <p className="activity-notice">
        Actual events received during this connection. Activity is not replayed or persisted. A
        verified terminal-output stream is not available.
      </p>
      {events.length ? (
        <ol className="event-list">
          {events.map((event, index) => {
            const data = event.data ?? {}
            const part = asRecord(data.part)
            const state = asRecord(part.state)
            return (
              <li key={`${event.id ?? index}`}>
                <span className="event-marker" aria-hidden="true" />
                <div>
                  <strong>{event.type}</strong>
                  {typeof part.tool === 'string' && (
                    <p>
                      {part.tool} · {asString(state.status)}
                    </p>
                  )}
                  {event.error && <p className="field-error">{event.error}</p>}
                  {event.type === 'permission.updated' && (
                    <p>
                      Permission requested by runtime. Resolve it in your local OpenCode
                      environment; Atlas has no permission-response control.
                    </p>
                  )}
                  <time>
                    {event.created
                      ? new Date(event.created).toLocaleTimeString()
                      : 'Timestamp not reported'}
                  </time>
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <EmptyState title="No activity received yet">
          Submit an instruction to receive real lifecycle and tool events. No terminal output or
          execution result is simulated.
        </EmptyState>
      )}
    </section>
  )
}
export function Changes({ diffs }: { diffs: ObservedDiff[] }) {
  return (
    <section className="changes-view">
      <div className="workbench-panel-header">
        <h2>Change review</h2>
        <Badge>Observed runtime data</Badge>
      </div>
      <p className="activity-notice">
        Only diffs present in actual message summaries or streamed session.diff events appear here.
        There is no current-diff HTTP endpoint, apply or revert operation. These observations may
        not reflect later filesystem edits.
      </p>
      {diffs.length ? (
        <div className="diff-list">
          {diffs.map((diff) => (
            <details key={diff.file} open>
              <summary>
                <code>{diff.file}</code>
                <span className="diff-added">+{diff.additions}</span>
                <span className="diff-removed">−{diff.deletions}</span>
              </summary>
              {diff.before.length + diff.after.length < 200_000 ? (
                <pre className="diff-code" aria-label={`Observed diff for ${diff.file}`}>
                  {diffLines(diff.before, diff.after).map((part, index) => (
                    <span
                      key={index}
                      className={
                        part.added
                          ? 'diff-line added'
                          : part.removed
                            ? 'diff-line removed'
                            : 'diff-line'
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
              ) : (
                <p>Diff is too large to render safely. Review this file in your local tools.</p>
              )}
            </details>
          ))}
        </div>
      ) : (
        <EmptyState title="No observed diff data">
          This does not prove there are no changes. The API has no current-diff endpoint. Review the
          actual workspace with your local editor or Git.
        </EmptyState>
      )}
    </section>
  )
}
