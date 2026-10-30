import { useEffect, useRef, useState, type ComponentProps } from 'react'
import Markdown from 'react-markdown'
import { Badge, Button, CodeBlock } from '../../components/ui'
import { usePreferences } from '../../hooks/preferences'
import type { Message } from '../../types/api'
import { AgentEmpty } from './WorkspaceStates'
function MarkdownPre({ children }: ComponentProps<'pre'>) {
  const child = children as { props?: { children?: unknown; className?: string } }
  if (child?.props && typeof child.props.children === 'string')
    return (
      <CodeBlock
        code={child.props.children.replace(/\n$/, '')}
        language={child.props.className?.replace('language-', '') ?? 'text'}
      />
    )
  return <pre>{children}</pre>
}
export function Conversation({
  messages,
  busy,
  connected,
  cancelling,
  send,
  cancel,
}: {
  messages: Message[]
  busy: boolean
  connected: boolean
  cancelling: boolean
  send: (text: string) => Promise<boolean>
  cancel: () => Promise<void>
}) {
  const [prompt, setPrompt] = useState('')
  const [validation, setValidation] = useState('')
  const transcript = useRef<HTMLDivElement>(null)
  const follow = useRef(true)
  const { preferences } = usePreferences()
  useEffect(() => {
    if (follow.current && transcript.current)
      transcript.current.scrollTop = transcript.current.scrollHeight
  }, [messages])
  async function submit() {
    if (!prompt.trim()) {
      setValidation('Write an instruction before sending.')
      return
    }
    if (prompt.length > 20_000) {
      setValidation('Keep the instruction under 20,000 characters.')
      return
    }
    if (await send(prompt)) {
      setPrompt('')
      setValidation('')
    }
  }
  return (
    <section
      className={`conversation ${preferences.wrapCode ? 'wrap-code' : ''}`}
      aria-label="Agent conversation"
    >
      <div className="workbench-panel-header">
        <h2>Agent</h2>
        <Badge>
          {!connected ? 'Waiting for stream' : busy ? 'Working' : 'Ready for instruction'}
        </Badge>
      </div>
      <div
        className="conversation-messages"
        ref={transcript}
        role="log"
        aria-label="Session messages"
        aria-live="polite"
        aria-relevant="additions text"
        onScroll={() => {
          const el = transcript.current
          if (el) follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100
        }}
      >
        {messages.length ? (
          messages.map((message) => (
            <article key={message.id} className={`message message-${message.role}`}>
              <div className="message-heading">
                <span>{message.role === 'user' ? 'You' : 'OpenCode'}</span>
                <span className="mono">
                  {message.role === 'user' ? 'Instruction' : 'Agent response'}
                </span>
              </div>
              <div className="markdown">
                <Markdown components={{ pre: MarkdownPre }}>
                  {message.text ||
                    (message.tools.length
                      ? 'Tool activity is recorded below.'
                      : 'Message has no text content.')}
                </Markdown>
              </div>
              {message.tools.map((tool, index) => (
                <div className="message-tool" key={`${tool}-${index}`}>
                  {tool}
                </div>
              ))}
            </article>
          ))
        ) : (
          <AgentEmpty />
        )}
      </div>
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault()
          if (!busy && connected) void submit()
        }}
      >
        <label className="sr-only" htmlFor="agent-prompt">
          Instruction for OpenCode
        </label>
        <textarea
          id="agent-prompt"
          value={prompt}
          onChange={(event) => {
            setPrompt(event.target.value)
            setValidation('')
          }}
          disabled={busy || !connected}
          placeholder={
            connected ? 'Describe the next change…' : 'Waiting for the session event connection…'
          }
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              if (!busy && connected) void submit()
            }
          }}
          aria-describedby="composer-hint"
          rows={4}
        />
        {validation && (
          <span role="alert" className="field-error">
            {validation}
          </span>
        )}
        <div className="composer-footer">
          <span id="composer-hint">
            Enter to send <span aria-hidden="true">·</span> Shift + Enter for a new line
          </span>
          {busy ? (
            <Button secondary disabled={cancelling} onClick={() => void cancel()}>
              {cancelling ? 'Stopping…' : 'Stop execution'}
            </Button>
          ) : (
            <Button type="submit" disabled={!connected || !prompt.trim()}>
              Send <span aria-hidden="true">↑</span>
            </Button>
          )}
        </div>
        <p className="execution-disclaimer">
          Instructions can change local files. No sandbox or approval gate.
        </p>
      </form>
    </section>
  )
}
