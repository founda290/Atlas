import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
test.use({ baseURL: 'http://127.0.0.1:5174' })
test('configured account registration, session, verification, sign-out and reset UI (explicit provider fixture)', async ({
  page,
}) => {
  let signedIn = false
  const calls: { path: string; body: Record<string, unknown> }[] = [],
    user = {
      id: 'fixture-account',
      name: 'Fixture Developer',
      email: 'fixture@example.com',
      emailVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  await page.route('https://auth.atlas-test.invalid/auth/**', async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.split('/').pop()!,
      body = request.method() === 'POST' ? (request.postDataJSON() as Record<string, unknown>) : {}
    if (request.method() === 'POST') calls.push({ path, body })
    const origin = 'http://127.0.0.1:5174',
      headers = {
        'access-control-allow-origin': origin,
        'access-control-allow-credentials': 'true',
        'access-control-allow-headers': 'content-type',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
      }
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers })
      return
    }
    if (path === 'email' && body.password === 'wrong-fixture-password') {
      await route.fulfill({
        status: 401,
        json: { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'fixture failure' },
        headers,
      })
      return
    }
    let data: unknown = { status: true }
    if (path === 'get-session')
      data = signedIn
        ? {
            user,
            session: {
              id: 'fixture-session',
              userId: user.id,
              expiresAt: new Date(Date.now() + 60000).toISOString(),
            },
          }
        : null
    if (path === 'email') {
      if (request.url().includes('sign-in')) signedIn = true
      data = { user, token: null }
    }
    if (path === 'sign-out') signedIn = false
    await route.fulfill({ json: data, headers })
  })
  await page.goto('/signup')
  await page.getByLabel('Name', { exact: true }).fill('Fixture Developer')
  await page.getByLabel('Email address').fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill('fixture-only-password')
  await page.getByLabel('Confirm password', { exact: true }).fill('fixture-only-password')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('registration was accepted')
  expect(calls.some((v) => v.path === 'email' && v.body.name === 'Fixture Developer')).toBe(true)
  await page.goto('/login')
  await page.getByLabel('Email address').fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill('wrong-fixture-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect.')
  await page.getByLabel('Password', { exact: true }).fill('fixture-only-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/browser-projects/)
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: user.name, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Send verification email' }).click()
  await expect(page.getByRole('status')).toContainText('Verification email requested')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByText('You are not signed in.', { exact: true })).toBeVisible()
  await page.goto('/login?reset=true')
  await page.getByLabel('Reset email').fill(user.email)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('check your inbox')
  await page.goto('/reset-password?token=fixture-only-reset-token')
  await page.getByLabel('New password', { exact: true }).fill('new-fixture-password')
  await page.getByLabel('Confirm new password').fill('new-fixture-password')
  await page.getByRole('button', { name: 'Reset password', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Your password was changed')
  await expect(page).not.toHaveURL(/token=/)
  expect(calls.find((v) => v.path === 'reset-password')?.body).toMatchObject({
    token: 'fixture-only-reset-token',
    newPassword: 'new-fixture-password',
  })
  for (const url of ['/account', '/signup', '/reset-password', '/cloud-projects']) {
    await page.goto(url)
    await expect(page.getByRole('heading').first()).toBeVisible()
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
      [],
    )
  }
})
