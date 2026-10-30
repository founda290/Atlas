import { createAuthClient } from 'better-auth/client'
import { jwtClient } from 'better-auth/client/plugins'

export function authURL(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
      return null
    return url.href.replace(/\/$/, '')
  } catch {
    return null
  }
}
// This is the PUBLIC Neon Auth service URL, never a database URL or provider key.
export const accountURL = authURL(import.meta.env.VITE_NEON_AUTH_URL)
const client = accountURL
  ? createAuthClient({
      baseURL: accountURL,
      plugins: [jwtClient()],
      fetchOptions: { credentials: 'include', timeout: 15000, retry: 0 },
    })
  : null
export interface AccountUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
}
function required() {
  if (!client)
    throw new Error(
      'Neon Auth is not configured. Set VITE_NEON_AUTH_URL and authorize this site in Neon Auth. No credentials were sent.',
    )
  return client
}
function checked<T>(result: { data: T; error: { code?: string; message?: string } | null }): T {
  if (result.error) {
    const code = result.error.code
    const messages: Record<string, string> = {
      INVALID_EMAIL_OR_PASSWORD: 'Email or password is incorrect.',
      EMAIL_NOT_VERIFIED: 'Verify your email address before signing in.',
      USER_ALREADY_EXISTS:
        'Unable to create this account. Try signing in or resetting your password.',
      INVALID_TOKEN: 'This link is invalid or expired. Request a new email.',
      TOO_MANY_REQUESTS: 'Too many attempts. Wait before trying again.',
    }
    throw new Error(
      messages[code ?? ''] ??
        'The account request was not completed. Check your connection, Neon Auth configuration and email, then retry.',
    )
  }
  return result.data
}
export const account = {
  configured: !!client,
  async session(): Promise<AccountUser | null> {
    if (!client) return null
    const session = checked(await client.getSession({ query: { disableCookieCache: true } }))
    return session?.user
      ? {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          emailVerified: session.user.emailVerified,
        }
      : null
  },
  async signIn(email: string, password: string) {
    checked(await required().signIn.email({ email, password }))
  },
  async signUp(name: string, email: string, password: string) {
    checked(
      await required().signUp.email({
        name,
        email,
        password,
        callbackURL: `${location.origin}/account`,
      }),
    )
  },
  async signOut() {
    checked(await required().signOut())
  },
  async requestReset(email: string) {
    checked(
      await required().requestPasswordReset({
        email,
        redirectTo: `${location.origin}/reset-password`,
      }),
    )
  },
  async reset(token: string, newPassword: string) {
    checked(await required().resetPassword({ token, newPassword }))
  },
  async verify(email: string) {
    checked(
      await required().sendVerificationEmail({
        email,
        callbackURL: `${location.origin}/account`,
      }),
    )
  },
  async token(): Promise<string> {
    const data = checked(await required().token())
    if (!data?.token) throw new Error('Sign in before accessing cloud projects.')
    return data.token
  },
}
