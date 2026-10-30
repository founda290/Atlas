import { expect, test, type Page } from '@playwright/test'
const routes = [
  '/',
  '/features',
  '/integrations',
  '/pricing',
  '/docs',
  '/login',
  '/signup',
  '/dashboard',
  '/projects',
  '/projects/atlas-test-workspace',
  '/projects/atlas-test-workspace/sessions/missing-session',
  '/models',
  '/integrations/manage',
  '/settings',
]
const articles = [
  'introduction',
  'getting-started',
  'workspace',
  'projects',
  'sessions',
  'runtime',
  'providers',
  'troubleshooting',
  'security',
]
async function stable(page: Page) {
  await page.locator('h1').first().waitFor()
  await expect(page.locator('.loading-state')).toHaveCount(0, { timeout: 20000 })
  await page.evaluate(() => document.fonts.ready)
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    `Horizontal overflow at ${page.url()}`,
  ).toBe(true)
}
for (const width of [360, 390, 430, 768, 1024, 1440]) {
  test(`all 14 routes at ${width}px with real API/unavailable states`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    for (const route of routes) {
      await page.goto(route)
      await stable(page)
      await noOverflow(page)
      await expect(page.locator('h1')).toHaveCount(1)
      if (route.includes('/sessions/missing-session'))
        await expect(page.locator('.workspace-header-actions')).toContainText('Session unavailable')
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: `test-results/route-review/${width}/${route === '/' ? 'home' : route.slice(1).replaceAll('/', '-')}.png`,
          fullPage: true,
        })
    }
    expect(errors).toEqual([])
  })
}
test('all documentation articles and preserved system pages load', async ({ page }) => {
  for (const article of articles) {
    await page.goto(`/docs/${article}`)
    await stable(page)
    await expect(page.locator('.docs-article section')).not.toHaveCount(0)
    await noOverflow(page)
  }
  for (const code of [
    '400',
    '401',
    '403',
    '404',
    '408',
    '429',
    '500',
    '502',
    '503',
    'offline',
    'not-a-route',
  ]) {
    await page.goto(`/${code}`)
    await stable(page)
    await expect(page.locator('.status-page')).toBeVisible()
  }
})
test('every rendered internal navigation destination resolves', async ({ page }) => {
  const destinations = new Set<string>()
  for (const route of [
    ...routes.filter((item) => !item.includes('/sessions/')),
    '/docs/security',
  ]) {
    await page.goto(route)
    await stable(page)
    const links = await page
      .locator('a[href^="/"]')
      .evaluateAll((elements) => elements.map((element) => element.getAttribute('href')!))
    links.forEach((link) => destinations.add(link))
  }
  for (const destination of destinations) {
    await page.goto(destination)
    await stable(page)
    await expect(page.locator('.fatal-error')).toHaveCount(0)
    await expect(page.locator('.status-code')).toHaveCount(0)
  }
})
test('mobile drawers trap focus, close with Escape and navigate', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const trigger = page.getByRole('button', { name: 'Open site navigation' })
  await trigger.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Close navigation' }).focus()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('dialog').getByRole('link', { name: 'Open workspace' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.getByRole('dialog').getByRole('link', { name: 'Features', exact: true }).click()
  await expect(page).toHaveURL(/features/)
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Open workspace navigation' }).click()
  await page.getByRole('dialog').getByRole('link', { name: 'Settings', exact: true }).click()
  await expect(page).toHaveURL(/settings/)
  await expect(page.getByRole('dialog')).not.toBeVisible()
})
test('display preferences save, cancel and persist', async ({ page }) => {
  await page.goto('/settings')
  await stable(page)
  await page.getByLabel('Workspace theme', { exact: true }).selectOption('light')
  await page.getByRole('button', { name: 'Cancel changes' }).click()
  await expect(page.getByLabel('Workspace theme', { exact: true })).toHaveValue('dark')
  await page.getByLabel('Workspace theme', { exact: true }).selectOption('light')
  await page.getByLabel('Interface density', { exact: true }).selectOption('compact')
  await page.getByLabel('Wrap code blocks in agent messages').uncheck()
  await page.getByRole('button', { name: 'Save preferences' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Preferences saved' })).toBeVisible()
  await expect(page.locator('.app-shell')).toHaveAttribute('data-app-theme', 'light')
  await page.reload()
  await expect(page.locator('.app-shell')).toHaveClass(/density-compact/)
  await expect(page.getByLabel('Workspace theme', { exact: true })).toHaveValue('light')
  await expect(page.getByLabel('Wrap code blocks in agent messages')).not.toBeChecked()
  await page.getByRole('button', { name: 'Use dark workspace theme' }).click()
  await expect(page.locator('.app-shell')).toHaveAttribute('data-app-theme', 'dark')
  await expect(page.getByLabel('Workspace theme', { exact: true })).toHaveValue('dark')
  await page.reload()
  await expect(page.locator('.app-shell')).toHaveAttribute('data-app-theme', 'dark')
  await page.goto('/')
  expect(
    await page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe('rgb(245, 243, 238)')
})
test('account forms validate without network credential submission', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST') requests.push(request.url())
  })
  await page.goto('/signup')
  await page.getByRole('button', { name: 'Create account — not enabled' }).click()
  await expect(page.getByText('Enter your name.', { exact: true })).toBeVisible()
  await page.getByLabel('Name', { exact: true }).fill('Test developer')
  await page.getByLabel('Email address').fill('developer@example.com')
  await page.getByLabel('Password', { exact: true }).fill('test-only-password')
  await page.getByLabel('Confirm password', { exact: true }).fill('mismatch')
  await page.getByRole('button', { name: 'Create account — not enabled' }).click()
  await expect(page.getByText('Passwords must match.', { exact: true })).toBeVisible()
  await page.getByLabel('Confirm password', { exact: true }).fill('test-only-password')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Create account — not enabled' }).click()
  await expect(page.getByRole('alert')).toContainText('Account creation is not enabled')
  await page.goto('/login')
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await expect(page.getByRole('dialog')).toContainText('No request has been sent')
  expect(requests).toEqual([])
})
test('search and view controls work; unsupported project actions explain limits', async ({
  page,
}) => {
  await page.goto('/projects')
  await stable(page)
  await page.getByRole('searchbox', { name: 'Search projects' }).fill('not-a-project')
  await expect(page.getByText('No matching projects', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(page.getByRole('heading', { name: 'Local test workspace' })).toBeVisible()
  await page.getByRole('tab', { name: 'List', exact: true }).click()
  await expect(page.locator('.projects-list')).toBeVisible()
  await page.getByRole('button', { name: 'New project' }).click()
  await expect(page.getByRole('dialog')).toContainText('no project has been created')
  await page.keyboard.press('Escape')
  await page.goto('/integrations')
  await page
    .getByRole('combobox', { name: 'Integration category' })
    .selectOption('MCP integrations')
  await expect(page.locator('.directory-card')).toHaveCount(1)
})
// Test-only runtime fixtures. None of these records is imported by product code.
async function fixtureSession(page: Page) {
  await page.route('**/api/v1/workspaces/atlas-test-workspace/file?*', (route) => {
    const file = new URL(route.request().url()).searchParams.get('path') ?? ''
    const content = "export const atlasFixture = 'read-only UI fixture'\n"
    return route.fulfill({
      json: {
        data: {
          workspaceId: 'atlas-test-workspace',
          path: file,
          content,
          bytes: content.length,
          encoding: 'utf-8',
          readOnly: true,
        },
      },
    })
  })
  await page.route('**/api/v1/sessions/test-session-id/diff', (route) =>
    route.fulfill({
      json: {
        data: {
          sessionId: 'test-session-id',
          diffs: [
            { file: 'src/test.ts', before: 'old\n', after: 'new\n', additions: 1, deletions: 1 },
          ],
          omitted: 0,
          source: 'opencode-session',
          authoritativeFilesystem: false,
          fetchedAt: Date.now(),
        },
      },
    }),
  )
  await page.route('**/api/v1/sessions/test-session-id/messages', async (route) => {
    if (route.request().method() === 'POST')
      return route.fulfill({ json: { data: { status: 'running' } } })
    await route.fulfill({
      json: {
        data: {
          sessionId: 'test-session-id',
          messages: [
            {
              info: {
                id: 'test-user-message',
                role: 'user',
                summary: {
                  diffs: [
                    {
                      file: 'src/test.ts',
                      before: 'old\n',
                      after: 'new\n',
                      additions: 1,
                      deletions: 1,
                    },
                  ],
                },
              },
              parts: [{ type: 'text', text: 'Test fixture instruction' }],
            },
            {
              info: { id: 'test-assistant-message', role: 'assistant' },
              parts: [
                {
                  type: 'text',
                  text: 'Test-only assistant response.\n\n```ts\nconst test = true\n```',
                },
                { type: 'tool', tool: 'test-tool', state: { status: 'completed' } },
              ],
            },
          ],
        },
      },
    })
  })
  await page.route('**/api/v1/sessions/test-session-id/cancel', (route) =>
    route.fulfill({ json: { data: { status: 'cancelled', cancelled: true } } }),
  )
  await page.route('**/api/v1/workspaces/atlas-test-workspace/status', (route) =>
    route.fulfill({
      json: {
        data: {
          workspaceId: 'atlas-test-workspace',
          files: [
            { path: 'src/test.ts', bytes: 10, kind: 'file' },
            { path: 'README.md', bytes: 50, kind: 'file' },
          ],
        },
      },
    }),
  )
  await page.addInitScript(() => {
    class TestEventSource extends EventTarget {
      onerror: (() => void) | null = null
      private timer: ReturnType<typeof setTimeout>
      private relay = (event: Event) => {
        const detail = (event as CustomEvent<{ type: string; data: unknown }>).detail
        this.dispatchEvent(new MessageEvent(detail.type, { data: JSON.stringify(detail.data) }))
      }
      constructor() {
        super()
        window.addEventListener('atlas-test-runtime-event', this.relay)
        this.timer = setTimeout(
          () =>
            this.dispatchEvent(
              new MessageEvent('connected', {
                data: JSON.stringify({ sessionId: 'test-session-id', status: 'ready' }),
              }),
            ),
          100,
        )
      }
      close() {
        clearTimeout(this.timer)
        window.removeEventListener('atlas-test-runtime-event', this.relay)
      }
    }
    Object.defineProperty(window, 'EventSource', { value: TestEventSource })
  })
}
for (const width of [360, 390, 430, 768, 1024, 1440]) {
  test(`workspace interactions at ${width}px using explicit test fixtures`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await fixtureSession(page)
    await page.goto('/projects/atlas-test-workspace/sessions/test-session-id')
    await stable(page)
    await expect(page.locator('.stream-status')).toContainText('Event stream connected')
    await expect(page.getByText('Test-only assistant response.')).toBeVisible()
    await noOverflow(page)
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: `test-results/workspace-review/${width}-agent.png`,
        fullPage: true,
      })
    await page.getByRole('tab', { name: 'Files', exact: true }).click()
    await page.getByRole('button', { name: /test.ts/ }).click()
    await expect(page.locator('.file-source')).toContainText('read-only UI fixture')
    await noOverflow(page)
    await page.getByRole('tab', { name: 'Changes', exact: true }).click()
    await expect(page.locator('.diff-code')).toContainText('new')
    await noOverflow(page)
    await page.getByRole('tab', { name: 'Activity', exact: true }).click()
    await expect(page.getByText('No activity received yet', { exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Agent', exact: true }).click()
    await page
      .getByRole('textbox', { name: 'Instruction for OpenCode' })
      .fill('Test fixture submission')
    await page.getByRole('textbox', { name: 'Instruction for OpenCode' }).press('Shift+Enter')
    await expect(page.getByRole('textbox', { name: 'Instruction for OpenCode' })).toHaveValue(
      'Test fixture submission\n',
    )
    await page.getByRole('textbox', { name: 'Instruction for OpenCode' }).press('Enter')
    await expect(page.getByRole('button', { name: 'Stop execution' })).toBeVisible()
    await page.getByRole('button', { name: 'Stop execution' }).click()
    await expect(page.locator('.workspace-header-actions')).toContainText('cancelled')
  })
}
test('API failures stay visible instead of returning invented data', async ({ page }) => {
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({
      status: 503,
      json: { data: { error: { message: 'Test-only unavailable backend' } } },
    }),
  )
  for (const route of [
    '/dashboard',
    '/projects',
    '/projects/atlas-test-workspace',
    '/models',
    '/integrations/manage',
    '/settings',
  ]) {
    await page.goto(route)
    await stable(page)
    await expect(page.getByRole('alert').first()).toContainText('Test-only unavailable backend')
  }
})

test('session creation failure stays in its dialog without recording a fake session', async ({
  page,
}) => {
  await page.route('**/api/v1/sessions', (route) =>
    route.fulfill({
      status: 503,
      json: { data: { error: { message: 'Test-only runtime unavailable' } } },
    }),
  )
  await page.goto('/projects/atlas-test-workspace')
  await stable(page)
  await page.getByRole('button', { name: 'New coding session' }).first().click()
  await page.getByLabel('Session title').fill('Test-only attempted session')
  await page.getByRole('button', { name: 'Create session', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'Test-only runtime unavailable',
  )
  expect(await page.evaluate(() => localStorage.getItem('atlas-session-index-v1'))).toBeNull()
})

test('documentation code copy uses the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/docs/runtime')
  await page.getByRole('button', { name: 'Copy code' }).click()
  await expect(page.getByRole('button', { name: 'Copied', exact: true })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('/api/v1/sessions')
})

test('critical and serious accessibility checks on every main route', async ({ page }) => {
  const { default: AxeBuilder } = await import('@axe-core/playwright')
  for (const route of routes) {
    await page.goto(route)
    await stable(page)
    const results = await new AxeBuilder({ page }).analyze()
    const issues = results.violations.filter(
      (item) => item.impact === 'critical' || item.impact === 'serious',
    )
    expect
      .soft(
        issues.map((item) => ({ rule: item.id, nodes: item.nodes.map((node) => node.target) })),
        route,
      )
      .toEqual([])
  }
})

test('streamed parts update the transcript and actual event activity', async ({ page }) => {
  await fixtureSession(page)
  await page.goto('/projects/atlas-test-workspace/sessions/test-session-id')
  await expect(page.locator('.stream-status')).toContainText('Event stream connected')
  await page.evaluate(() => {
    for (const [type, data] of [
      ['message.updated', { info: { id: 'test-streamed-message', role: 'assistant' } }],
      [
        'message.part.updated',
        {
          part: {
            id: 'test-streamed-part',
            messageID: 'test-streamed-message',
            type: 'text',
            text: 'Test-only streamed response',
          },
        },
      ],
      [
        'message.part.updated',
        {
          part: {
            id: 'test-streamed-tool',
            messageID: 'test-streamed-message',
            type: 'tool',
            tool: 'test-tool',
            state: { status: 'running' },
          },
        },
      ],
    ]) {
      window.dispatchEvent(
        new CustomEvent('atlas-test-runtime-event', {
          detail: { type, data: { type, sessionId: 'test-session-id', data } },
        }),
      )
    }
  })
  await expect(page.getByText('Test-only streamed response', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Activity', exact: true }).click()
  await expect(page.getByText('test-tool · running', { exact: true })).toBeVisible()
})

test('runtime-discovered provider search does not invent models or credentials', async ({
  page,
}) => {
  await page.route('**/api/v1/health', (route) =>
    route.fulfill({
      json: {
        data: {
          atlas: 'ok',
          runtime: {
            status: 'ready',
            providers: [
              { id: 'test-provider-a', name: 'Test Provider A' },
              { id: 'test-provider-b', name: 'Test Provider B' },
            ],
          },
        },
      },
    }),
  )
  await page.goto('/models')
  await stable(page)
  await expect(page.locator('.provider-grid .directory-card')).toHaveCount(2)
  await page.getByRole('searchbox', { name: 'Search discovered providers' }).fill('Provider B')
  await expect(page.locator('.provider-grid .directory-card')).toHaveCount(1)
  await expect(page.locator('.provider-grid')).toContainText('Not verified')
  await expect(page.locator('.provider-grid')).toContainText('Discovery not exposed')
})

for (const width of [390, 1440]) {
  test(`read-only content and on-demand diff refresh at ${width}px (API fixtures)`, async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.setViewportSize({ width, height: 900 })
    await fixtureSession(page)
    let source = 'export const fixtureValue = 1\n'
    let fileFailure = false
    let diffFailure = false
    let diffCalls = 0
    await page.route('**/api/v1/workspaces/atlas-test-workspace/file?*', (route) =>
      route.fulfill({
        status: fileFailure ? 413 : 200,
        json: {
          data: fileFailure
            ? { error: { message: 'Fixture: file exceeds the 256 KiB text-preview limit' } }
            : {
                workspaceId: 'atlas-test-workspace',
                path: 'src/test.ts',
                content: source,
                bytes: source.length,
                encoding: 'utf-8',
                readOnly: true,
              },
        },
      }),
    )
    await page.route('**/api/v1/sessions/test-session-id/diff', (route) => {
      diffCalls++
      return route.fulfill({
        status: diffFailure ? 503 : 200,
        json: {
          data: diffFailure
            ? { error: { message: 'Fixture: runtime diff unavailable' } }
            : {
                sessionId: 'test-session-id',
                diffs: [
                  {
                    file: 'src/test.ts',
                    before: 'before fixture\n',
                    after: 'after fixture\n',
                    additions: 1,
                    deletions: 1,
                  },
                ],
                omitted: 1,
                source: 'opencode-session',
                authoritativeFilesystem: false,
                fetchedAt: Date.now(),
              },
        },
      })
    })
    await page.goto('/projects/atlas-test-workspace/sessions/test-session-id')
    await expect(page.locator('.message')).toHaveCount(2)
    expect(diffCalls).toBe(0)
    await page.getByRole('tab', { name: 'Files', exact: true }).click()
    await page.getByRole('button', { name: /test.ts/ }).click()
    await expect(page.locator('.file-source')).toContainText('export const fixtureValue = 1')
    await page.locator('.file-content').getByRole('button', { name: 'Copy code' }).click()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(source)
    expect(await page.locator('.file-content textarea').count()).toBe(0)
    await noOverflow(page)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
    await page.screenshot({ path: `test-results/phase4-review/${width}-file.png`, fullPage: true })
    const { default: AxeBuilder } = await import('@axe-core/playwright')
    expect(
      (await new AxeBuilder({ page }).analyze()).violations.filter(
        (item) => item.impact === 'critical' || item.impact === 'serious',
      ),
    ).toEqual([])
    fileFailure = true
    await page.getByRole('button', { name: 'Refresh file' }).click()
    await expect(page.locator('.file-content').getByRole('alert')).toContainText('256 KiB')
    await expect(page.locator('.file-source')).toHaveCount(0)
    fileFailure = false
    source = 'export const fixtureValue = 2\n'
    await page.locator('.file-content').getByRole('button', { name: 'Try again' }).click()
    await expect(page.locator('.file-source')).toContainText('export const fixtureValue = 2')
    await page.getByRole('tab', { name: 'Changes', exact: true }).click()
    await expect(page.getByLabel('Runtime diff for src/test.ts')).toContainText('after fixture')
    await expect(page.locator('.changes-view')).toContainText(
      'not an authoritative filesystem or Git comparison',
    )
    await expect(page.locator('.changes-view')).toContainText('1 entry omitted')
    await noOverflow(page)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
    await page.screenshot({ path: `test-results/phase4-review/${width}-diff.png`, fullPage: true })
    expect(
      (await new AxeBuilder({ page }).analyze()).violations.filter(
        (item) => item.impact === 'critical' || item.impact === 'serious',
      ),
    ).toEqual([])
    if (width === 1440) {
      await page.getByRole('button', { name: 'Use light workspace theme' }).click()
      expect(
        (await new AxeBuilder({ page }).analyze()).violations.filter(
          (item) => item.impact === 'critical' || item.impact === 'serious',
        ),
      ).toEqual([])
      await page.screenshot({
        path: 'test-results/phase4-review/1440-diff-light.png',
        fullPage: true,
      })
    }
    diffFailure = true
    await page.getByRole('button', { name: 'Refresh diff' }).click()
    await expect(page.locator('.changes-view').getByRole('alert')).toContainText(
      'runtime diff unavailable',
    )
    await expect(page.getByLabel('Runtime diff for src/test.ts')).toHaveCount(0)
    expect(
      (await new AxeBuilder({ page }).analyze()).violations.filter(
        (item) => item.impact === 'critical' || item.impact === 'serious',
      ),
    ).toEqual([])
  })
}
