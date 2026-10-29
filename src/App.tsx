import { SiteHeader, SiteFooter, Section, TextSkeleton, ButtonSkeleton, FeatureCard, IntegrationCard, ProductPreview, AppShell } from './components'

const features = ['AI coding sessions', 'Model providers and BYOK', 'Project and file management', 'MCP and CLI integrations', 'Execution and change review', 'Session persistence']
const integrations = ['AI providers', 'Model selection', 'MCP servers', 'CLI tools', 'Git repositories', 'Other connectors']

function Landing() {
  return <><SiteHeader /><main><section className="hero"><div className="page-container"><div className="hero-copy"><p className="eyebrow">Structural product scaffold</p><h1><span className="headline-placeholder">Headline placeholder with deliberate width for future product messaging</span></h1><TextSkeleton lines={4} width="94%" /><div className="hero-actions"><ButtonSkeleton href="/signup">Primary CTA placeholder</ButtonSkeleton><ButtonSkeleton href="/docs" secondary>Secondary CTA placeholder</ButtonSkeleton></div></div><div className="trust"><div className="trust-row"><div className="avatars">{[1,2,3,4,5].map(i => <span key={i} className="avatar" aria-hidden="true" />)}</div><TextSkeleton width="35%" lines={2} /></div></div></div></section><Section className="preview-section" eyebrow="Product preview"><ProductPreview /></Section><Section eyebrow="Capability overview" title="Section heading placeholder"><TextSkeleton width="55%" lines={2} /><div className="feature-grid">{features.map((feature, i) => <FeatureCard key={feature} index={i + 1} title={feature} />)}</div></Section><Section className="workflow" eyebrow="Workflow"><div className="workflow-grid">{['First structural step', 'Second structural step', 'Third structural step', 'Fourth structural step'].map((step, i) => <article className="workflow-step" key={step}><div className="step-number">0{i + 1}</div><h3>{step}</h3><TextSkeleton lines={3} /><div className="step-preview" /></article>)}</div></Section><Section eyebrow="Integrations preview" title="Connector structure placeholder"><div className="integration-grid">{integrations.map(item => <IntegrationCard key={item} label={item} />)}</div></Section><Section className="final-cta"><div className="cta-box"><h2>Final call-to-action heading placeholder</h2><TextSkeleton width="60%" lines={2} /><ButtonSkeleton href="/signup">Primary action placeholder</ButtonSkeleton></div></Section></main><SiteFooter /></>
}

function PublicPage({ title }: { title: string }) { return <><SiteHeader /><main className="basic-page"><PageHeading title={title} /><div className="page-placeholder"><TextSkeleton lines={5} /><div className="placeholder-grid"><div /><div /><div /></div></div></main><SiteFooter /></> }
function PageHeading({ title }: { title: string }) { return <div className="page-heading"><p className="eyebrow">Structural route placeholder</p><h1>{title}</h1><TextSkeleton width="64%" lines={2} /></div> }
function AppPage({ title, active }: { title: string; active: string }) { return <AppShell active={active}><PageHeading title={title} /><div className="app-content-grid"><div className="content-panel"><h2>Primary content region</h2><TextSkeleton lines={6} /></div><aside className="context-panel"><h2>Contextual panel</h2><TextSkeleton lines={5} /></aside></div></AppShell> }

export default function App() {
  const path = window.location.pathname
  if (path === '/') return <Landing />
  if (path.startsWith('/dashboard')) return <AppPage title="Dashboard" active="dashboard" />
  if (path === '/projects' || path.startsWith('/projects/')) return <AppPage title={path.includes('/sessions/') ? 'Agent session' : path === '/projects' ? 'Projects' : 'Project workspace'} active="projects" />
  if (path === '/models') return <AppPage title="Models" active="models" />
  if (path === '/integrations/manage') return <AppPage title="Manage integrations" active="integrations" />
  if (path === '/settings') return <AppPage title="Settings" active="settings" />
  const titles: Record<string, string> = { '/features': 'Product capabilities', '/integrations': 'Providers and integrations', '/pricing': 'Pricing structure', '/docs': 'Documentation entry point', '/login': 'Authentication entry point', '/signup': 'Account creation entry point' }
  return <PublicPage title={titles[path] ?? 'Route placeholder'} />
}
