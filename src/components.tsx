import { useEffect, useState, type ReactNode } from 'react'

export const navItems = [
  ['/features', 'Features'],
  ['/integrations', 'Integrations'],
  ['/pricing', 'Pricing'],
  ['/docs', 'Docs'],
] as const

export function PageContainer({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`page-container ${className}`}>{children}</div>
}

export function ButtonSkeleton({ children, secondary = false, tertiary = false, href, className = '', onClick, disabled = false }: { children: ReactNode; secondary?: boolean; tertiary?: boolean; href?: string; className?: string; onClick?: () => void; disabled?: boolean }) {
  const classes = `button-skeleton ${secondary ? 'secondary' : ''} ${tertiary ? 'tertiary' : ''} ${className}`
  return href ? <a className={classes} href={href}>{children}</a> : <button className={classes} onClick={onClick} disabled={disabled}>{children}</button>
}

function AtlasMark({ small = false }: { small?: boolean }) {
  return <img className={`atlas-mark ${small ? 'small' : ''}`} src="/atlas-mark.svg" alt="" aria-hidden="true" />
}

function ThemeToggle() {
  const [dark, setDark] = useState(() => window.localStorage.getItem('atlas-theme') === 'dark')
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; window.localStorage.setItem('atlas-theme', dark ? 'dark' : 'light') }, [dark])
  return <button className="theme-toggle" type="button" aria-label={dark ? 'Use light theme' : 'Use dark theme'} aria-pressed={dark} onClick={() => setDark(value => !value)}><span aria-hidden="true">{dark ? '☼' : '◐'}</span></button>
}

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  return <header className="site-header">
    <PageContainer className="header-inner">
      <a className="wordmark" href="/" aria-label="Atlas home"><AtlasMark /><span>Atlas</span></a>
      <nav className="desktop-nav" aria-label="Primary navigation">{navItems.map(([href, label]) => <a href={href} key={href}>{label}</a>)}</nav>
      <div className="header-actions"><a className="sign-in" href="/login">Sign in</a><ButtonSkeleton href="/signup">Preview Atlas</ButtonSkeleton><ThemeToggle /><button className="menu-control" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}><span className="menu-icon" aria-hidden="true" /> <span className="sr-only">Toggle navigation</span></button></div>
      {open && <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation">{navItems.map(([href, label]) => <a href={href} key={href}>{label}</a>)}<a href="/integrations">Providers & integrations</a><a href="/login">Sign in</a><a className="mobile-nav-cta" href="/signup">Preview Atlas</a></nav>}
    </PageContainer>
  </header>
}

export function SiteFooter() {
  const groups = [
    ['Product', [['Features', '/features'], ['Pricing', '/pricing']]],
    ['Build with Atlas', [['Integrations', '/integrations'], ['Documentation', '/docs']]],
    ['Account', [['Sign in', '/login'], ['Preview', '/signup']]],
  ]
  return <footer className="site-footer"><PageContainer><div className="footer-top"><div><a className="wordmark" href="/"><AtlasMark small /><span>Atlas</span></a><p>A browser-based coding workspace for thoughtful software work.</p></div><div className="footer-links">{groups.map(([group, links]) => <div key={group as string}><h3>{group}</h3>{(links as string[][]).map(([label, href]) => <a href={href} key={href}>{label}</a>)}</div>)}</div></div><div className="footer-base"><span>Atlas · powered by OpenCode</span><span>Interface preview, not a connected service</span></div></PageContainer></footer>
}

export function Section({ eyebrow, title, intro, children, className = '' }: { eyebrow?: string; title?: string; intro?: string; children: ReactNode; className?: string }) {
  return <section className={`section ${className}`}><PageContainer>{eyebrow && <p className="eyebrow">{eyebrow}</p>}{title && <h2>{title}</h2>}{intro && <p className="section-intro">{intro}</p>}{children}</PageContainer></section>
}

export function FeatureCard({ index, title, description }: { index: number; title: string; description: string }) {
  return <article className="feature-card"><div className="card-index">0{index}</div><h3>{title}</h3><p>{description}</p></article>
}

export function IntegrationCard({ label, detail }: { label: string; detail: string }) {
  return <div className="integration-card"><span className="integration-mark" aria-hidden="true" /><div><strong>{label}</strong><span>{detail}</span></div></div>
}

export function ProductPreview() {
  return <div className="product-preview" aria-label="Illustrative coding workspace preview"><div className="preview-header"><span className="preview-project"><AtlasMark small /> atlas-project</span><span className="preview-status"><i /> Preview mode</span></div><div className="preview-body"><aside className="preview-files"><span className="preview-label">Files</span><strong>atlas-project</strong>{['src', 'App.tsx', 'components', 'styles.css', 'README.md'].map((item, i) => <div className={i === 1 ? 'selected' : ''} key={item}><span className="file-dot" />{item}</div>)}</aside><div className="preview-editor"><div className="editor-tabs"><span className="active">App.tsx</span><span>styles.css</span><span>README.md</span></div><div className="code-lines"><i style={{ width: '35%' }} /><i style={{ width: '62%' }} /><i style={{ width: '48%' }} /><i style={{ width: '75%' }} /><i style={{ width: '57%' }} /><i style={{ width: '69%' }} /><i style={{ width: '31%' }} /></div><div className="terminal-panel"><span>Terminal</span><p>$ awaiting a workspace session</p><small>Illustrative output only</small></div></div><aside className="preview-agent"><span className="preview-label">Agent panel</span><div className="agent-note">A calm place to shape the next change.</div><div className="agent-line" /><div className="agent-line short" /><span className="preview-label model-label">Model</span><strong>Provider selection</strong></aside></div></div>
}

export function AppSidebar({ active }: { active: string }) {
  const items = [['Dashboard', '/dashboard'], ['Projects', '/projects'], ['Models', '/models'], ['Integrations', '/integrations/manage'], ['Settings', '/settings']]
  return <aside className="app-sidebar"><div className="sidebar-brand"><a className="wordmark" href="/dashboard"><AtlasMark small /><span>Atlas</span></a><span className="workspace-caption">WORKSPACE</span></div><nav aria-label="Application navigation">{items.map(([label, href]) => <a className={label.toLowerCase() === active ? 'active' : ''} href={href} key={href}><span className={`nav-glyph glyph-${label.toLowerCase()}`} aria-hidden="true" />{label}</a>)}</nav><div className="sidebar-bottom"><div className="connection-state"><i /> Preview environment</div><a className="account-entry" href="/settings"><span className="account-avatar">A</span><span><strong>Account</strong><small>Settings & access</small></span></a></div></aside>
}

export function AppShell({ children, active }: { children: ReactNode; active: string }) {
  const [drawer, setDrawer] = useState(false)
  return <div className="app-shell"><header className="app-header"><button className="app-menu-control" onClick={() => setDrawer(!drawer)} aria-expanded={drawer} aria-label="Toggle application navigation"><span className="menu-icon" /></button><div className="app-header-context"><span>Workspace</span><strong>Atlas project environment</strong></div><div className="app-account-mobile"><ThemeToggle /><span className="account-avatar">A</span></div></header>{drawer && <div className="drawer"><AppSidebar active={active} /></div>}<AppSidebar active={active} /><main className="app-main">{children}</main></div>
}

export function Panel({ title, eyebrow, children, className = '' }: { title: string; eyebrow?: string; children: ReactNode; className?: string }) {
  return <section className={`work-panel ${className}`}>{eyebrow && <span className="panel-eyebrow">{eyebrow}</span>}<div className="panel-heading"><h2>{title}</h2><span className="panel-more">•••</span></div>{children}</section>
}
