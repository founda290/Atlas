import { Link } from 'react-router-dom'
import { Badge, Button, ErrorState, Loading, PageHeader, Panel } from '../components/ui'
import { useAccount } from '../hooks/account'
import { useResource } from '../hooks/useResource'
interface CloudCapabilities {
  enabled: boolean
  reason: string
  accountRequired: boolean
  mode: string
}
// Cloud has its own public control-plane route, not the local /api/v1 execution API.
async function capabilities(signal: AbortSignal) {
  const response = await fetch('/api/cloud', { signal })
  if (!response.ok)
    throw new Error('Cloud readiness could not be loaded. Cloud creation remains disabled.')
  const result = (await response.json()) as { data: CloudCapabilities }
  if (result.data?.enabled !== false)
    throw new Error('Cloud configuration requires operator review. Creation remains disabled.')
  return result.data
}
export function CloudProjectsPage() {
  const { user } = useAccount(),
    resource = useResource(capabilities)
  return (
    <>
      <PageHeader
        title="Cloud projects"
        eyebrow="Projects / Cloud"
        description="Prepared control plane. Cloud execution is disabled for this release."
      />
      <div className="app-page-body">
        <Panel title="Cloud availability">
          <Badge tone="warning">Disabled</Badge>
          {resource.loading ? (
            <Loading />
          ) : resource.error ? (
            <ErrorState message={resource.error} retry={resource.reload} />
          ) : (
            <p>{resource.data?.reason}</p>
          )}
          <Button disabled>Create cloud project — disabled</Button>
          <p>
            No virtual machine, container or paid cloud runner is created. This is enforced on the
            server, not only by this button.
          </p>
        </Panel>
        <Panel title="Account and storage">
          <p>
            {user
              ? `Signed in as ${user.email}. An account does not activate cloud execution.`
              : 'Create an account or sign in. Cloud execution remains disabled even after sign-in.'}
          </p>
          <Button secondary href={user ? '/account' : '/signup'}>
            {user ? 'Manage account' : 'Create account'}
          </Button>
          <p>
            Future cloud projects require owned PostgreSQL metadata, persistent source storage, a
            sandboxed execution worker, job limits, verified authentication and operational
            approval. Neon stores structured data; it does not run coding agents.
          </p>
        </Panel>
        <Panel title="Use Atlas now">
          <div className="project-mode-links">
            <Link className="text-link" to="/browser-projects">
              Browser-local projects →
            </Link>
            <Link className="text-link" to="/projects">
              Local backend projects →
            </Link>
          </div>
          <p>
            Browser-local editing works without a server while this browser is available. Local
            OpenCode projects require the trusted backend on your machine. Neither is silently
            uploaded or converted to a cloud project.
          </p>
          <p>
            Operator documentation: <code>docs/ACCOUNTS-LOCAL-CLOUD-SETUP.md</code> and{' '}
            <code>docs/ACCOUNTS-LOCAL-CLOUD-DELIVERY.md</code>.
          </p>
        </Panel>
      </div>
    </>
  )
}
