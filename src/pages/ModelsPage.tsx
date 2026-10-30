import { useState } from 'react'
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Panel,
  SearchInput,
} from '../components/ui'
import { api } from '../services/api'
import { useResource } from '../hooks/useResource'
const loadHealth = (signal: AbortSignal) => api.health(signal)
export function ModelsPage() {
  const health = useResource(loadHealth)
  const [search, setSearch] = useState('')
  const providers =
    health.data?.runtime.providers.filter((provider) =>
      `${provider.name} ${provider.id}`.toLowerCase().includes(search.toLowerCase()),
    ) ?? []
  return (
    <>
      <PageHeader
        eyebrow="Workspace / Models"
        title="Your engine. Your model."
        description="Provider entries come directly from OpenCode. Credentials and model defaults remain in your local runtime—not in a browser key vault."
        action={
          <Button secondary onClick={health.reload}>
            Refresh discovery
          </Button>
        }
      />
      <div className="app-page-body">
        <div className="model-summary">
          <Panel title="Runtime connection" eyebrow="Live discovery">
            {health.loading ? (
              <Loading />
            ) : health.error ? (
              <ErrorState message={health.error} retry={health.reload} />
            ) : (
              <>
                <Badge tone={health.data?.runtime.status === 'ready' ? 'success' : 'warning'}>
                  {health.data?.runtime.status === 'ready'
                    ? 'OpenCode reachable'
                    : 'OpenCode unavailable'}
                </Badge>
                <p>
                  {health.data?.runtime.providers.length ?? 0} provider entries reported. Listed
                  providers are not verified credentials or a model-availability guarantee.
                </p>
              </>
            )}
          </Panel>
          <Panel title="Selected model" eyebrow="Runtime-managed">
            <Badge>Not exposed by the API</Badge>
            <p>
              Atlas cannot discover or select the current model. Configure the default in OpenCode
              before starting a session.
            </p>
            <Button href="/docs/providers" secondary>
              Model configuration guide
            </Button>
          </Panel>
        </div>
        <div className="section-heading">
          <h2>Discovered providers</h2>
          <p>No provider names are populated from a marketing catalogue.</p>
        </div>
        <SearchInput label="Search discovered providers" value={search} onChange={setSearch} />
        {health.loading ? (
          <Loading label="Discovering runtime providers" />
        ) : health.error ? (
          <EmptyState title="Provider discovery is unavailable">
            Resolve the connection error above and refresh. No cached or invented providers are
            shown.
          </EmptyState>
        ) : providers.length ? (
          <div className="directory-grid provider-grid">
            {providers.map((provider) => (
              <article className="directory-card" key={provider.id}>
                <Badge>Reported by runtime</Badge>
                <h2>{provider.name}</h2>
                <code>{provider.id}</code>
                <dl className="detail-list">
                  <div>
                    <dt>Credential status</dt>
                    <dd>Not verified</dd>
                  </div>
                  <div>
                    <dt>Models</dt>
                    <dd>Discovery not exposed</dd>
                  </div>
                  <div>
                    <dt>Connection test</dt>
                    <dd>Not implemented</dd>
                  </div>
                </dl>
                <Button secondary href="/docs/providers">
                  Local configuration
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title={search ? 'No matching providers' : 'No providers reported'}>
            {search
              ? 'Try a different name or provider ID.'
              : 'Check OpenCode installation and configuration, then refresh discovery. No model availability can be inferred.'}
          </EmptyState>
        )}
        <Panel title="Models and BYOK" eyebrow="Integration boundary">
          <EmptyState title="Model listing is not available">
            The API returns provider names, not a model catalogue or selected model. Direct BYOK
            entry, credential storage, connection testing and model selection need backend support.
          </EmptyState>
        </Panel>
      </div>
    </>
  )
}
