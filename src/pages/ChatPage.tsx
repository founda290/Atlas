import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Button, Icon, Badge, Loading, ErrorState } from '../components/ui'
import { isOpenCodeFreeModel } from '../features/providerCatalog'
import { Activity } from '../features/workspace/Activity'
import { Conversation } from '../features/workspace/Conversation'
import { useAgentSession } from '../hooks/useAgentSession'
import { api } from '../services/api'
import { WORKSPACE_ID, type ModelInfo, type ModelSelection, type ProviderInfo } from '../types/api'

type SelectableModel = ModelInfo & { providerName: string }
type ChatRouteState = {
  initialPrompt?: string
  title?: string
  modelLabel?: string
  model?: ModelSelection
}

function getSelectableModels(providers: ProviderInfo[]): SelectableModel[] {
  return providers
    .flatMap((provider) =>
      provider.connected
        ? provider.models
            .filter((model) => model.available && model.toolCall)
            .map((model) => ({ ...model, providerName: provider.name }))
        : [],
    )
    .sort(
      (a, b) =>
        Number(isOpenCodeFreeModel(b.providerID, b.inputPrice, b.outputPrice)) -
          Number(isOpenCodeFreeModel(a.providerID, a.inputPrice, a.outputPrice)) ||
        a.providerName.localeCompare(b.providerName) ||
        a.name.localeCompare(b.name),
    )
}

function preferredFreeModelKey(models: SelectableModel[]) {
  const model = models.find((item) =>
    isOpenCodeFreeModel(item.providerID, item.inputPrice, item.outputPrice),
  )
  return model ? `${model.providerID}/${model.modelID}` : ''
}

export function ChatPage() {
  const { sessionId } = useParams()
  return sessionId ? <ChatSessionPage sessionId={sessionId} /> : <ChatHomePage />
}

