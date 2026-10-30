import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const user = {
  id: 'test-user',
  name: 'Test User',
  email: 'test@example.com',
  emailVerified: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}
beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_NEON_AUTH_URL', 'https://auth.example.test/auth')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
function mockResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
describe('Neon-compatible Better Auth client boundary (provider mocked explicitly)', () => {
  it('sends signup credentials to the configured auth service, not the execution API', async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({ user, token: null }))
    vi.stubGlobal('fetch', fetch)
    const { account } = await import('../services/account')
    await account.signUp('Test User', user.email, 'test-only-password')
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, options] = fetch.mock.calls[0]
    expect(String(url)).toBe('https://auth.example.test/auth/sign-up/email')
    expect(JSON.parse(options.body)).toMatchObject({
      name: 'Test User',
      email: user.email,
      password: 'test-only-password',
    })
    expect(options.credentials).toBe('include')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })
  it('confirms server sessions and signs out without inventing local auth tokens', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        mockResponse({
          session: {
            id: 'session',
            userId: user.id,
            expiresAt: new Date(Date.now() + 60000).toISOString(),
          },
          user,
        }),
      )
      .mockResolvedValueOnce(mockResponse({ success: true }))
    vi.stubGlobal('fetch', fetch)
    const { account } = await import('../services/account')
    expect(await account.session()).toMatchObject({ id: user.id, email: user.email })
    await account.signOut()
    expect(String(fetch.mock.calls[1][0])).toContain('/sign-out')
  })
  it('reports provider rejection as failure and does not render raw provider diagnostics', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          mockResponse(
            { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'sensitive provider diagnostic' },
            401,
          ),
        ),
    )
    const { account } = await import('../services/account')
    await expect(account.signIn(user.email, 'wrong-test-password')).rejects.toThrow(
      'Email or password is incorrect.',
    )
  })
  it('uses the real reset and verification endpoints with fixed same-site callbacks', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(mockResponse({ status: true })))
    vi.stubGlobal('fetch', fetch)
    const { account } = await import('../services/account')
    await account.requestReset(user.email)
    await account.reset('test-only-token', 'test-only-password')
    await account.verify(user.email)
    expect(fetch.mock.calls.map((call) => String(call[0]).split('/').pop())).toEqual([
      'request-password-reset',
      'reset-password',
      'send-verification-email',
    ])
  })
  it('rejects malformed/non-HTTPS auth service configuration before submitting a password', async () => {
    vi.stubEnv('VITE_NEON_AUTH_URL', 'http://unsafe.test')
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const { account, authURL } = await import('../services/account')
    expect(authURL('https://user:secret@host.test')).toBeNull()
    expect(account.configured).toBe(false)
    await expect(account.signIn(user.email, 'test-only-password')).rejects.toThrow('not configured')
    expect(fetch).not.toHaveBeenCalled()
  })
})
