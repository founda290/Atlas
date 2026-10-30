// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { ClyvroClient, ClyvroError, type FetchLike } from '../src/security/clyvro'

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
}

describe('ClyvroClient', () => {
  it('returns disabled instead of fabricating a guard decision when the key is absent', async () => {
    const fetch = vi.fn<FetchLike>()
    const client = new ClyvroClient(undefined, { fetch })
    await expect(client.guard({ method: 'GET', path: '/' })).resolves.toEqual({ status: 'disabled' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('sends a bounded guard request to the fixed HTTPS origin and validates its action', async () => {
    const fetch = vi.fn<FetchLike>().mockResolvedValue(jsonResponse({ action: 'challenge' }))
    const client = new ClyvroClient('secret-test-key', { fetch })
    await expect(client.guard({ method: 'get', path: '/search', search: '?q=x', userAgent: 'test-agent' })).resolves.toEqual({ status: 'enabled', action: 'challenge' })
    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('https://clyvro.vercel.app/api/v1/guard')
    expect(init?.redirect).toBe('error')
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer secret-test-key')
    expect(JSON.parse(String(init?.body))).toEqual({ method: 'GET', path: '/search', search: '?q=x', userAgent: 'test-agent' })
  })

  it('rejects invalid guard inputs and response actions', async () => {
    const fetch = vi.fn<FetchLike>().mockResolvedValue(jsonResponse({ action: 'unknown' }))
    const client = new ClyvroClient('key', { fetch })
    await expect(client.guard({ method: 'GET\n', path: '/' })).rejects.toBeInstanceOf(ClyvroError)
    expect(fetch).not.toHaveBeenCalled()
    await expect(client.guard({ method: 'GET', path: 'relative' })).rejects.toBeInstanceOf(ClyvroError)
    await expect(client.guard({ method: 'GET', path: '/' })).rejects.toThrow('Invalid guard response')
  })

  it('requires exact explicit consent and rejects unsafe scan URLs before requesting', async () => {
    const fetch = vi.fn<FetchLike>()
    const client = new ClyvroClient('key', { fetch })
    for (const url of [
      'http://example.com', 'https://user:pass@example.com', 'https://localhost/',
      'https://sub.localhost/', 'https://127.0.0.1/', 'https://10.1.2.3/',
      'https://172.16.0.1/', 'https://192.168.1.2/', 'https://[::1]/',
      'file:///etc/passwd',
    ]) {
      await expect(client.scan(url, true), url).rejects.toBeInstanceOf(ClyvroError)
    }
    await expect(client.scan('https://example.com', false)).rejects.toThrow('Explicit consent')
    await expect(new ClyvroClient(undefined, { fetch }).scan('https://example.com', true)).rejects.toThrow('Clyvro API key')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('submits consented scans and validates queued identifiers and HTTP status', async () => {
    const fetch = vi.fn<FetchLike>().mockResolvedValue(jsonResponse({ id: 'scan_123' }, 202))
    const client = new ClyvroClient('key', { fetch })
    await expect(client.scan('https://example.com/a?b=1', true)).resolves.toEqual({ id: 'scan_123' })
    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('https://clyvro.vercel.app/api/v1/scans')
    expect(JSON.parse(String(init?.body))).toEqual({ url: 'https://example.com/a?b=1', consent: true })

    fetch.mockResolvedValueOnce(jsonResponse({ id: 'bad id' }))
    await expect(client.scan('https://example.com', true)).rejects.toThrow('Invalid scan response')
    fetch.mockResolvedValueOnce(jsonResponse({ id: 'valid' }, 500))
    await expect(client.scan('https://example.com', true)).rejects.toThrow('Clyvro request failed')
  })

  it('aborts timed-out requests and does not leak the secret in errors', async () => {
    const fetch = vi.fn<FetchLike>((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
    }))
    const client = new ClyvroClient('top-secret', { fetch, timeoutMs: 5 })
    await expect(client.guard({ method: 'GET', path: '/' })).rejects.toThrow('Clyvro request timed out')
    await expect(client.guard({ method: 'GET', path: '/' })).rejects.not.toThrow('top-secret')
  })
})
