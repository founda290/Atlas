import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, PageHeader, Panel } from '../components/ui'
import { useAccount } from '../hooks/account'
import { account } from '../services/account'
export function AccountPanel() {
  const { user, loading, error, refresh, signOut } = useAccount(),
    [notice, setNotice] = useState(''),
    [failure, setFailure] = useState(''),
    [busy, setBusy] = useState(false)
  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true)
    setFailure('')
    try {
      await action()
      setNotice(message)
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Account request failed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageHeader
        title="Your account"
        eyebrow="Account / Neon Auth"
        description="Identity is separate from project storage and execution."
      />
      <div className="app-page-body">
        <Panel title="Account session">
          {loading ? (
            <p role="status">Checking your session…</p>
          ) : user ? (
            <>
              <h3>{user.name}</h3>
              <p>{user.email}</p>
              <p>Email {user.emailVerified ? 'verified' : 'not yet verified'}</p>
              {!user.emailVerified && (
                <Button
                  secondary
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => account.verify(user.email),
                      'Verification email requested. Check your inbox.',
                    )
                  }
                >
                  Send verification email
                </Button>
              )}
              <Button
                secondary
                disabled={busy}
                onClick={() =>
                  void run(signOut, 'Signed out. Browser-local projects remain on this device.')
                }
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
              <p>
                {account.configured
                  ? 'You are not signed in.'
                  : 'Neon Auth is not configured in this deployment.'}
              </p>
              <Button href="/signup">Create an account</Button>{' '}
              <Button secondary href="/login">
                Sign in
              </Button>
            </>
          )}
          {(failure || error) && (
            <p className="error-state" role="alert">
              {failure || error}
            </p>
          )}
          {notice && <p role="status">{notice}</p>}
          <Button secondary disabled={loading || busy} onClick={() => void refresh()}>
            Refresh account session
          </Button>
        </Panel>
        <Panel title="Where your work lives">
          <p>
            Signing out does not erase browser projects. Anyone using this browser profile can
            access them. Export important work before clearing site data. Accounts do not sync
            browser-local files.
          </p>
          <Link className="text-link" to="/browser-projects">
            Browser-local projects →
          </Link>
          <p>Cloud projects and remote execution are currently disabled.</p>
          <Link className="text-link" to="/cloud-projects">
            Cloud readiness →
          </Link>
        </Panel>
      </div>
    </>
  )
}
export function ResetPasswordPage() {
  const [params, setParams] = useSearchParams(),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [error, setError] = useState(''),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false)
  const token = params.get('token') ?? ''
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!token) {
      setError('This reset link is missing its token. Request a new email.')
      return
    }
    if (password.length < 12 || password.length > 128 || password !== confirm) {
      setError('Use 12–128 characters and matching passwords.')
      return
    }
    setBusy(true)
    try {
      await account.reset(token, password)
      setPassword('')
      setConfirm('')
      setParams({}, { replace: true })
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Password reset failed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="auth-card" style={{ margin: '4rem auto', maxWidth: 520 }}>
      <h1>Choose a new password</h1>
      {done ? (
        <p role="status">
          Your password was changed. <Link to="/login">Sign in</Link> with the new password.
        </p>
      ) : (
        <form onSubmit={(event) => void submit(event)}>
          <label className="form-field">
            New password
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="form-field">
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="error-state">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy || done}>
            Reset password
          </Button>
        </form>
      )}
      <Link to="/login?reset=true">Request another reset link</Link>
    </section>
  )
}
