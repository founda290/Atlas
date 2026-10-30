import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react'
import { createBrowserRouter, RouterProvider, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell, PublicLayout } from './components'
import { PreferencesProvider } from './hooks/preferences'
import { AuthPage } from './pages/AuthPage'
import { DocsPage } from './pages/DocsPage'
import { IntegrationsPage, ManagedIntegrationsPage } from './pages/IntegrationsPage'
import { ModelsPage } from './pages/ModelsPage'
import { DashboardPage, ProjectPage, ProjectsPage } from './pages/ProjectPages'
import { FeaturesPage, HomePage, PricingPage, StatusPage } from './pages/PublicPages'
import { SettingsPage } from './pages/SettingsPage'
import { ProjectEditorPage } from './pages/ProjectEditorPage'
import { WorkspacePage } from './pages/WorkspacePage'
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
          <Route path="signup" element={<AuthPage key="signup" signup />} />
          {['400', '401', '403', '404', '408', '429', '500', '502', '503', 'offline'].map(
            (code) => (
              <Route key={code} path={code} element={<StatusPage code={code} />} />
            ),
          )}
          <Route path="*" element={<StatusPage />} />
        </Route>
        <Route element={<AppShell />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId" element={<ProjectPage />} />
          <Route path="projects/:projectId/editor" element={<ProjectEditorPage />} />
          <Route path="projects/:projectId/sessions/:sessionId" element={<WorkspacePage />} />
          <Route path="models" element={<ModelsPage />} />
          <Route path="integrations/manage" element={<ManagedIntegrationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </PreferencesProvider>
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