function ChatHomePage() {
  const navigate = useNavigate()
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [discovered, setDiscovered] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [selectedKey, setSelectedKey] = useState('')
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const models = useMemo(() => getSelectableModels(providers), [providers])
  const selectedModel = models.find(
    (model) => `${model.providerID}/${model.modelID}` === selectedKey,
  )
  const canCompose = discovered && !!selectedModel && !discovering && !starting

  async function discoverModels() {
    if (discovering) return
    setDiscovering(true)
    setDiscovered(false)
    setProviders([])
    setError('')
    try {
      const result = await api.providers()
      setProviders(result.providers)
      const choices = getSelectableModels(result.providers)
      setSelectedKey((current) =>
        choices.some((model) => `${model.providerID}/${model.modelID}` === current)
          ? current
          : preferredFreeModelKey(choices),
      )
      setDiscovered(true)
    } catch {
      setError(
        'Atlas could not reach a model worker. No models are available to select, and no message was sent.',
      )
    } finally {
      setDiscovering(false)
    }
  }

  async function startConversation() {
    const text = draft.trim()
    if (!canCompose || !selectedModel || !text || starting) return
    setStarting(true)
    setError('')
    const model = { providerID: selectedModel.providerID, modelID: selectedModel.modelID }
    const modelLabel = `${selectedModel.providerName} / ${selectedModel.name}`
    const title = text.replace(/\s+/g, ' ').slice(0, 120)
    try {
      const created = await api.createSession(title, WORKSPACE_ID, model)
      navigate(`/chat/${encodeURIComponent(created.id)}`, {
        state: { initialPrompt: text, title, modelLabel, model } satisfies ChatRouteState,
      })
    } catch {
      setError('Atlas could not start a real model session. No assistant response was generated.')
      setStarting(false)
    }
  }

  const modelPlaceholder = discovering
    ? 'Checking connected models…'
    : !discovered
      ? 'Check connected models to choose one'
      : models.length
        ? 'Choose a model'
        : 'No selectable models reported'

  return (
    <div className="chat-intersection">
      <header className="chat-intersection-heading">
        <div className="chat-section-kicker">
          <span className="chat-kicker-mark">
            <Icon name="chat" />
          </span>
          <span>ATLAS CHAT</span>
          <span className="chat-kicker-divider" aria-hidden="true" />
          <span className="chat-kicker-secondary">A clear space to think and build</span>
        </div>
        <div className="chat-heading-row">
          <div>
            <h1>What are you working on?</h1>
            <p>Start with a question, an idea, or a problem you want to untangle.</p>
          </div>
          <Button secondary href="/browser-projects" className="chat-project-action">
            <Icon name="folder" />
            Projects <span className="chat-optional-label">· optional</span>
          </Button>
        </div>
      </header>

      <div className="chat-intersection-grid">
        <main className="chat-primary-column">
          <section className="chat-compose-card" aria-labelledby="chat-compose-title">
            <div className="chat-card-heading">
              <div className="chat-heading-icon" aria-hidden="true">
                <Icon name="model" />
              </div>
              <div>
                <h2 id="chat-compose-title">New conversation</h2>
                <p>Choose a real model, then send your first message.</p>
              </div>
              <span className="chat-empty-label">No messages yet</span>
            </div>

            <div className="chat-model-row">
              <div className="chat-model-label">
                <label htmlFor="chat-model">Model</label>
                <span>
                  Choose from models enabled in the Atlas worker. OpenCode free models come first;
                  paid models always require an explicit selection.
                </span>
              </div>
              <select
                id="chat-model"
                aria-label="Model"
                value={selectedKey}
                disabled={!discovered || discovering || !models.length || starting}
                onChange={(event) => {
                  setSelectedKey(event.target.value)
                  setError('')
                }}
              >
                <option value="">{modelPlaceholder}</option>
                {models.map((model) => (
                  <option
                    key={`${model.providerID}/${model.modelID}`}
                    value={`${model.providerID}/${model.modelID}`}
                  >
                    {model.providerName} / {model.name}
                    {isOpenCodeFreeModel(model.providerID, model.inputPrice, model.outputPrice)
                      ? ' — OpenCode free tier'
                      : ''}
                  </option>
                ))}
              </select>
              <button
                className="chat-refresh-models"
                type="button"
                onClick={() => void discoverModels()}
                disabled={discovering || starting}
              >
                {discovering ? 'Checking…' : discovered ? 'Refresh models' : 'Discover models'}
              </button>
            </div>

            {discovered && models.length > 0 && (
              <p className="chat-model-note">
                Free-tier access is account- and limit-dependent. Atlas will not silently switch to
                a paid model when free access is unavailable; provider connectivity is confirmed by
                a real request.
              </p>
            )}

            {!discovered && !discovering && !error && (
              <div className="chat-availability-card" role="status">
                <span className="chat-availability-icon" aria-hidden="true">
                  <Icon name="model" />
                </span>
                <div>
                  <strong>Check for connected models</strong>
                  <p>
                    Discover models reported by an Atlas worker. The composer remains disabled
                    unless a real connected, tool-capable model is returned.
                  </p>
                </div>
              </div>
            )}

            {discovered && models.length === 0 && (
              <div className="chat-availability-card" role="status">
                <span className="chat-availability-icon" aria-hidden="true">
                  <Icon name="model" />
                </span>
                <div>
                  <strong>No selectable model was reported</strong>
                  <p>
                    Nothing can be sent until the runtime reports a connected, tool-capable model.
                    Atlas has not added placeholder models.
                  </p>
                </div>
              </div>
            )}

            <form
              className={`chat-composer ${canCompose ? 'is-ready' : ''}`}
              onSubmit={(event) => {
                event.preventDefault()
                void startConversation()
              }}
            >
              <label className="sr-only" htmlFor="chat-message">
                Message
              </label>
              <textarea
                id="chat-message"
                rows={4}
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value)
                  setError('')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void startConversation()
                  }
                }}
                disabled={!canCompose}
                placeholder={
                  canCompose
                    ? 'Ask a question or describe what you want to work on…'
                    : 'Choose an available model before sending a message.'
                }
                maxLength={20_000}
              />
              <div className="chat-composer-footer">
                <span>
                  Enter to send <span aria-hidden="true">·</span> Shift + Enter for a new line
                </span>
                <Button type="submit" disabled={!canCompose || !draft.trim()}>
                  {starting ? 'Starting…' : 'Send message'} <span aria-hidden="true">↑</span>
                </Button>
              </div>
            </form>
            {discovering && <Loading label="Discovering connected models" />}
            {error && (
              <p className="chat-inline-error" role="alert">
                {error}
              </p>
            )}
          </section>

          <div className="chat-trust-row">
            <span
              className={`chat-connection-dot ${discovered && models.length ? 'is-ready' : ''}`}
              aria-hidden="true"
            />
            <span>
              {discovered && models.length
                ? 'A real model is available to select'
                : 'No message is sent until a real model is connected and selected'}
            </span>
            <span className="chat-trust-separator" aria-hidden="true">
              ·
            </span>
            <span>Projects are always optional</span>
          </div>
        </main>

        <aside className="chat-side-column" aria-label="Workspace information">
          <section className="chat-side-card chat-project-card">
            <span className="chat-side-icon">
              <Icon name="folder" />
            </span>
            <div className="chat-side-copy">
              <span className="chat-side-eyebrow">YOUR WORKSPACE</span>
              <h2>Start with chat. Add a project when it helps.</h2>
              <p>
                Use the conversation space first. Create a browser project only when you want files
                and an editor.
              </p>
              <Link to="/browser-projects" className="chat-side-link">
                Browse projects <Icon name="arrow" />
              </Link>
            </div>
          </section>
          <section className="chat-side-card chat-integrity-card">
            <span className="chat-side-eyebrow">BUILT FOR HONEST WORK</span>
            <h2>Real models. Real answers.</h2>
            <p>
              Atlas shows only runtime-reported models and messages returned by the selected model.
              No demo thread is passed off as real work.
            </p>
            <Link to="/integrations" className="chat-side-link">
              Connection status <Icon name="arrow" />
            </Link>
          </section>
          <div className="chat-help-link">
            <Icon name="settings" />
            <span>Need to manage your account?</span>
            <Link to="/account">Account settings</Link>
          </div>
        </aside>
      </div>
    </div>
  )
}

