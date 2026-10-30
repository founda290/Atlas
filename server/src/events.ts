import { randomUUID } from 'node:crypto'
import { filterRuntimeDiffs } from './session-diff.js'
import type { AgentEvent } from './runtime.js'
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
/** The SDK global stream wraps its event in { directory, payload }. */
export function normalizeRuntimeEvent(item: unknown): AgentEvent {
  const envelope = record(item)
  const raw = Object.keys(record(envelope.payload)).length ? record(envelope.payload) : envelope
  const properties = record(raw.properties)
  const part = record(properties.part)
  const info = record(properties.info)
  const sessionId =
    properties.sessionID ??
    properties.sessionId ??
    part.sessionID ??
    info.sessionID ??
    raw.sessionID ??
    raw.sessionId
  return {
    id: typeof raw.id === 'string' ? raw.id : randomUUID(),
    type: typeof raw.type === 'string' ? raw.type : 'runtime.event',
    sessionId: typeof sessionId === 'string' ? sessionId : '',
    created: Date.now(),
    error:
      raw.type === 'session.error'
        ? 'The model runtime reported an error. Check the selected model, provider connection, and worker availability.'
        : undefined,
    data:
      raw.type === 'message.updated'
        ? { info: { id: info.id, role: info.role, sessionID: info.sessionID } }
        : raw.type === 'message.part.updated'
          ? {
              part: {
                id: part.id,
                type: part.type,
                messageID: part.messageID,
                sessionID: part.sessionID,
                text: part.text,
                tool: part.tool,
                state: { status: record(part.state).status },
              },
            }
          : raw.type === 'message.part.delta'
            ? {
                messageID: properties.messageID,
                partID: properties.partID,
                field: properties.field,
                delta: properties.delta,
              }
            : raw.type === 'session.diff'
              ? {
                  ...filterRuntimeDiffs(Array.isArray(properties.diff) ? properties.diff : []),
                  diff: filterRuntimeDiffs(Array.isArray(properties.diff) ? properties.diff : [])
                    .diffs,
                }
              : raw.type === 'session.status'
                ? {
                    status: {
                      type: record(properties.status).type,
                      attempt: record(properties.status).attempt,
                      next: record(properties.status).next,
                    },
                  }
                : {},
  }
}
