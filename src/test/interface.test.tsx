import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../App'
import { authenticate, register, request } from '../services/api'
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
    fireEvent.click(screen.getByRole('button', { name: 'Sign in — not enabled' }))
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'dev@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), {
      target: { value: 'test-password-123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute('type', 'text')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in — not enabled' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Account authentication is not enabled',
    )
    expect(fetch).not.toHaveBeenCalled()
  })
  it('never resolves the unimplemented auth service successfully', async () => {
    await expect(authenticate()).rejects.toThrow('not enabled')
    await expect(register()).rejects.toThrow('not enabled')
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
  it('filters the actual integration directory', () => {
    route('/integrations')
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search integrations' }), {
      target: { value: 'MCP' },
    })
    expect(screen.getByRole('heading', { name: 'MCP server management' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'CLI connections' })).not.toBeInTheDocument()
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
