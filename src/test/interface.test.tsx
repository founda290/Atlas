import { fireEvent, render, screen } from '@testing-library/react'
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
describe('chat-first hosted workspace', () => {
  it('shows no sample conversations, keeps sending disabled and offers optional projects', () => {
    const fetch = vi.spyOn(window, 'fetch')
    route('/chat')

    expect(screen.getByRole('heading', { name: 'What are you working on?' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Hosted chat is not ready')
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Create project' })).toHaveAttribute(
      'href',
      '/browser-projects',
    )
    expect(fetch).not.toHaveBeenCalled()
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
      screen.getByRole('heading', { name: 'Connections are not available yet.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Hosted AI execution' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'External tools and providers' }),
    ).toBeInTheDocument()
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
