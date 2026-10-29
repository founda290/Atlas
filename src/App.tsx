import { AppShell, ButtonSkeleton, FeatureCard, IntegrationCard, Panel, ProductPreview, Section, SiteFooter, SiteHeader } from './components'

const features = [
  ['AI-assisted coding', 'A focused space for asking, shaping and reviewing code changes with an agent.'],
  ['Provider and model choice', 'Keep model selection visible so future provider decisions stay in your hands.'],
  ['Project and file management', 'A clear home for projects, files and the context your work depends on.'],
  ['MCP and CLI extensibility', 'Leave room for the tools and connectors that make a coding environment yours.'],
  ['Execution review', 'See the proposed change, its context and its consequences before anything runs.'],
  ['Persistent sessions', 'Return to a thread of work without losing the decisions that shaped it.'],
] as const
const integrations = [
  ['AI providers', 'Provider slots'], ['MCP servers', 'Tool connections'], ['CLI tools', 'Local workflows'], ['Git repositories', 'Source control'], ['Future connectors', 'Extensible by design'],
]

function Landing() {
  return <><SiteHeader /><main><section className="hero"><div className="page-container"><div className="hero-copy"><p className="eyebrow">A quieter way to build</p><h1>Make room for <em>better code.</em></h1><p className="hero-lede">Atlas is a browser-based AI coding workspace powered by OpenCode — designed to help you think, change and review software with care.</p><div className="hero-actions"><ButtonSkeleton href="/docs">Explore the preview <span aria-hidden="true">↗</span></ButtonSkeleton><ButtonSkeleton href="/features" secondary>See how it is structured <span aria-hidden="true">→</span></ButtonSkeleton></div></div><div className="trust"><div className="principles"><span className="principle-dot" /><span>Designed for deliberate work, clear context and human review.</span></div><span className="principle-note">No connected account required to explore the interface.</span></div></div></section><Section className="preview-section" eyebrow="The workspace, at a glance"><ProductPreview /></Section><Section eyebrow="What Atlas makes room for" title="The useful parts of an AI coding workspace, without the noise." intro="A structural preview of the capabilities Atlas is being designed around. Nothing here implies an active connection or running agent."><div className="feature-grid">{features.map(([title, description], i) => <FeatureCard key={title} index={i + 1} title={title} description={description} />)}</div></Section><Section className="workflow" eyebrow="A considered workflow" title="From intention to reviewed change."><div className="workflow-grid">{[['01', 'Set the context', 'Start with the project, files and constraints that matter.'], ['02', 'Shape the change', 'Use a focused agent conversation to explore a direction.'], ['03', 'Review the result', 'Keep the human decision visible before work moves forward.'], ['04', 'Keep the thread', 'Leave a durable path back to the decisions behind the code.']].map(([number, title, description]) => <article className="workflow-step" key={number}><div className="step-number">{number}</div><h3>{title}</h3><p>{description}</p><div className="step-preview"><span /></div></article>)}</div></Section><Section eyebrow="Designed to connect later" title="A deliberate place for your tools." intro="Atlas leaves the boundaries open for providers, servers and repositories without pretending they are connected today."><div className="integration-grid">{integrations.map(([label, detail]) => <IntegrationCard key={label} label={label} detail={detail} />)}</div></Section><Section className="final-cta"><div className="cta-box"><p className="eyebrow">A work in progress, intentionally</p><h2>See the shape of what comes next.</h2><p>Explore the interface architecture before the product gains its working connections.</p><ButtonSkeleton href="/docs">Read the documentation <span aria-hidden="true">↗</span></ButtonSkeleton></div></Section></main><SiteFooter /></>
}

function PublicPage({ title, description }: { title: string; description: string }) {
  return <><SiteHeader /><main className="basic-page"><div className="page-heading"><p className="eyebrow">Atlas / {title}</p><h1>{title}</h1><p>{description}</p></div><div className="page-placeholder"><div className="placeholder-note"><span className="atlas-mark small" aria-hidden="true" /><div><strong>This route is part of the Phase 1 interface.</strong><p>Its structure is ready for future product work; no connected service or account action is simulated here.</p></div></div><div className="placeholder-grid"><div /><div /><div /></div></div></main><SiteFooter /></>
}

function PageHeading({ title, eyebrow = 'Workspace' }: { title: string; eyebrow?: string }) { return <div className="page-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-heading-copy">A focused place to prepare the next step. Functional connections will arrive in a later phase.</p></div> }

