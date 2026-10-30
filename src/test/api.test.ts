import { afterEach, describe, expect, it, vi } from 'vitest'
import { request } from '../services/api'

afterEach(() => vi.unstubAllGlobals())

describe('API request responses', () => {
  it('returns the data envelope from a valid JSON response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { ready: true } }), {
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(request<{ ready: boolean }>('/health')).resolves.toEqual({ ready: true })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/health',
      expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }),
    )
  })

  it('reports the actual HTTP status and content type for non-JSON proxy responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html>proxy error</html>', {
          status: 502,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
      ),
    )

    await expect(request('/health')).rejects.toMatchObject({
      name: 'ApiError',
      status: 502,
      message: expect.stringContaining('HTTP 502 as text/html'),
    })
  })

  it('rejects non-object JSON envelopes without throwing a TypeError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('null')))

    await expect(request('/health')).rejects.toEqual(
      expect.objectContaining({
        name: 'ApiError',
        message: 'The Atlas API returned JSON in an unexpected format.',
      }),
    )
  })

  it('continues to use backend errors from valid JSON envelopes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { error: { message: 'Local-only boundary.' } } }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )

    await expect(request('/health')).rejects.toEqual(
      expect.objectContaining({
        name: 'ApiError',
        status: 403,
        message: 'Local-only boundary.',
      }),
    )
  })
})
