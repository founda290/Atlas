import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'
import { trapDialogFocus } from './focus'

export function Button({
  href,
  secondary = false,
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { href?: string; secondary?: boolean }) {
  const classes = `atlas-button ${secondary ? 'secondary' : ''} ${className}`
  return href ? (
    <Link className={classes} to={href}>
      {children}
    </Link>
  ) : (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  )
}
export function Panel({
  title,
  eyebrow,
  children,
  className = '',
  action,
}: {
  title: string
  eyebrow?: string
  children: ReactNode
  className?: string
  action?: ReactNode
}) {
  const id = useId()
  return (
    <section className={`work-panel ${className}`} aria-labelledby={id}>
      {eyebrow && <span className="panel-eyebrow">{eyebrow}</span>}
      <div className="panel-heading">
        <h2 id={id}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'warning'
}) {
  return (
    <span className={`badge badge-${tone}`}>
      <span aria-hidden="true" />
      {children}
    </span>
  )
}
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{children}</p>
      {action && <div>{action}</div>}
    </div>
  )
}
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <strong>Unable to load this information</strong>
      <p>{message}</p>
      {retry && (
        <Button secondary onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  )
}
export function Loading({ label = 'Loading information' }: { label?: string }) {
  return (
    <div role="status" className="loading-state">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="loading-bars">
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}
export function PageHeader({
  title,
  eyebrow,
  description,
  action,
}: {
  title: string
  eyebrow: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-heading-copy">{description}</p>
      </div>
      {action && <div className="page-heading-action">{action}</div>}
    </div>
  )
}
export function SearchInput({
  label = 'Search',
  value,
  onChange,
  placeholder,
}: {
  label?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const id = useId()
  return (
    <div className="search-field">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Icon name="search" />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? label}
      />
    </div>
  )
}
export function Dialog({
  open,
  onClose,
  title,
  children,
  dismissible = true,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  dismissible?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal()
    else if (!open) ref.current?.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onKeyDown={trapDialogFocus}
      className="atlas-dialog"
      aria-labelledby={id}
      onCancel={(event) => {
        if (!dismissible) event.preventDefault()
        else onClose()
      }}
      onClose={onClose}
    >
      <div className="dialog-heading">
        <h2 id={id}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close dialog"
          disabled={!dismissible}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  )
}
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: { id: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map((item, index) => (
        <button
          ref={(node) => {
            buttons.current[index] = node
          }}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          tabIndex={value === item.id ? 0 : -1}
          key={item.id}
          onClick={() => onChange(item.id)}
          onKeyDown={(event) => {
            let next = index
            if (event.key === 'ArrowRight') next = (index + 1) % items.length
            else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length
            else if (event.key === 'Home') next = 0
            else if (event.key === 'End') next = items.length - 1
            else return
            event.preventDefault()
            onChange(items[next].id)
            buttons.current[next]?.focus()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
export function CodeBlock({ code, language = 'text' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState('')
  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(''), 3000)
    return () => clearTimeout(timeout)
  }, [copied])
  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied('Copied')
    } catch {
      setCopied('Copy unavailable. Select the text to copy.')
    }
  }
  return (
    <div className="code-block">
      <div className="code-block-head">
        <span>{language}</span>
        <button type="button" onClick={() => void copy()}>
          {copied === 'Copied' ? 'Copied' : 'Copy code'}
        </button>
      </div>
      <pre>
        <code className={`language-${language}`}>{code}</code>
      </pre>
      <span role="status" className="sr-only">
        {copied}
      </span>
    </div>
  )
}
const paths = {
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M18 6 6 18',
  chat: 'M4 5h16v11H8l-4 4zM8 9h8M8 12h5',
  dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  folder: 'M3 7V4h6l2 3h10v13H3z',
  model: 'm12 3 9 9-9 9-9-9zM12 3v18M3 12h18',
  integration: 'M8 3v5m8-5v5M5 8h14v3a7 7 0 0 1-14 0zM12 18v4',
  settings:
    'M12 3v3m0 12v3M3 12h3m12 0h3M5.5 5.5l2 2m9 9 2 2m0-13-2 2m-9 9-2 2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  search: 'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  file: 'M5 3h9l5 5v13H5zM14 3v6h5M8 13h8M8 17h5',
  plus: 'M12 4v16M4 12h16',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
} as const
export type IconName = keyof typeof paths
export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="ui-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}
