import { useId, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AtlasMark } from '../components'
import { Button, Dialog } from '../components/ui'
import { authenticate, register } from '../services/api'
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
  function update<K extends keyof AccountFields>(field: K, value: AccountFields[K]) {
    setFields((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setError('')
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
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
      await (signup ? register() : authenticate())
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
        <p>Your projects, coding sessions and local agent in one focused place.</p>
        <div className="auth-status">
          <strong>Local preview. No account required.</strong>
          <p>
            Authentication and account creation are not enabled. These forms validate locally; no
            credentials are sent or stored.
          </p>
          <Button href="/dashboard" secondary>
            Explore the local workspace →
          </Button>
        </div>
      </aside>
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">Atlas / Account</p>
        <h2 id="auth-title">{signup ? 'Create an account' : 'Sign in'}</h2>
        <p className="muted">
          {signup
            ? 'Account creation is being prepared for a future release.'
            : 'Account sign-in will be available when authentication is connected.'}
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
                Use at least 12 characters. Do not enter a password you use elsewhere in this
                preview.
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
                    I acknowledge the local preview limitations. Account creation is not enabled.
                  </span>
                </label>
                <button type="button" className="text-button" onClick={() => setTerms(true)}>
                  Read the account & terms status
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
          <Button type="submit" disabled={busy} className="full-width">
            {busy
              ? 'Checking availability…'
              : signup
                ? 'Create account — not enabled'
                : 'Sign in — not enabled'}
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
        title="Password reset is not enabled"
      >
        <p>
          Atlas has no account authentication backend, so it cannot send password-reset emails. No
          request has been sent.
        </p>
        <Button href="/dashboard" secondary>
          Open the local workspace
        </Button>
      </Dialog>
      <Dialog open={terms} onClose={() => setTerms(false)} title="Account & terms status">
        <p>
          No account service or commercial terms have been established for this development preview.
          The acknowledgement is not acceptance of invented legal documents.
        </p>
        <p>
          Use Atlas only with a trusted local workspace. Do not submit secrets or production
          credentials.
        </p>
        <Button href="/docs/security" secondary>
          Read execution limitations
        </Button>
      </Dialog>
    </div>
  )
}
