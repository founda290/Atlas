import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../App'
import { request } from '../services/api'
import { account } from '../services/account'
import { AppSidebar } from '../components'
import { AccountProvider } from '../hooks/account'
import { Tabs } from '../components/ui'
function route(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}
describe('account entry integration boundary', () => {
  it('validates login and toggles visibility without sending credentials', async () => {
    const fetch = vi.spyOn(window, 'fetch')
    route('/login')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'dev@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), {
      target: { value: 'test-password-123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute('type', 'text')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Neon Auth is not configured')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('does not submit account credentials when configuration is absent', async () => {
    await expect(account.signIn('test@example.com', 'test-only-password')).rejects.toThrow(
      'not configured',
    )
    await expect(account.signUp('Test', 'test@example.com', 'test-only-password')).rejects.toThrow(
      'not configured',
    )
  })
})
describe('persistent workspace account controls', () => {
  it('shows and performs sign-out from the sidebar', async () => {
    vi.spyOn(account, 'session').mockResolvedValue({
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      emailVerified: true,
    })
    const signOut = vi.spyOn(account, 'signOut').mockResolvedValue()
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AccountProvider>
          <AppSidebar />
        </AccountProvider>
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
    expect(signOut).toHaveBeenCalledOnce()
    expect(await screen.findByText('Signed out.')).toHaveAttribute('role', 'status')
  })
})
describe('chat-first workspace', () => {
  it('shows an honest empty state, keeps sending disabled until a real model is selected, and keeps projects optional', () => {
    const fetch = vi.spyOn(window, 'fetch')
    route('/chat')

    expect(screen.getByRole('heading', { name: 'What are you working on?' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Check for connected models')
    expect(screen.getByRole('button', { name: 'Discover models' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
    expect(screen.getByRole('link', { name: /Projects.*optional/ })).toHaveAttribute(
      'href',
      '/browser-projects',
    )
    expect(screen.queryByRole('log')).not.toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('offers only connected, available, tool-capable models reported by the runtime', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            providers: [
              {
                id: 'provider-a',
                name: 'Connected provider',
                connected: true,
                authentication: 'configured',
                models: [
                  {
                    providerID: 'provider-a',
                    modelID: 'real-tool-model',
                    name: 'Reported model',
                    available: true,
                    toolCall: true,
                    reasoning: false,
                  },
                  {
                    providerID: 'provider-a',
                    modelID: 'unavailable-model',
                    name: 'Unavailable model',
                    available: false,
                    toolCall: true,
                    reasoning: false,
                  },
                  {
                    providerID: 'provider-a',
                    modelID: 'no-tools-model',
                    name: 'No tools model',
                    available: true,
                    toolCall: false,
                    reasoning: false,
                  },
                ],
              },
              {
                id: 'provider-b',
                name: 'Unconnected provider',
                connected: false,
                authentication: 'not connected',
                models: [
                  {
                    providerID: 'provider-b',
                    modelID: 'unconnected-model',
                    name: 'Unconnected model',
                    available: true,
                    toolCall: true,
                    reasoning: false,
                  },
                ],
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    route('/chat')

    fireEvent.click(screen.getByRole('button', { name: 'Discover models' }))
    expect(
      await screen.findByRole('option', { name: 'Connected provider / Reported model' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: /Unavailable model|No tools model|Unconnected model/ }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Model' })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled()

    fireEvent.change(screen.getByRole('combobox', { name: 'Model' }), {
      target: { value: 'provider-a/real-tool-model' },
    })
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
  })

  it('preselects only a zero-cost OpenCode model and never defaults to paid BYOK', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            providers: [
              {
                id: 'openai',
                name: 'OpenAI BYOK',
                connected: true,
                authentication: 'reported',
                models: [
                  {
                    providerID: 'openai',
                    modelID: 'paid-model',
                    name: 'Paid model',
                    available: true,
                    toolCall: true,
                    reasoning: true,
                    inputPrice: 2.5,
                    outputPrice: 10,
                  },
                ],
              },
              {
                id: 'opencode',
                name: 'OpenCode',
                connected: true,
                authentication: 'reported',
                models: [
                  {
                    providerID: 'opencode',
                    modelID: 'beam-free',
                    name: 'Beam Free',
                    available: true,
                    toolCall: true,
                    reasoning: false,
                    inputPrice: 0,
                    outputPrice: 0,
                  },
                  {
                    providerID: 'opencode',
                    modelID: 'output-priced-model',
                    name: 'Output Priced Model',
                    available: true,
                    toolCall: true,
                    reasoning: false,
                    inputPrice: 0,
                    outputPrice: 0.01,
                  },
                ],
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    route('/chat')

    fireEvent.click(screen.getByRole('button', { name: 'Discover models' }))
    const modelSelect = screen.getByRole('combobox', { name: 'Model' })
    await waitFor(() => expect(modelSelect).toHaveValue('opencode/beam-free'))
    expect(
      screen.getByRole('option', { name: 'OpenCode / Beam Free — OpenCode free tier' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'OpenCode / Output Priced Model' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: 'OpenCode / Output Priced Model — OpenCode free tier' }),
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole('option')[1]).toHaveValue('opencode/beam-free')
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
  })

  it('creates a real session and submits the first message through the session API', async () => {
    const sessionId = 'chat-id-12345678'
    const calls: { url: string; init?: RequestInit }[] = []
    vi.stubGlobal(
      'EventSource',
      class {
        onerror: (() => void) | null = null
        addEventListener() {}
        close() {}
      },
    )
    vi.spyOn(window, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      calls.push({ url, init })
      if (url.endsWith('/providers'))
        return new Response(
          JSON.stringify({
            data: {
              providers: [
                {
                  id: 'provider-a',
                  name: 'Connected provider',
                  connected: true,
                  authentication: 'reported',
                  models: [
                    {
                      providerID: 'provider-a',
                      modelID: 'real-tool-model',
                      name: 'Reported model',
                      available: true,
                      toolCall: true,
                      reasoning: false,
                    },
                  ],
                },
              ],
            },
          }),
          { status: 200 },
        )
      if (url.endsWith('/sessions') && init?.method === 'POST')
        return new Response(
          JSON.stringify({
            data: {
              id: sessionId,
              runtimeSessionId: 'runtime-session',
              workspaceId: 'atlas-test-workspace',
              created: Date.now(),
              status: 'ready',
              title: 'Draft a project plan',
              model: { providerID: 'provider-a', modelID: 'real-tool-model' },
            },
          }),
          { status: 201 },
        )
      if (url.endsWith(`/sessions/${sessionId}/messages`) && init?.method === 'POST')
        return new Response(JSON.stringify({ data: { status: 'running' } }), { status: 202 })
      if (url.endsWith(`/sessions/${sessionId}/messages`))
        return new Response(
          JSON.stringify({ data: { sessionId, messages: [], status: 'ready', resumable: true } }),
          { status: 200 },
        )
      throw new Error(`Unexpected test request: ${url}`)
    })
    route('/chat')

    fireEvent.click(screen.getByRole('button', { name: 'Discover models' }))
    await screen.findByRole('option', { name: 'Connected provider / Reported model' })
    fireEvent.change(screen.getByRole('combobox', { name: 'Model' }), {
      target: { value: 'provider-a/real-tool-model' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Draft a project plan' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    await screen.findByRole('heading', { name: 'Draft a project plan' })
    await waitFor(() => {
      expect(
        calls.some(
          (call) =>
            call.url.endsWith(`/sessions/${sessionId}/messages`) &&
            call.init?.method === 'POST' &&
            call.init?.body === JSON.stringify({ text: 'Draft a project plan' }),
        ),
      ).toBe(true)
    })
    const createCall = calls.find(
      (call) => call.url.endsWith('/sessions') && call.init?.method === 'POST',
    )
    expect(JSON.parse(String(createCall?.init?.body))).toMatchObject({
      model: { providerID: 'provider-a', modelID: 'real-tool-model' },
      title: 'Draft a project plan',
    })
  })

  it('shows rate-limit model-choice guidance for a rate-limit event without retrying', async () => {
    const sessionId = 'rate-limit-chat-1234'
    let failed: ((event: MessageEvent) => void) | undefined
    let sends = 0
    vi.stubGlobal(
      'EventSource',
      class {
        onerror: (() => void) | null = null
        addEventListener(type: string, listener: (event: MessageEvent) => void) {
          if (type === 'session.failed') failed = listener
        }
        close() {}
      },
    )
    vi.spyOn(window, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.endsWith(`/sessions/${sessionId}/messages`) && init?.method === 'POST') {
        sends++
        return new Response(JSON.stringify({ data: { status: 'running' } }), { status: 202 })
      }
      if (url.endsWith(`/sessions/${sessionId}/messages`))
        return new Response(
          JSON.stringify({ data: { sessionId, messages: [], status: 'ready', resumable: true } }),
          { status: 200 },
        )
      throw new Error(`Unexpected test request: ${url}`)
    })
    route(`/chat/${sessionId}`)
    await screen.findByRole('button', { name: 'Change model' })
    await waitFor(() => expect(failed).toBeDefined())

    failed?.({
      data: JSON.stringify({
        type: 'session.failed',
        sessionId,
        error: 'Provider rate limit reached. Retry later.',
        errorCode: 'provider_rate_limit',
      }),
      lastEventId: 'rate-limit-1',
    } as MessageEvent)

    const hint = await screen.findByText(/Rate limit reached\. Use Change model/)
    expect(hint).toHaveAttribute('role', 'status')
    expect(hint).toHaveTextContent(/Change model/)
    expect(hint).toHaveTextContent(/retry later/)
    expect(hint).toHaveTextContent(/never switches to a paid or different provider automatically/)
    expect(await screen.findByRole('alert')).toHaveTextContent('Provider rate limit reached. Retry later.')
    expect(sends).toBe(0)
    expect(screen.getByRole('button', { name: 'Change model' })).toBeEnabled()
  })

  it('applies a runtime-reported model change to an existing chat session', async () => {
    const sessionId = 'existing-chat-1234'
    const calls: { url: string; init?: RequestInit }[] = []
    vi.stubGlobal(
      'EventSource',
      class {
        onerror: (() => void) | null = null
        addEventListener() {}
        close() {}
      },
    )
    vi.spyOn(window, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      calls.push({ url, init })
      if (url.endsWith('/providers'))
        return new Response(
          JSON.stringify({
            data: {
              providers: [
                {
                  id: 'provider-a',
                  name: 'Connected provider',
                  connected: true,
                  authentication: 'reported',
                  models: [
                    {
                      providerID: 'provider-a',
                      modelID: 'replacement-model',
                      name: 'Replacement model',
                      available: true,
                      toolCall: true,
                      reasoning: false,
                    },
                  ],
                },
              ],
            },
          }),
          { status: 200 },
        )
      if (url.endsWith(`/sessions/${sessionId}/messages`))
        return new Response(
          JSON.stringify({ data: { sessionId, messages: [], status: 'ready', resumable: true } }),
          { status: 200 },
        )
      if (url.startsWith(`/api/v1/sessions/${sessionId}/model?`))
        return new Response(
          JSON.stringify({
            data: { model: { providerID: 'provider-a', modelID: 'replacement-model' } },
          }),
          { status: 200 },
        )
      throw new Error(`Unexpected test request: ${url}`)
    })
    route(`/chat/${sessionId}`)

    fireEvent.click(await screen.findByRole('button', { name: 'Change model' }))
    await screen.findByRole('option', { name: 'Connected provider / Replacement model' })
    fireEvent.change(screen.getByRole('combobox', { name: 'Model for future messages' }), {
      target: { value: 'provider-a/replacement-model' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    expect(await screen.findByText('Model updated for future messages.')).toHaveAttribute(
      'role',
      'status',
    )
    expect(
      calls.some(
        (call) =>
          call.url.startsWith(`/api/v1/sessions/${sessionId}/model?`) &&
          call.init?.method === 'POST' &&
          call.init?.body ===
            JSON.stringify({ providerID: 'provider-a', modelID: 'replacement-model' }),
      ),
    ).toBe(true)
  })
})
describe('shared UI and routes', () => {
  it('supports keyboard tab navigation', () => {
    const change = vi.fn()
    render(
      <Tabs
        label="View"
        value="a"
        onChange={change}
        items={[
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ]}
      />,
    )
    fireEvent.keyDown(screen.getByRole('tab', { name: 'A' }), { key: 'ArrowRight' })
    expect(change).toHaveBeenCalledWith('b')
    expect(screen.getByRole('tab', { name: 'B' })).toHaveFocus()
  })
  it('does not imply any hosted integrations are connected or available', () => {
    route('/integrations')
    expect(
      screen.getByRole('heading', { name: 'Browse providers. Connect when the worker is ready.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Atlas provider directory' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Hosted model worker' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'External tools and connectors' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse providers and models' })).toHaveAttribute(
      'href',
      '/models',
    )
    expect(screen.getByText(/No provider keys are collected in the browser/)).toBeInTheDocument()
    expect(screen.queryByRole('searchbox', { name: 'Search integrations' })).not.toBeInTheDocument()
  })
  it('handles unknown project IDs rather than substituting the local workspace', () => {
    route('/projects/not-real')
    expect(screen.getByRole('heading', { name: 'Project not found.' })).toBeInTheDocument()
  })
  it('provides nine useful searchable articles', () => {
    route('/docs')
    expect(
      screen
        .getAllByRole('navigation', { name: 'Documentation articles' })[0]
        .querySelectorAll('a'),
    ).toHaveLength(9)
    fireEvent.change(screen.getAllByRole('searchbox', { name: 'Search documentation' })[0], {
      target: { value: 'nonsense-search-value' },
    })
    expect(
      screen.getAllByText('No articles match. Try “runtime” or “sessions”.').length,
    ).toBeGreaterThan(0)
  })
  it('reports API HTTP errors instead of treating them as data', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { error: { message: 'Session not found' } } }), {
        status: 404,
      }),
    )
    await expect(request('/sessions/missing/messages')).rejects.toThrow('Session not found')
  })
})
