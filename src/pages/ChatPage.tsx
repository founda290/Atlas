import { Link } from 'react-router-dom'
import { Button, PageHeader } from '../components/ui'

export function ChatPage() {
  return (
    <div className="chat-home">
      <PageHeader
        eyebrow="Workspace / Chat"
        title="What are you working on?"
        description="Start from a conversation. Creating a project is optional."
        action={
          <Button secondary href="/browser-projects">
            Create project
          </Button>
        }
      />
      <div className="chat-home-body">
        <section className="chat-start-card" aria-labelledby="chat-start-title">
          <div className="chat-start-copy">
            <p className="panel-eyebrow">A fresh conversation</p>
            <h2 id="chat-start-title">Start with a question.</h2>
            <p>
              Hosted AI execution is not available yet. No assistant, worker or sample conversation
              is being simulated here.
            </p>
          </div>
          <div className="chat-availability" role="status">
            <span className="chat-status-dot" aria-hidden="true" />
            <div>
              <strong>Hosted chat is not ready</strong>
              <p>
                Sending stays disabled until Atlas has a real isolated worker, lifecycle controls
                and safety limits.
              </p>
            </div>
          </div>
          <label htmlFor="chat-message">Message</label>
          <textarea
            id="chat-message"
            rows={4}
            disabled
            placeholder="Messaging will be available when hosted execution is ready."
          />
          <div className="chat-compose-footer">
            <span>No messages have been sent.</span>
            <Button disabled>Send message</Button>
          </div>
        </section>
        <div className="chat-home-links">
          <Link to="/browser-projects">
            <strong>Projects are optional</strong>
            <span>
              Create or edit source files in this browser. This editor does not run an AI agent.
            </span>
          </Link>
          <Link to="/account">
            <strong>Account settings</strong>
            <span>Review your sign-in and verification status.</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
