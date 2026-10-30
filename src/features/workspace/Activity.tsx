import { Badge, EmptyState } from '../../components/ui'
import type { RuntimeEvent } from '../../types/api'
import { asRecord, asString } from './data'

function isUsefulActivity(event: RuntimeEvent) {
  if (
    [
      'session.started',
      'session.completed',
      'session.failed',
      'session.cancelled',
      'session.error',
      'permission.updated',
      'workspace.changed',
    ].includes(event.type) ||
    event.type.startsWith('tool.')
  )
    return true
  if (event.type !== 'message.part.updated') return false
  return asRecord(event.data?.part).type === 'tool'
}

export function Activity({
  events,
  title = 'Execution activity',
}: {
  events: RuntimeEvent[]
  title?: string
}) {
  const visibleEvents = events.filter(isUsefulActivity)
  return (
    <section className="activity-view">
      <div className="workbench-panel-header">
        <h2>{title}</h2>
        <Badge>Live events only</Badge>
      </div>
      <p className="activity-notice">
        These are runtime-reported lifecycle and tool events, not generated narration or terminal
        output. A submitted operation continues while the Atlas execution service remains online;
        stopping or restarting that service may interrupt it.
      </p>
      {visibleEvents.length ? (
        <ol className="event-list">
          {visibleEvents.map((event, index) => {
            const data = event.data ?? {}
            const part = asRecord(data.part)
            const state = asRecord(part.state)
            const tool = asString(part.tool) || asString(data.tool) || asString(data.name)
            return (
              <li key={`${event.id ?? index}`}>
                <span className="event-marker" aria-hidden="true" />
                <div>
                  <strong>{event.type}</strong>
                  {tool && (
                    <p>
                      {tool} · {asString(state.status) || event.type.replace('tool.', '')}
                    </p>
                  )}
                  {event.error && <p className="field-error">{event.error}</p>}
                  {event.type === 'permission.updated' && (
                    <p>
                      The runtime requested permission. Atlas does not provide a permission-response
                      control, so the request cannot be approved here.
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
