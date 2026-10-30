import { Icon } from '../../components/ui'
export function EditorEmpty() {
  return (
    <div className="workspace-empty">
      <Icon name="file" />
      <h3>Start with the context.</h3>
      <p>
        Select a file to inspect its inventory details. File contents and editing are not exposed by
        the current API.
      </p>
      <span className="mono muted">Read-only inventory</span>
    </div>
  )
}
export function AgentEmpty() {
  return (
    <div className="workspace-empty agent-empty">
      <Icon name="model" />
      <h3>A new thread of work.</h3>
      <p>Start a coding session with your local OpenCode runtime, then send a clear instruction.</p>
      <span className="mono muted">No messages yet</span>
    </div>
  )
}
