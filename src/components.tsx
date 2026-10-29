import { useState, type ReactNode } from 'react'

export const navItems = [
  ['/features', 'Features'], ['/integrations', 'Integrations'], ['/pricing', 'Pricing'], ['/docs', 'Docs'],
]

export function PageContainer({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`page-container ${className}`}>{children}</div>
}

export function TextSkeleton({ width = '100%', lines = 1, className = '' }: { width?: string; lines?: number; className?: string }) {
  return <div className={`text-skeleton ${className}`} aria-hidden="true">{Array.from({ length: lines }, (_, index) => <span key={index} style={{ width: index === lines - 1 && lines > 1 ? '78%' : width }} />)}</div>
}

export function ButtonSkeleton({ children, secondary = false, href }: { children: ReactNode; secondary?: boolean; href?: string }) {
  return href ? <a className={`button-skeleton ${secondary ? 'secondary' : ''}`} href={href}>{children}</a> : <button className={`button-skeleton ${secondary ? 'secondary' : ''}`}>{children}</button>
}

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  return <header className="site-header">
    <PageContainer className="header-inner">
      <a className="wordmark" href="/" aria-label="Atlas home"><span className="logo-placeholder" aria-hidden="true" /> <span>Product name</span></a>
      <nav className="desktop-nav" aria-label="Primary navigation">{navItems.map(([href, label]) => <a href={href} key={href}>{label}</a>)}<a href="/integrations">Providers / integrations</a></nav>
      <div className="header-actions"><a className="sign-in" href="/login">Sign in</a><ButtonSkeleton href="/signup">Primary account action</ButtonSkeleton><button className="menu-control" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>Menu</button></div>
      {open && <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation">{navItems.map(([href, label]) => <a href={href} key={href}>{label}</a>)}<a href="/integrations">Providers / integrations</a><a href="/login">Sign in</a><a href="/signup">Create account</a></nav>}
    </PageContainer>
  </header>
}

export function SiteFooter() {
  const groups = ['Product', 'Integrations', 'Documentation', 'Account', 'Legal']
  return <footer className="site-footer"><PageContainer><div className="footer-grid">{groups.map(group => <div key={group}><h3>{group}</h3><TextSkeleton width="72%" lines={4} /></div>)}</div><div className="footer-base"><span>Product name placeholder</span><span>Footer metadata placeholder</span></div></PageContainer></footer>
}

export function Section({ eyebrow, title, children, className = '' }: { eyebrow?: string; title?: string; children: ReactNode; className?: string }) {
  return <section className={`section ${className}`}><PageContainer>{eyebrow && <p className="eyebrow">{eyebrow}</p>}{title && <h2>{title}</h2>}{children}</PageContainer></section>
}

export function FeatureCard({ index, title = 'Capability card' }: { index: number; title?: string }) {
  return <article className="feature-card"><div className="card-index">0{index}</div><h3>{title}</h3><TextSkeleton lines={3} width="90%" /></article>
}

export function IntegrationCard({ label }: { label: string }) { return <div className="integration-card"><span className="integration-mark" aria-hidden="true" /> <span>{label}</span></div> }

export function ProductPreview() {
  return <div className="product-preview" aria-label="Static workspace structure placeholder"><div className="preview-header"><span className="mini-mark" /> <TextSkeleton width="18%" /> <span className="status-placeholder">Execution status</span></div><div className="preview-body"><aside className="preview-files"><span>Project navigation</span>{['Folder placeholder', 'File placeholder', 'File placeholder', 'Folder placeholder'].map(item => <div key={item}>{item}</div>)}</aside><div className="preview-editor"><span>Main code / editor area</span><div className="code-lines">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ width: `${42 + (i % 4) * 12}%` }} />)}</div><div className="terminal-panel">Terminal / execution output</div></div><aside className="preview-agent"><span>Agent conversation panel</span><TextSkeleton lines={5} /></aside></div></div>
}

export function AppSidebar({ active }: { active: string }) {
  const items = ['Dashboard', 'Projects', 'Models', 'Integrations', 'Settings']
  return <aside className="app-sidebar"><div className="sidebar-title"><span className="logo-placeholder" /> Product name</div><nav aria-label="Application navigation">{items.map(item => <a className={item.toLowerCase() === active ? 'active' : ''} href={`/${item.toLowerCase()}`} key={item}>{item}</a>)}</nav><div className="sidebar-status">Workspace status placeholder</div><a className="account-entry" href="/settings">Account / settings</a></aside>
}

export function AppShell({ children, active }: { children: ReactNode; active: string }) {
  const [drawer, setDrawer] = useState(false)
  return <div className="app-shell"><header className="app-header"><button className="menu-control" onClick={() => setDrawer(!drawer)} aria-expanded={drawer} aria-label="Toggle application navigation">Menu</button><span>Workspace header placeholder</span><span className="app-account">Account placeholder</span></header>{drawer && <div className="drawer"><AppSidebar active={active} /></div>}<AppSidebar active={active} /><main className="app-main">{children}</main></div>
}