function DashboardPage() {
  return <AppShell active="dashboard"><PageHeading title="Good work starts with context." /><div className="dashboard-grid"><Panel title="Start a project" eyebrow="Next step" className="start-panel"><p>Bring a codebase into a workspace when the project connection is ready.</p><ButtonSkeleton>Project action placeholder <span aria-hidden="true">+</span></ButtonSkeleton></Panel><Panel title="Recent projects" eyebrow="Projects"><div className="empty-state"><strong>No projects connected yet.</strong><span>Project entries will appear here when workspace provisioning is available.</span></div></Panel><Panel title="Recent sessions" eyebrow="Sessions"><div className="empty-state"><strong>No sessions to show.</strong><span>Session history will live here once an agent connection exists.</span></div></Panel><Panel title="Setup path" eyebrow="Environment"><div className="setup-list"><div><i />Project connection<span>Not configured</span></div><div><i />Model provider<span>Not configured</span></div><div><i />Tool access<span>Not configured</span></div></div></Panel></div></AppShell>
}

function WorkspacePage({ session = false }: { session?: boolean }) {
  return <AppShell active="projects"><PageHeading title={session ? 'Agent session' : 'Project workspace'} eyebrow={session ? 'Sessions / Preview' : 'Projects / Preview'} /><div className="workspace-layout"><aside className="workspace-files work-panel"><span className="panel-eyebrow">Project files</span><h2>atlas-project</h2>{['src', 'App.tsx', 'components.tsx', 'styles.css', 'README.md'].map((file, i) => <div className={i === 1 ? 'file-row selected' : 'file-row'} key={file}><span className="file-dot" />{file}</div>)}</aside><Panel title="Editor placeholder" eyebrow="App.tsx" className="editor-panel"><div className="large-code-lines">{Array.from({ length: 13 }, (_, i) => <i key={i} style={{ width: `${34 + (i % 5) * 11}%` }} />)}</div></Panel><Panel title="Agent conversation" eyebrow="Preview panel" className="agent-panel"><p className="muted-copy">A future conversation will appear here once an OpenCode session is connected.</p><div className="agent-placeholder" /><ButtonSkeleton secondary>Session action placeholder</ButtonSkeleton></Panel><Panel title="Terminal output" eyebrow="Execution" className="terminal-work-panel"><p className="terminal-copy">$ awaiting workspace connection</p></Panel><Panel title="Change review" eyebrow="Diff region" className="changes-panel"><div className="empty-state"><strong>No pending changes.</strong><span>Review surfaces are ready for a future execution phase.</span></div></Panel></div></AppShell>
}

function AppPage({ title, active }: { title: string; active: string }) {
  return <AppShell active={active}><PageHeading title={title} /><div className="app-content-grid"><Panel title="Primary content region" eyebrow="Workspace"><div className="empty-state"><strong>This section is ready for product data.</strong><span>It remains a visual placeholder until the corresponding service is implemented.</span></div></Panel><Panel title="Context" eyebrow="Details" className="context-panel"><div className="setup-list"><div><i />Connection state<span>Preview only</span></div><div><i />Permissions<span>Not configured</span></div></div></Panel></div></AppShell>
}

export default function App() {
  const path = window.location.pathname
  if (path === '/') return <Landing />
  if (path === '/dashboard') return <DashboardPage />
  if (path === '/projects' || path.startsWith('/projects/')) return <WorkspacePage session={path.includes('/sessions/')} />
  if (path === '/models') return <AppPage title="Models" active="models" />
  if (path === '/integrations/manage') return <AppPage title="Manage integrations" active="integrations" />
  if (path === '/settings') return <AppPage title="Settings" active="settings" />
  const pages: Record<string, [string, string]> = {
    '/features': ['Product capabilities', 'A considered set of surfaces for working with code and its context.'],
    '/integrations': ['Providers and integrations', 'A clear boundary for the tools Atlas may connect to in a future phase.'],
    '/pricing': ['Pricing structure', 'A placeholder for transparent plans once the product is ready to be offered.'],
    '/docs': ['Documentation', 'Notes on the architecture, principles and future integration path.'],
    '/login': ['Sign in', 'Authentication is not connected yet. This route is an intentional entry-point placeholder.'],
    '/signup': ['Preview Atlas', 'Account creation is not connected yet. Explore the interface without pretending to create an account.'],
  }
  const [title, description] = pages[path] ?? ['Route placeholder', 'This route is reserved for the next phase of Atlas.']
  return <PublicPage title={title} description={description} />
}
