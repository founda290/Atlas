import { Icon } from '../../components/ui'
export function EditorEmpty() {
  return (
    <div className="workspace-empty">
      <Icon name="file" />
      <h3>Start with the context.</h3>
      <p>
        Select a supported text file to read its contents. Files are read-only; binary, oversized
        and restricted paths are not exposed.
      </p>
      <span className="mono muted">Read-only workspace</span>
    </div>
  )
}
export function AgentEmpty() {
  return (
    <div className="workspace-empty agent-empty">
      <Icon name="model" />
      <h3>A new thread of work.</h3>
      <p>Send a message to the selected model to begin. No example conversation is shown.</p>
      <span className="mono muted">No messages yet</span>
    </div>
  )
}
