import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FileDetails } from '../features/workspace/FileExplorer'
import { SessionChanges } from '../features/workspace/SessionChanges'
import { api } from '../services/api'
import { WORKSPACE_ID } from '../types/api'
import type { SessionDiffSnapshot, WorkspaceFileContent } from '../types/api'

const file = (path: string, content: string): WorkspaceFileContent => ({
  workspaceId: WORKSPACE_ID,
  path,
  content,
  bytes: content.length,
  readOnly: true,
  encoding: 'utf-8',
})
const snapshot = (sessionId: string): SessionDiffSnapshot => ({
  sessionId,
  diffs: [],
  source: 'opencode-session',
  authoritativeFilesystem: false,
  omitted: 0,
  fetchedAt: Date.now(),
})

describe('actual read-only file preview', () => {
  it('shows escaped source text and copies the actual response without an editor or save control', async () => {
    const content = '<script>window.unsafe = true</script>'
    vi.spyOn(api, 'file').mockResolvedValue(file('source.ts', content))
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const { container } = render(
      <FileDetails file={{ kind: 'file', path: 'source.ts', bytes: content.length }} />,
    )
    expect(await screen.findByText(content)).toBeInTheDocument()
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('textarea')).toBeNull()
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(content))
  })
  it('does not show stale content when refresh fails, and supports retry', async () => {
    const read = vi
      .spyOn(api, 'file')
      .mockResolvedValueOnce(file('source.ts', 'old source'))
      .mockRejectedValueOnce(new Error('File exceeds the 256 KiB text-preview limit'))
      .mockResolvedValue(file('source.ts', 'new source'))
    render(<FileDetails file={{ kind: 'file', path: 'source.ts', bytes: 10 }} />)
    await screen.findByText('old source')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh file' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('256 KiB')
    expect(screen.queryByText('old source')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('new source')).toBeInTheDocument()
    expect(read).toHaveBeenCalledTimes(3)
  })
  it('aborts the old file request on selection and ignores late responses', async () => {
    let finish: ((content: WorkspaceFileContent) => void) | undefined
    let oldSignal: AbortSignal | undefined
    vi.spyOn(api, 'file').mockImplementation((path, signal) => {
      if (path === 'old.ts') {
        oldSignal = signal
        return new Promise((resolve) => {
          finish = resolve
        })
      }
      return Promise.resolve(file(path, 'selected source'))
    })
    const view = render(<FileDetails file={{ kind: 'file', path: 'old.ts' }} />)
    view.rerender(<FileDetails file={{ kind: 'file', path: 'new.ts' }} />)
    expect(await screen.findByText('selected source')).toBeInTheDocument()
    expect(oldSignal?.aborted).toBe(true)
    await act(async () => finish?.(file('old.ts', 'late old response')))
    expect(screen.queryByText('late old response')).not.toBeInTheDocument()
  })
})
describe('on-demand runtime diff review', () => {
  it('fetches only when opened, refreshes explicitly, and labels an empty snapshot honestly', async () => {
    const getDiff = vi.spyOn(api, 'sessionDiff').mockResolvedValue(snapshot('one'))
    const view = render(<SessionChanges sessionId="one" active={false} revision={0} />)
    expect(getDiff).not.toHaveBeenCalled()
    view.rerender(<SessionChanges sessionId="one" active revision={0} />)
    expect(await screen.findByText('Runtime returned no visible diff entries')).toBeInTheDocument()
    expect(
      screen.getByText(/not an authoritative filesystem or Git comparison/),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh diff' }))
    await waitFor(() => expect(getDiff).toHaveBeenCalledTimes(2))
    await screen.findByText('Runtime returned no visible diff entries')
    view.rerender(<SessionChanges sessionId="one" active revision={1} />)
    await waitFor(() => expect(getDiff).toHaveBeenCalledTimes(3))
  })
  it('shows errors rather than inventing an empty successful diff', async () => {
    vi.spyOn(api, 'sessionDiff').mockRejectedValue(new Error('Runtime unavailable'))
    render(<SessionChanges sessionId="one" active revision={0} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Runtime unavailable')
    expect(screen.queryByText('Runtime returned no visible diff entries')).not.toBeInTheDocument()
  })
  it('reports omissions and renders an explicit safe-rendering fallback for huge diffs', async () => {
    vi.spyOn(api, 'sessionDiff').mockResolvedValue({
      ...snapshot('one'),
      omitted: 2,
      diffs: [
        {
          file: 'huge.ts',
          before: 'old\n'.repeat(2500),
          after: 'new\n',
          additions: 1,
          deletions: 2500,
        },
      ],
    })
    render(<SessionChanges sessionId="one" active revision={0} />)
    expect(await screen.findByText(/2 entries omitted/)).toBeInTheDocument()
    expect(screen.getByText(/exceeds the safe rendering budget/)).toBeInTheDocument()
  })
})
