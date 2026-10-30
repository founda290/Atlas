import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button, PageHeader, Panel } from '../components/ui'
import { usePreferences, type Preferences } from '../hooks/preferences'
import packageInfo from '../../package.json'

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
      setNotice('Preferences saved in this browser. No account or server settings were changed.')
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
        title="Your preferences."
        description="Display settings stay in this browser. Account identity and hosted service availability are separate."
      />
      <div className="app-page-body settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {['General', 'Appearance', 'Availability', 'About'].map((label) => (
            <a href={`#settings-${label.toLowerCase()}`} key={label}>
              {label}
            </a>
          ))}
        </nav>
        <div className="settings-content">
          <section id="settings-general">
            <Panel title="General" eyebrow="Your workspace">
              <div className="settings-row">
                <div>
                  <h3>Account</h3>
                  <p>
                    Review your sign-in, email verification and sign-out status. Account login does
                    not upload browser-local projects.
                  </p>
                </div>
              </div>
              <Link className="text-link" to="/account">
                Manage account →
              </Link>
              <div className="settings-row">
                <div>
                  <h3>Projects</h3>
                  <p>
                    Browser-local projects are optional source editing and backup storage. They do
                    not run an AI agent or sync between devices.
                  </p>
                </div>
              </div>
              <Link className="text-link" to="/browser-projects">
                View projects on this browser →
              </Link>
            </Panel>
          </section>
          <form onSubmit={submit}>
            <section id="settings-appearance">
              <Panel title="Appearance" eyebrow="Browser preferences">
                <div className="settings-row">
                  <label htmlFor="workspace-theme">
                    <strong id="theme-label">Workspace theme</strong>
                    <span id="theme-description">Choose a dark or light application theme.</span>
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
                    <span id="density-description">Adjust spacing in the application.</span>
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
                  <span>Wrap code blocks in messages</span>
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
          <section id="settings-availability">
            <Panel title="Service availability" eyebrow="No simulated execution">
              <p>
                Hosted AI chat and cloud execution are not available yet. The chat composer remains
                disabled until a real isolated worker and its safety controls are deployed.
              </p>
              <Link className="text-link" to="/cloud-projects">
                Read the current availability boundary →
              </Link>
            </Panel>
          </section>
          <section id="settings-about">
            <Panel title="About Atlas" eyebrow="Application information">
              <dl className="detail-list">
                <div>
                  <dt>Version</dt>
                  <dd>{packageInfo.version}</dd>
                </div>
                <div>
                  <dt>Account provider</dt>
                  <dd>Neon Auth · live acceptance pending</dd>
                </div>
                <div>
                  <dt>Hosted execution</dt>
                  <dd>Not deployed</dd>
                </div>
              </dl>
            </Panel>
          </section>
        </div>
      </div>
    </>
  )
}
