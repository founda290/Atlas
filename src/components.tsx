import { useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { NavigationDrawer } from './components/layout/NavigationDrawer'
import { Button, Icon, type IconName } from './components/ui'
import { usePreferences } from './hooks/preferences'
import { AgentEmpty, EditorEmpty } from './features/workspace/WorkspaceStates'
export { Button, Panel } from './components/ui'

export const navItems = [
  ['/features', 'Features'],
  ['/integrations', 'Integrations'],
  ['/pricing', 'Pricing'],
  ['/docs', 'Docs'],
] as const
export function AtlasMark({ small = false }: { small?: boolean }) {
  return (
    <img
      className={`atlas-mark ${small ? 'small' : ''}`}
      src="/atlas-mark.svg"
      alt=""
      aria-hidden="true"
    />
  )
}
export function PageContainer({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`page-container ${className}`}>{children}</div>
}
function PublicNavigation() {
  return (
    <>
      {navItems.map(([href, label]) => (
        <NavLink to={href} key={href}>
          {label}
        </NavLink>
      ))}
      <Link to="/login">Sign in</Link>
      <Link to="/dashboard">Open workspace</Link>
    </>
  )
}
export function SiteHeader() {
  return (
    <header className="site-header">
      <PageContainer className="header-inner">
        <Link className="wordmark" to="/" aria-label="Atlas home">
          <AtlasMark />
          <span>Atlas</span>
        </Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {navItems.map(([href, label]) => (
            <NavLink to={href} key={href}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          <Link className="sign-in" to="/login">
            Sign in
          </Link>
          <Button href="/dashboard">
            Open workspace <span aria-hidden="true">↗</span>
          </Button>
          <NavigationDrawer label="Open site navigation">
            <nav aria-label="Mobile primary navigation">
              <PublicNavigation />
            </nav>
          </NavigationDrawer>
        </div>
      </PageContainer>
    </header>
  )
}
export function SiteFooter() {
  const groups = [
    {
      title: 'Product',
      links: [
        ['Features', '/features'],
        ['Early access', '/pricing'],
        ['Workspace', '/dashboard'],
      ],
    },
    {
      title: 'Resources',
      links: [
        ['Integrations', '/integrations'],
        ['Documentation', '/docs'],
        ['Security', '/docs/security'],
      ],
    },
    {
      title: 'Account',
      links: [
        ['Sign in', '/login'],
        ['Create account', '/signup'],
      ],
    },
  ]
  return (
    <footer className="site-footer">
      <PageContainer>
        <div className="footer-top">
          <div>
            <Link className="wordmark" to="/">
              <AtlasMark small />
              <span>Atlas</span>
            </Link>
            <p>A browser-based coding workspace for thoughtful software work.</p>
          </div>
          <div className="footer-links">
            {groups.map((group) => (
              <div key={group.title}>
                <h3>{group.title}</h3>
                {group.links.map(([label, href]) => (
                  <Link to={href} key={href}>
                    {label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="footer-base">
          <span>Atlas · powered by OpenCode</span>
          <span>Local development preview · no hosted accounts or billing</span>
        </div>
      </PageContainer>
    </footer>
  )
}
export function PublicLayout() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <SiteFooter />
    </>
  )
}
export function Section({
  eyebrow,
  title,
  intro,
  children,
  className = '',
}: {
  eyebrow?: string
  title?: string
  intro?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`section ${className}`}>
      <PageContainer>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        {title && <h2>{title}</h2>}
        {intro && <p className="section-intro">{intro}</p>}
        {children}
      </PageContainer>
    </section>
  )
}
export function FeatureCard({
  index,
  title,
  description,
}: {
  index: number
  title: string
  description: string
}) {
  return (
    <article className="feature-card">
      <div className="card-index">{String(index).padStart(2, '0')}</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  )
}
export function ProductPreview() {
  return (
    <figure className="workspace-preview">
      <div className="preview-header">
        <span className="preview-project">
          <AtlasMark small /> Local workspace
        </span>
        <span className="badge">Interface preview · not connected</span>
      </div>
      <div className="product-workbench">
        <aside>
          <p className="panel-eyebrow">Explorer</p>
          <p>No inventory loaded</p>
        </aside>
        <section>
          <div className="preview-tab">Editor / illustration</div>
          <EditorEmpty />
        </section>
        <section>
          <div className="preview-tab">Agent conversation</div>
          <AgentEmpty />
        </section>
      </div>
      <figcaption>
        The same panels used in Atlas. Files and messages appear only after the local API returns
        them.
      </figcaption>
    </figure>
  )
}
const appLinks: { label: string; href: string; icon: IconName }[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
  { label: 'Projects', href: '/projects', icon: 'folder' },
  { label: 'Models', href: '/models', icon: 'model' },
  { label: 'Integrations', href: '/integrations/manage', icon: 'integration' },
  { label: 'Settings', href: '/settings', icon: 'settings' },
]
export function AppSidebar() {
  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <Link className="wordmark" to="/dashboard">
          <AtlasMark small />
          <span>Atlas</span>
        </Link>
        <span className="workspace-caption">LOCAL WORKSPACE</span>
      </div>
      <nav aria-label="Application navigation">
        {appLinks.map((item) => (
          <NavLink to={item.href} key={item.href}>
            <Icon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-guide">
        <span className="panel-eyebrow">Your environment</span>
        <p>
          Managed local workspaces.
          <br />
          Your runtime. Your machine.
        </p>
        <Link to="/docs/getting-started">
          Setup guide <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <div className="sidebar-bottom">
        <div className="connection-state">Local preview · no account required</div>
        <Link className="account-entry" to="/settings">
          <span className="account-avatar">
            <Icon name="settings" />
          </span>
          <span>
            <strong>Local developer</strong>
            <small>Preferences & runtime</small>
          </span>
        </Link>
        <Link className="back-to-site" to="/">
          Back to website <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </aside>
  )
}
export function AppShell() {
  const { preferences, save } = usePreferences()
  const [themeError, setThemeError] = useState('')
  const { pathname } = useLocation()
  const current = appLinks.find((item) => pathname.startsWith(item.href))?.label ?? 'Workspace'
  return (
    <div className={`app-shell density-${preferences.density}`} data-app-theme={preferences.theme}>
      <a className="skip-link" href="#app-content">
        Skip to content
      </a>
      <div className="desktop-sidebar">
        <AppSidebar />
      </div>
      <header className="app-header">
        <NavigationDrawer label="Open workspace navigation" app>
          <AppSidebar />
        </NavigationDrawer>
        <div className="app-header-context">
          <span>LOCAL / ATLAS</span>
          <strong>{current}</strong>
        </div>
        <div className="app-header-actions">
          <Link to="/docs" className="header-docs">
            Documentation <span aria-hidden="true">↗</span>
          </Link>
          <button
            className="icon-button"
            type="button"
            aria-label={`Use ${preferences.theme === 'dark' ? 'light' : 'dark'} workspace theme`}
            onClick={() => {
              try {
                save({ ...preferences, theme: preferences.theme === 'dark' ? 'light' : 'dark' })
                setThemeError('')
              } catch {
                setThemeError('Browser storage is unavailable. The theme was not saved.')
              }
            }}
          >
            <Icon name="sun" />
          </button>
        </div>
      </header>
      <main id="app-content" className="app-main" tabIndex={-1}>
        <Outlet />
      </main>
      {themeError && (
        <div className="theme-notice error-state" role="alert">
          {themeError}
          <button type="button" className="text-button" onClick={() => setThemeError('')}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