function ChatSessionPage({ sessionId }: { sessionId: string }) {
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(sessionId))
    return (
      <div className="chat-intersection chat-session-unavailable">
        <ErrorState message="This conversation identifier is invalid." />
        <Button href="/chat" secondary>
          Return to Chat
        </Button>
      </div>
    )
  return <ActiveChatSession key={sessionId} sessionId={sessionId} />
}

function ActiveChatSession({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = (location.state ?? {}) as ChatRouteState
  const session = useAgentSession(sessionId)
  const autoSent = useRef('')
  const [currentModelLabel, setCurrentModelLabel] = useState(routeState.modelLabel ?? '')
  const initialPrompt = routeState.initialPrompt

  useEffect(() => {
    if (!initialPrompt || !session.history.data || autoSent.current === sessionId) return
    autoSent.current = sessionId
    navigate(location.pathname, {
      replace: true,
      state: {
        title: routeState.title,
        modelLabel: routeState.modelLabel,
        model: routeState.model,
      },
    })
    void session.send(initialPrompt)
  }, [
    initialPrompt,
    location.pathname,
    navigate,
    routeState.model,
    routeState.modelLabel,
    routeState.title,
    session.history.data,
    session.send,
    sessionId,
  ])

  const title = routeState.title || 'Conversation'
  const connectionLabel = !session.history.data
    ? session.history.loading
      ? 'Loading conversation'
      : 'Conversation unavailable'
    : session.stream === 'connected'
      ? session.status === 'running' || session.status === 'cancelling'
        ? 'Working'
        : 'Connected'
      : 'Checking connection'

  return (
    <div className="chat-intersection chat-session-page">
      <header className="chat-session-heading">
        <div>
          <Link to="/chat" className="chat-back-link">
            ← All chats
          </Link>
          <div className="chat-session-title-row">
            <div className="chat-heading-icon" aria-hidden="true">
              <Icon name="chat" />
            </div>
            <div>
              <h1>{title}</h1>
              <div className="chat-session-meta">
                <Badge
                  tone={
                    session.status === 'failed'
                      ? 'warning'
                      : session.status === 'running'
                        ? 'success'
                        : 'neutral'
                  }
                >
                  {connectionLabel}
                </Badge>
                {currentModelLabel && <span>Model · {currentModelLabel}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="chat-session-actions">
          <SessionModelControl
            sessionId={sessionId}
            busy={session.busy}
            onChange={setCurrentModelLabel}
          />
          <Button secondary href="/chat">
            New chat <span aria-hidden="true">＋</span>
          </Button>
        </div>
      </header>

      {session.history.loading && !session.history.data ? (
        <Loading label="Loading real conversation history" />
      ) : session.history.error && !session.history.data ? (
        <div className="chat-session-failure">
          <ErrorState message={session.history.error} retry={session.history.reload} />
          <p>Atlas did not substitute another conversation.</p>
        </div>
      ) : (
        <div className="chat-session-content">
          {session.history.data?.historical && (
            <p className="chat-history-notice" role="status">
              This is stored conversation history. The runtime cannot currently resume this session.
            </p>
          )}
          {session.error && (
            <div className="chat-session-error" role="alert">
              {session.error}
            </div>
          )}
          {session.errorCode === 'provider_rate_limit' && (
            <p className="chat-history-notice" role="status">
              Rate limit reached. Use Change model to choose another connected model, or retry later. Atlas never switches to a paid or different provider automatically.
            </p>
          )}
          {session.history.error && (
            <ErrorState message={session.history.error} retry={session.history.reload} />
          )}
          <div className="chat-stream-state" role="status">
            <span
              className={`chat-connection-dot ${session.stream === 'connected' ? 'is-ready' : ''}`}
              aria-hidden="true"
            />
            {session.stream === 'connected'
              ? 'Live conversation connected'
              : 'Connecting to this conversation…'}
          </div>
          <Conversation
            messages={session.messages}
            busy={session.busy}
            cancelling={session.status === 'cancelling'}
            connected={session.stream === 'connected'}
            send={session.send}
            cancel={session.cancel}
          />
          <aside className="chat-agent-trace" aria-label="Live agent activity">
            <Activity events={session.events} title="Agent activity" />
          </aside>
        </div>
      )}
    </div>
  )
}

function SessionModelControl({
  sessionId,
  busy,
  onChange,
}: {
  sessionId: string
  busy: boolean
  onChange: (label: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [models, setModels] = useState<SelectableModel[]>([])
  const [selectedKey, setSelectedKey] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const selectedModel = models.find(
    (model) => `${model.providerID}/${model.modelID}` === selectedKey,
  )

  async function loadModels() {
    setOpen(true)
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const result = await api.providers()
      const choices = getSelectableModels(result.providers)
      setModels(choices)
      setSelectedKey((current) =>
        choices.some((model) => `${model.providerID}/${model.modelID}` === current)
          ? current
          : preferredFreeModelKey(choices),
      )
    } catch {
      setError('The model catalogue could not be reached. The current model was not changed.')
    } finally {
      setLoading(false)
    }
  }

  async function applyModel() {
    if (!selectedModel || busy) return
    setError('')
    setNotice('')
    try {
      await api.setModel(sessionId, WORKSPACE_ID, {
        providerID: selectedModel.providerID,
        modelID: selectedModel.modelID,
      })
      onChange(`${selectedModel.providerName} / ${selectedModel.name}`)
      setNotice('Model updated for future messages.')
    } catch {
      setError(
        'Atlas could not confirm this model change. The previous selection remains in effect.',
      )
    }
  }

  return (
    <div className="chat-model-control">
      <button
        type="button"
        className="chat-change-model"
        disabled={busy}
        onClick={() => void loadModels()}
      >
        {loading ? 'Loading models…' : 'Change model'}
      </button>
      {open && (
        <div className="chat-model-popover">
          <label htmlFor="session-model">Model for future messages</label>
          <select
            id="session-model"
            value={selectedKey}
            disabled={loading || !models.length || busy}
            onChange={(event) => setSelectedKey(event.target.value)}
          >
            <option value="">
              {loading
                ? 'Checking connected models…'
                : models.length
                  ? 'Choose a model'
                  : 'No selectable model reported'}
            </option>
            {models.map((model) => (
              <option
                key={`${model.providerID}/${model.modelID}`}
                value={`${model.providerID}/${model.modelID}`}
              >
                {model.providerName} / {model.name}
                {isOpenCodeFreeModel(model.providerID, model.inputPrice, model.outputPrice)
                  ? ' — OpenCode free tier'
                  : ''}
              </option>
            ))}
          </select>
          <div className="chat-model-popover-actions">
            <button
              type="button"
              onClick={() => void applyModel()}
              disabled={!selectedModel || busy}
            >
              Apply
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}
        </div>
      )}
    </div>
  )
}
