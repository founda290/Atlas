import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AtlasMark } from '../components'
import { Button, Dialog } from '../components/ui'
import { account } from '../services/account'
import { useAccount } from '../hooks/account'
import { validateAccount, type AccountErrors, type AccountFields } from '../features/auth'
function PasswordField({
  label,
  value,
  onChange,
  error,
  name,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  name: string
  autoComplete: string
}) {
  const [visible, setVisible] = useState(false)
  const id = useId()
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <div className="password-field">
        <input
          id={id}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button
          type="button"
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {error && (
        <span className="field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  )
}
export function AuthPage({ signup = false }: { signup?: boolean }) {
  const { user, loading: accountLoading, refresh } = useAccount(),
    navigate = useNavigate()
  const [notice, setNotice] = useState('')
  const [fields, setFields] = useState<AccountFields>({
    name: '',
    email: '',
    password: '',
    confirm: '',
    terms: false,
  })
  const [errors, setErrors] = useState<AccountErrors>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [terms, setTerms] = useState(false)
  const [params, setParams] = useSearchParams()
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (!accountLoading && user) navigate('/chat', { replace: true })
  }, [accountLoading, user, navigate])
  function update<K extends keyof AccountFields>(field: K, value: AccountFields[K]) {
    setFields((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setError('')
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const nextErrors = validateAccount(fields, signup)
    setErrors(nextErrors)
    setError('')
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() =>
        form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      )
      return
    }
    setBusy(true)
    try {
      await (signup
        ? account.signUp(fields.name.trim(), fields.email.trim(), fields.password)
        : account.signIn(fields.email.trim(), fields.password))
      setFields((current) => ({ ...current, password: '', confirm: '' }))
      const user = await refresh()
      if (user) navigate('/chat')
      else
        setNotice(
          signup
            ? 'Your registration was accepted. Check your email for a verification link, then sign in.'
            : 'The sign-in request completed, but no session could be confirmed. Check cookie settings and try signing in again.',
        )
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Account service is unavailable.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="auth-layout">
      <aside className="auth-intro">
        <AtlasMark />
        <p className="eyebrow">A considered workspace</p>
        <h1>{signup ? 'Make room for your next idea.' : 'Back to the work that matters.'}</h1>
        <p>A focused chat workspace, with project creation optional.</p>
        <div className="auth-status">
          <strong>Your account. Your choice of workspace.</strong>
          <p>
            Sign in through Neon Auth. Browser-local projects remain on this device; signing in does
            not upload them. Cloud projects are disabled for now.
          </p>
          <Button href="/browser-projects" secondary>
            Continue to projects without an account →
          </Button>
        </div>
      </aside>
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">Atlas / Account</p>
        <h2 id="auth-title">{signup ? 'Create an account' : 'Sign in'}</h2>
        <p className="muted">
          {signup
            ? 'Create your Atlas account with email and password.'
            : 'Sign in to your Atlas account.'}
        </p>
        <form onSubmit={(event) => void submit(event)} noValidate ref={form}>
          {signup && (
            <div className="form-field">
              <label htmlFor="account-name">Name</label>
              <input
                id="account-name"
                autoComplete="name"
                value={fields.name}
                onChange={(event) => update('name', event.target.value)}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
              />
              {errors.name && (
                <span className="field-error" id="name-error">
                  {errors.name}
                </span>
              )}
            </div>
          )}
          <div className="form-field">
            <label htmlFor="account-email">Email address</label>
            <input
              id="account-email"
              type="email"
              autoComplete="email"
              value={fields.email}
              onChange={(event) => update('email', event.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            {errors.email && (
              <span className="field-error" id="email-error">
                {errors.email}
              </span>
            )}
          </div>
          <PasswordField
            name="password"
            label="Password"
            value={fields.password}
            onChange={(value) => update('password', value)}
            error={errors.password}
            autoComplete={signup ? 'new-password' : 'current-password'}
          />
          {signup ? (
            <>
              <p className="fine-print">
                Use a unique password with at least 12 characters. Passwords are sent only to your
                configured Neon Auth service.
              </p>
              <PasswordField
                name="confirm"
                label="Confirm password"
                value={fields.confirm}
                onChange={(value) => update('confirm', value)}
                error={errors.confirm}
                autoComplete="new-password"
              />
              <div className="form-field">
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={fields.terms}
                    onChange={(event) => update('terms', event.target.checked)}
                    aria-invalid={!!errors.terms}
                    aria-describedby={errors.terms ? 'terms-error' : undefined}
                  />
                  <span>
                    I understand browser-local storage and the current execution limitations.
                  </span>
                </label>
                <button type="button" className="text-button" onClick={() => setTerms(true)}>
                  Read account & data information
                </button>
                {errors.terms && (
                  <span className="field-error" id="terms-error">
                    {errors.terms}
                  </span>
                )}
              </div>
            </>
          ) : (
            <Link to="/login?reset=true" className="text-link forgot-link">
              Forgot password?
            </Link>
          )}
          {error && (
            <div className="error-state" role="alert">
              {error}
            </div>
          )}
          {notice && <p role="status">{notice}</p>}
          {!account.configured && (
            <p className="fine-print">
              Neon Auth is not configured for this deployment. Setup is required before account
              requests can be sent.
            </p>
          )}
          <Button type="submit" disabled={busy} className="full-width">
            {busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}
          </Button>
        </form>
        <p className="auth-switch">
          {signup ? 'Already have an account?' : 'New to Atlas?'}{' '}
          <Link to={signup ? '/login' : '/signup'}>{signup ? 'Sign in' : 'Create an account'}</Link>
        </p>
      </section>
      <Dialog
        open={params.get('reset') === 'true'}
        onClose={() => setParams({})}
        title="Reset your password"
      >
        <p>
          Enter your account email. If an account exists, Neon Auth will send a reset link. No
          password is changed until you use that link.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setBusy(true)
            setError('')
            void account
              .requestReset(fields.email.trim())
              .then(() =>
                setNotice('If this email is registered, check your inbox for a reset link.'),
              )
              .catch((e) => setError(e.message))
              .finally(() => setBusy(false))
          }}
        >
          <label className="form-field">
            Reset email
            <input
              type="email"
              required
              value={fields.email}
              onChange={(event) => update('email', event.target.value)}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}
          <Button type="submit" disabled={busy}>
            Send reset link
          </Button>
        </form>
      </Dialog>
      <Dialog open={terms} onClose={() => setTerms(false)} title="Account & data information">
        <p>
          Neon Auth manages account credentials and sessions. Browser-local source stays in this
          browser and is not automatically attached to your account. Cloud execution is disabled.
          This acknowledgement is not acceptance of commercial terms or a substitute for a published
          privacy policy.
        </p>
        <p>
          Use browser storage only on a trusted device. Hosted AI execution is not available yet,
          and Atlas does not currently offer a place to enter provider keys. Your account password
          is sent only to Neon Auth.
        </p>
        <Button href="/docs/security" secondary>
          Read execution limitations
        </Button>
      </Dialog>
    </div>
  )
}
