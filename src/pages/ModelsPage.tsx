import { useMemo, useState } from 'react'
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
import { fetchProviderCatalog, type ProviderCatalogProvider } from '../features/providerCatalog'
import { api } from '../services/api'
import { useResource } from '../hooks/useResource'

const loadCatalog = (signal: AbortSignal) => fetchProviderCatalog(signal)
const loadRuntimeProviders = (signal: AbortSignal) => api.providers(undefined, signal)
const pageSize = 60

type CatalogFilter = 'all' | 'free' | 'connected'

function formatPrice(value?: number) {
  if (value === undefined) return 'not reported'
  return value === 0 ? '$0' : `$${value.toFixed(value < 0.01 ? 4 : 2)}`
}

function matchesProvider(provider: ProviderCatalogProvider, query: string) {
  if (!query) return true
  const searchText = query.toLowerCase()
  return (
    `${provider.id} ${provider.name} ${provider.api ?? ''} ${provider.docs ?? ''}`
      .toLowerCase()
      .includes(searchText) ||
    provider.models.some((model) => `${model.id} ${model.name}`.toLowerCase().includes(searchText))
  )
}

export function ModelsPage() {
  const catalog = useResource(loadCatalog)
  const runtime = useResource(loadRuntimeProviders)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<CatalogFilter>('all')
  const [expanded, setExpanded] = useState('')
  const [visibleCount, setVisibleCount] = useState(pageSize)
  const liveProviders = runtime.data?.providers ?? []
  const connectedIds = useMemo(
    () =>
      new Set(
        liveProviders.filter((provider) => provider.connected).map((provider) => provider.id),
      ),
    [liveProviders],
  )
  const providers = useMemo(
    () =>
      (catalog.data?.providers ?? []).filter((provider) => {
        if (!matchesProvider(provider, search)) return false
        if (filter === 'free') return provider.models.some((model) => model.free)
        if (filter === 'connected') return connectedIds.has(provider.id)
        return true
      }),
    [catalog.data, connectedIds, filter, search],
  )
  const visibleProviders = providers.slice(0, visibleCount)

  function refresh() {
    catalog.reload()
    runtime.reload()
  }

  return (
    <>
      <PageHeader
        eyebrow="Workspace / Models"
        title="Atlas provider catalog"
        description="Browse real provider endpoints and agent-capable models. Catalog metadata is not proof that a provider is connected or that a request will succeed."
        action={
          <Button secondary onClick={refresh}>
            Refresh catalog
          </Button>
        }
      />
      <div className="app-page-body provider-catalog-page">
        <div className="provider-catalog-toolbar">
          <SearchInput
            label="Search Atlas providers and models"
            value={search}
            onChange={(value) => {
              setSearch(value)
              setVisibleCount(pageSize)
            }}
            placeholder="Search provider, model, or endpoint"
          />
          <label className="provider-filter-field">
            <span>Show</span>
            <select
              aria-label="Filter providers"
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value as CatalogFilter)
                setVisibleCount(pageSize)
              }}
            >
              <option value="all">All providers</option>
              <option value="free">OpenCode free models</option>
              <option value="connected">Connected in this worker</option>
            </select>
          </label>
        </div>

        {catalog.loading && !catalog.data ? (
          <Loading label="Loading Atlas provider catalog" />
        ) : catalog.error && !catalog.data ? (
          <ErrorState message={catalog.error} retry={catalog.reload} />
        ) : catalog.data ? (
          <>
            <div className="provider-catalog-summary" role="status">
              <div>
                <strong>{catalog.data.providerCount} providers</strong>
                <span>
                  {catalog.data.agentProviderCount} list at least one current text-and-tool model
                </span>
              </div>
              <div>
                <strong>{catalog.data.modelCount.toLocaleString()} models</strong>
                <span>Agent-capable model entries in this catalog snapshot</span>
              </div>
              <div>
                <strong>Updated {new Date(catalog.data.fetchedAt).toLocaleDateString()}</strong>
                <span>Reference data from Models.dev</span>
              </div>
            </div>

            <Panel title="Connections, free access, and credentials">
              <p>
                OpenCode free-tier models are listed only when the catalog reports both zero input
                and output price; access still depends on the provider account and its usage limits.
                Atlas does not automatically choose a paid model when free access is unavailable.
              </p>
              <p>
                BYOK key entry and account-specific provider connections are not active in this
                deployment. They require an authenticated worker and a protected server-side secret
                store. No API keys are collected or stored in this browser.
              </p>
              <p>
                {runtime.loading
                  ? 'Checking the current worker connection…'
                  : runtime.data
                    ? `${connectedIds.size} providers are reported as connected by the current worker; a real request is still needed to confirm access.`
                    : 'No live worker connection status is available here. The catalog remains browseable, but its providers cannot be selected for a real session.'}
              </p>
              {runtime.error && (
                <span className="provider-worker-note">
                  Worker status could not be loaded. Provider metadata remains browseable; no
                  connection is assumed.
                </span>
              )}
            </Panel>

            <p className="result-count">
              Showing {visibleProviders.length} of {providers.length} matching providers.
            </p>
            {visibleProviders.length ? (
              <div className="directory-grid provider-grid">
                {visibleProviders.map((provider) => {
                  const isConnected = connectedIds.has(provider.id)
                  const searchTerm = search.toLowerCase()
                  const modelMatches = search
                    ? provider.models.filter((model) =>
                        `${model.id} ${model.name}`.toLowerCase().includes(searchTerm),
                      )
                    : []
                  const matches = (modelMatches.length ? modelMatches : provider.models).slice(
                    0,
                    40,
                  )
                  const remaining = modelMatches.length
                    ? Math.max(0, modelMatches.length - matches.length)
                    : Math.max(0, provider.agentModelCount - matches.length)
                  return (
                    <article className="directory-card provider-catalog-card" key={provider.id}>
                      <div className="provider-catalog-card-top">
                        <Badge tone={isConnected ? 'success' : 'neutral'}>
                          {isConnected ? 'Worker-reported connection' : 'Catalog entry'}
                        </Badge>
                        {provider.models.some((model) => model.free) && (
                          <Badge tone="success">Free-tier models listed</Badge>
                        )}
                      </div>
                      <h2>{provider.name}</h2>
                      <code>{provider.id}</code>
                      <p>
                        {provider.agentModelCount.toLocaleString()} agent-capable models listed
                        {provider.catalogModelCount !== provider.agentModelCount &&
                          ` · ${provider.catalogModelCount.toLocaleString()} total provider models`}
                      </p>
                      {provider.api ? (
                        <div className="provider-endpoint">
                          <span>Provider API endpoint</span>
                          <code>{provider.api}</code>
                        </div>
                      ) : (
                        <div className="provider-endpoint">
                          <span>Endpoint</span>
                          <code>Handled by provider integration</code>
                        </div>
                      )}
                      {provider.credentialEnvNames.length > 0 && (
                        <p className="provider-auth-hint">
                          Usually requires a provider credential (
                          {provider.credentialEnvNames.slice(0, 2).join(', ')}
                          {provider.credentialEnvNames.length > 2 ? ', …' : ''}). Names only; no key
                          values are included.
                        </p>
                      )}
                      <div className="provider-catalog-links">
                        {provider.docs && (
                          <a href={provider.docs} target="_blank" rel="noreferrer">
                            Provider docs
                          </a>
                        )}
                        {provider.npm && <code>{provider.npm}</code>}
                      </div>
                      <details
                        onToggle={(event) =>
                          setExpanded(event.currentTarget.open ? provider.id : '')
                        }
                      >
                        <summary>
                          {expanded === provider.id ? 'Hide models' : 'Browse agent models'}
                        </summary>
                        {expanded === provider.id && (
                          <>
                            {matches.length ? (
                              <ul className="provider-model-list">
                                {matches.map((model) => (
                                  <li key={model.id}>
                                    <div className="provider-model-heading">
                                      <strong>{model.name}</strong>
                                      {model.free && (
                                        <Badge tone="success">OpenCode free tier</Badge>
                                      )}
                                    </div>
                                    <code>{model.id}</code>
                                    <p>
                                      Input {formatPrice(model.inputPrice)} / output{' '}
                                      {formatPrice(model.outputPrice)} per 1M tokens
                                      {model.context
                                        ? ` · ${model.context.toLocaleString()} context`
                                        : ''}
                                      {model.reasoning ? ' · reasoning' : ''}
                                    </p>
                                    {model.description && <p>{model.description}</p>}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p>No catalog models match this search for this provider.</p>
                            )}
                            {remaining > 0 && (
                              <p className="provider-model-more">
                                Showing 30 models. Search by model name to find others;{' '}
                                {remaining.toLocaleString()} more are listed.
                              </p>
                            )}
                          </>
                        )}
                      </details>
                    </article>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                title={
                  search ? 'No matching providers or models' : 'No providers match this filter'
                }
              >
                Try another search or filter. This directory contains only real entries from the
                catalog source.
              </EmptyState>
            )}
            {visibleProviders.length < providers.length && (
              <div className="provider-catalog-more">
                <Button secondary onClick={() => setVisibleCount((value) => value + pageSize)}>
                  Load more providers
                </Button>
              </div>
            )}
            {catalog.error && (
              <p className="provider-worker-note">
                The bundled catalog is still available; refresh could not reach a newer snapshot.
              </p>
            )}
          </>
        ) : null}
      </div>
    </>
  )
}
