import { Badge, EmptyState } from '../../components/ui'
import type { RuntimeEvent } from '../../types/api'
import { asRecord, asString } from './data'
export function Activity({ events }: { events: RuntimeEvent[] }) {
  return (
    <section className="activity-view">
      <div className="workbench-panel-header">
        <h2>Execution activity</h2>
        <Badge>Live events only</Badge>
      </div>
      <p className="activity-notice">
        Actual events received during this connection. The live feed is not replayed; bounded
        activity metadata is saved on the project overview. A verified terminal-output stream is not
        available.
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
