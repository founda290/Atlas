import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react'
import {
  createBrowserRouter,
  RouterProvider,
  Route,
  Routes,
  useLocation,
  Navigate,
} from 'react-router-dom'
import { AppShell, Button, PublicLayout } from './components'
import { PreferencesProvider } from './hooks/preferences'
import { AccountProvider } from './hooks/account'
import { ResetPasswordPage, AccountPanel } from './pages/AccountPage'
import { BrowserProjectsPage } from './pages/BrowserProjectsPage'
import { CloudProjectsPage } from './pages/CloudProjectsPage'
import { AuthPage } from './pages/AuthPage'
import { DocsPage } from './pages/DocsPage'
import { IntegrationsPage } from './pages/IntegrationsPage'
import { ModelsPage } from './pages/ModelsPage'
import { ProjectPage, ProjectsPage } from './pages/ProjectPages'
import { FeaturesPage, HomePage, PricingPage, StatusPage } from './pages/PublicPages'
import { SettingsPage } from './pages/SettingsPage'
import { ProjectEditorPage } from './pages/ProjectEditorPage'
import { WorkspacePage } from './pages/WorkspacePage'
import { ChatPage } from './pages/ChatPage'

function isLocalRuntimeOrigin() {
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
}
function HostedFeatureUnavailable({ feature }: { feature: string }) {
  return (
    <div className="app-page-body">
      <h1>{feature} is not available in the hosted app yet.</h1>
      <p>
        This feature needs a deployed, isolated execution service. No example data is shown and no
        operation was run.
      </p>
      <div className="project-mode-links">
        <Button href="/chat">Go to Chat</Button>
        <Button secondary href="/browser-projects">
          Projects
        </Button>
      </div>
    </div>
  )
}
function LocalRuntimeOnly({ children, feature }: { children: ReactNode; feature: string }) {
  return isLocalRuntimeOrigin() ? <>{children}</> : <HostedFeatureUnavailable feature={feature} />
}
function ProjectIndexRoute() {
  return isLocalRuntimeOrigin() ? <ProjectsPage /> : <BrowserProjectsPage />
}
function ProjectDetailRoute() {
  return isLocalRuntimeOrigin() ? <ProjectPage /> : <BrowserProjectsPage />
}
function RouteEffects() {
  const location = useLocation()
  useEffect(() => {
    const name =
      location.pathname === '/'
        ? 'A considered coding workspace'
        : location.pathname
            .split('/')
            .filter(Boolean)[0]
            .replace(/^./, (letter) => letter.toUpperCase())
    document.title = `Atlas · ${name}`
    if (location.hash)
      requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView())
    else window.scrollTo(0, 0)
  }, [location.pathname, location.hash])
  return null
}
class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() {
    return { error: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Atlas interface error', error.message, info.componentStack)
  }
  render() {
    return this.state.error ? (
      <main className="fatal-error">
        <h1>The interface encountered an error.</h1>
        <p>No operation has been simulated. Reload Atlas to recover.</p>
        <a href="/">Return to Atlas</a>
      </main>
    ) : (
      this.props.children
    )
  }
}
export function AppRoutes() {
  return (
    <AccountProvider>
      <PreferencesProvider>
        <RouteEffects />
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            <Route path="features" element={<FeaturesPage />} />
            <Route path="integrations" element={<IntegrationsPage />} />
            <Route path="pricing" element={<PricingPage />} />
            <Route path="docs" element={<DocsPage />} />
            <Route path="docs/:articleId" element={<DocsPage />} />
            <Route path="login" element={<AuthPage key="login" />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route path="signup" element={<AuthPage key="signup" signup />} />
            {['400', '401', '403', '404', '408', '429', '500', '502', '503', 'offline'].map(
              (code) => (
                <Route key={code} path={code} element={<StatusPage code={code} />} />
              ),
            )}
            <Route path="*" element={<StatusPage />} />
          </Route>
          <Route element={<AppShell />}>
            <Route path="account" element={<AccountPanel />} />
            <Route path="browser-projects" element={<BrowserProjectsPage />} />
            <Route path="browser-projects/:browserId" element={<BrowserProjectsPage />} />
            <Route path="cloud-projects" element={<CloudProjectsPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="dashboard" element={<Navigate to="/chat" replace />} />
            <Route path="projects" element={<ProjectIndexRoute />} />
            <Route path="projects/:projectId" element={<ProjectDetailRoute />} />
            <Route
              path="projects/:projectId/editor"
              element={
                <LocalRuntimeOnly feature="Managed project editing">
                  <ProjectEditorPage />
                </LocalRuntimeOnly>
              }
            />
            <Route
              path="projects/:projectId/sessions/:sessionId"
              element={
                <LocalRuntimeOnly feature="Managed coding sessions">
                  <WorkspacePage />
                </LocalRuntimeOnly>
              }
            />
            <Route
              path="models"
              element={
                <LocalRuntimeOnly feature="Model discovery">
                  <ModelsPage />
                </LocalRuntimeOnly>
              }
            />
            <Route
              path="integrations/manage"
              element={<HostedFeatureUnavailable feature="Managed integrations" />}
            />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </PreferencesProvider>
    </AccountProvider>
  )
}
const router = createBrowserRouter([{ path: '*', element: <AppRoutes /> }])
export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  )
}
