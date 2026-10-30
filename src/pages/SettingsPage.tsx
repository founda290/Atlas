import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, CodeBlock, ErrorState, Loading, PageHeader, Panel } from '../components/ui'
import { usePreferences, type Preferences } from '../hooks/preferences'
import { useResource } from '../hooks/useResource'
import { api } from '../services/api'
import packageInfo from '../../package.json'
const loadHealth = (signal: AbortSignal) => api.health(signal)
export function SettingsPage() {
  const { preferences, save } = usePreferences()
  const [draft, setDraft] = useState<Preferences>(preferences)
  const lastSaved = useRef(preferences)
  useEffect(() => {
    const previous = lastSaved.current
    lastSaved.current = preferences
    setDraft((current) =>
      JSON.stringify(current) === JSON.stringify(previous) ? preferences : current,
    )
  }, [preferences])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const health = useResource(loadHealth)
  const dirty = JSON.stringify(draft) !== JSON.stringify(preferences)
  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setNotice('')
    setError('')
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    try {
      save(draft)
      setNotice('Preferences saved in this browser. No server or account settings were changed.')
      setError('')
    } catch {
      setError('Browser storage is unavailable. Your preferences were not saved.')
      setNotice('')
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Workspace / Settings"
        title="Make space for your process."
        description="Display preferences are saved locally. Runtime and account configuration remain clearly separate."
      />
      <div className="app-page-body settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {['General', 'Workspace', 'Agent', 'Appearance', 'Security', 'About'].map((label) => (
            <a href={`#settings-${label.toLowerCase()}`} key={label}>
              {label}
            </a>
          ))}
        </nav>
        <div className="settings-content">
          <form onSubmit={submit}>
            <section id="settings-general">
              <Panel title="General" eyebrow="Account & local settings">
                <div className="settings-row">
                  <div>
                    <h3>Your account</h3>
                    <p>
                      Manage your real Neon Auth session, verification and sign-out on the account
                      page. Display preferences remain local to this browser.
                    </p>
                  </div>
                  <Badge>Neon Auth</Badge>
                </div>
                <Link className="text-link" to="/account">
                  Manage account →
                </Link>
              </Panel>
            </section>
            <section id="settings-workspace">
              <Panel title="Workspace" eyebrow="Server-managed">
                <dl className="detail-list">
                  <div>
                    <dt>Default workspace</dt>
                    <dd>
                      <code>Managed per-project workspaces</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Default directory</dt>
                    <dd>
                      <code>.atlas/projects/</code> unless configured at startup
                    </dd>
                  </div>
                  <div>
                    <dt>Configuration</dt>
                    <dd>Environment variable on backend</dd>
                  </div>
                </dl>
                <p>
                  Change the workspace directory before launching the backend. This requires a
                  restart. Preserve the data directory and matching workspace root to retain
                  projects and history.
                </p>
                <CodeBlock
                  code="ATLAS_WORKSPACE_ROOT=/absolute/path/to/managed-projects npm run server:start"
                  language="bash"
                />
                <Link className="text-link" to="/docs/projects">
                  Workspace configuration guide →
                </Link>
              </Panel>
            </section>
            <section id="settings-agent">
              <Panel title="Agent" eyebrow="OpenCode-owned">
                <div className="settings-row">
                  <div>
                    <h3>Default model & behaviour</h3>
                    <p>
                      Global defaults are configured in OpenCode. Atlas can select a reported coding
                      model per session, but does not edit the global default, permission policy or
                      agent behaviour through the current API.
                    </p>
                  </div>
                  <Badge>Not exposed</Badge>
                </div>
                <Link className="text-link" to="/docs/providers">
                  Configure OpenCode locally →
                </Link>
              </Panel>
            </section>
            <section id="settings-appearance">
              <Panel title="Appearance" eyebrow="Browser preferences">
                <div className="settings-row">
                  <label htmlFor="workspace-theme">
                    <strong id="theme-label">Workspace theme</strong>
                    <span id="theme-description">
                      Public pages retain their warm editorial appearance.
                    </span>
                  </label>
                  <select
                    aria-labelledby="theme-label"
                    aria-describedby="theme-description"
                    id="workspace-theme"
                    value={draft.theme}
                    onChange={(event) =>
                      update('theme', event.target.value as Preferences['theme'])
                    }
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </div>
                <div className="settings-row">
                  <label htmlFor="interface-density">
                    <strong id="density-label">Interface density</strong>
                    <span id="density-description">
                      Adjust spacing in the application interface.
                    </span>
                  </label>
                  <select
                    aria-labelledby="density-label"
                    aria-describedby="density-description"
                    id="interface-density"
                    value={draft.density}
                    onChange={(event) =>
                      update('density', event.target.value as Preferences['density'])
                    }
                  >
                    <option value="comfortable">Comfortable</option>
                    <option value="compact">Compact</option>
                  </select>
                </div>
                <label className="checkbox-field settings-checkbox">
                  <input
                    type="checkbox"
                    checked={draft.wrapCode}
                    onChange={(event) => update('wrapCode', event.target.checked)}
                  />
                  <span>Wrap code blocks in agent messages</span>
                </label>
                <p className="fine-print">
                  Only theme, density and code wrapping are stored in browser preferences. No
                  credentials are stored here.
                </p>
              </Panel>
            </section>
            {error && (
              <div className="error-state" role="alert">
                {error}
              </div>
            )}
            {notice && (
              <div className="save-notice" role="status">
                {notice}
              </div>
            )}
            <div className="settings-save">
              <span className="muted">
                {dirty ? 'Unsaved display preferences' : 'Preferences are up to date'}
              </span>
              <Button
                secondary
                disabled={!dirty}
                onClick={() => {
                  setDraft(preferences)
                  setNotice('Changes discarded.')
                  setError('')
                }}
              >
                Cancel changes
              </Button>
              <Button type="submit" disabled={!dirty}>
                Save preferences
              </Button>
            </div>
          </form>
          <section id="settings-security">
            <Panel title="Security" eyebrow="Read before execution">
              <h3>A trusted local runtime. Not a sandbox.</h3>
              <p>
                OpenCode can run commands and modify files with local process permissions. Workspace
                context does not create operating-system isolation.
              </p>
              <ul>
                <li>Keep secrets and production credentials outside the workspace.</li>
                <li>Configure provider credentials through OpenCode, not browser storage.</li>
                <li>Do not expose the unauthenticated local backend publicly.</li>
                <li>Review changes in your local editor and version-control tools.</li>
              </ul>
              <Button secondary href="/docs/security">
                Read security & execution limits
              </Button>
            </Panel>
          </section>
          <section id="settings-about">
            <Panel title="About" eyebrow="Application information">
              <dl className="detail-list">
                <div>
                  <dt>Atlas</dt>
                  <dd>{packageInfo.version} · local development preview</dd>
                </div>
                <div>
                  <dt>Engine adapter</dt>
                  <dd>OpenCodeLocalRuntime</dd>
                </div>
                <div>
                  <dt>SDK dependency</dt>
                  <dd>{packageInfo.dependencies['@opencode-ai/sdk']}</dd>
                </div>
              </dl>
              {health.loading ? (
                <Loading label="Loading runtime information" />
              ) : health.error ? (
                <ErrorState message={health.error} retry={health.reload} />
              ) : (
                <>
                  <Badge tone={health.data?.runtime.status === 'ready' ? 'success' : 'warning'}>
                    Runtime {health.data?.runtime.status}
                  </Badge>
                  <p>
                    Running engine version: not independently reported by the current adapter. SDK
                    version is not proof of the installed CLI version.
                  </p>
                </>
              )}
              <Button secondary onClick={health.reload}>
                Refresh runtime information
              </Button>
            </Panel>
          </section>
        </div>
      </div>
    </>
  )
}
