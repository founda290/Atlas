import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Icon } from '../ui'
import { trapDialogFocus } from '../ui/focus'
export function NavigationDrawer({
  label,
  children,
  app = false,
}: {
  label: string
  children: ReactNode
  app?: boolean
}) {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const location = useLocation()
  const id = useId()
  useEffect(() => {
    setOpen(false)
    dialog.current?.close()
  }, [location.pathname, location.search])
  useEffect(() => {
    const media = window.matchMedia('(min-width: 901px)')
    const close = () => {
      if (media.matches) setOpen(false)
    }
    media.addEventListener('change', close)
    return () => media.removeEventListener('change', close)
  }, [])
  useEffect(() => {
    if (open) {
      dialog.current?.showModal()
      document.body.style.overflow = 'hidden'
    } else {
      dialog.current?.close()
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])
  return (
    <>
      <button
        type="button"
        className="navigation-trigger icon-button"
        aria-label={label}
        aria-controls={id}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Icon name="menu" />
      </button>
      <dialog
        id={id}
        ref={dialog}
        onKeyDown={trapDialogFocus}
        className={`navigation-dialog ${app ? 'app-navigation-dialog' : ''}`}
        aria-label={label}
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
      >
        <div className="dialog-heading">
          <strong>Atlas / Navigation</strong>
          <button
            type="button"
            className="icon-button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </dialog>
    </>
  )
}
