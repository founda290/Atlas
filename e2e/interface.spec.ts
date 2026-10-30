import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
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
  '/projects/11111111-1111-4111-8111-111111111111',
  '/projects/11111111-1111-4111-8111-111111111111/sessions/missing-session',
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
test('project search and real creation controls plus integration filters', async ({ page }) => {
  await page.goto('/projects')
  await stable(page)
  await page.getByRole('searchbox', { name: 'Search projects' }).fill('not-a-project')
  await expect(page.getByText('No matching projects', { exact: true })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search projects' }).fill('')
  await page.getByRole('button', { name: 'List view' }).click()
  await page.getByRole('button', { name: 'New project' }).click()
  await expect(page.getByRole('dialog')).toContainText('backend-managed location')
  await page.keyboard.press('Escape')
  await page.goto('/integrations')
  await page
    .getByRole('combobox', { name: 'Integration category' })
    .selectOption('MCP integrations')
  await expect(page.locator('.directory-card')).toHaveCount(1)
})
// Test-only runtime fixtures. None of these records is imported by product code.
async function fixtureSession(page: Page) {
  await page.route(
    '**/api/v1/projects/11111111-1111-4111-8111-111111111111/files/content?*',
    (route) => {
      const file = new URL(route.request().url()).searchParams.get('path') ?? ''
      const content = "export const atlasFixture = 'read-only UI fixture'\n"
      return route.fulfill({
        json: {
          data: {
            workspaceId: '11111111-1111-4111-8111-111111111111',
            path: file,
            content,
            bytes: content.length,
            encoding: 'utf-8',
            readOnly: true,
            version: 'fixture-version',
            modifiedAt: Date.now(),
          },
        },
      })
    },
  )
  await page.route('**/api/v1/projects/11111111-1111-4111-8111-111111111111/diff?*', (route) =>
    route.fulfill({
      json: {
        data: {
          sessionId: 'test-session-id',
          diffs: [
            {
              file: 'src/test.ts',
              path: 'src/test.ts',
              status: ' M',
              version: 'fixture-git',
              before: 'old\n',
              after: 'new\n',
              unified: '-old\n+new\n',
              additions: 1,
              deletions: 1,
            },
          ],
          omitted: 0,
          repository: true,
          branch: 'fixture-main',
          files: [],
          attribution: 'unattributed',
          comparison: 'working',
          source: 'git',
          authoritativeFilesystem: true,
          fetchedAt: Date.now(),
        },
      },
    }),
  )
  await page.route('**/api/v1/sessions/test-session-id/messages?*', async (route) => {
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
  await page.route('**/api/v1/sessions/test-session-id/cancel?*', (route) =>
    route.fulfill({ json: { data: { status: 'cancelled', cancelled: true } } }),
  )
  await page.route('**/api/v1/workspaces/11111111-1111-4111-8111-111111111111/status', (route) =>
    route.fulfill({
      json: {
        data: {
          workspaceId: '11111111-1111-4111-8111-111111111111',
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
    await page.goto('/projects/11111111-1111-4111-8111-111111111111/sessions/test-session-id')
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
    '/projects/11111111-1111-4111-8111-111111111111',
    '/models',
    '/integrations/manage',
    '/settings',
  ]) {
    await page.goto(route)
    await stable(page)
    await expect(page.getByRole('alert').first()).toContainText('Test-only unavailable backend')
  }
})

test('session creation failure stays visible and never fabricates a session', async ({ page }) => {
  const name = `Failure ${Date.now()}`
  const response = await page.request.post('/api/v1/projects', {
    data: { name, description: 'Browser test', location: 'managed' },
  })
  expect(response.status()).toBe(201)
  const p = (await response.json()).data
  await page.route('**/api/v1/providers?*', (route) =>
    route.fulfill({ json: { data: { providers: [] } } }),
  )
  await page.route(`**/api/v1/projects/${p.id}/sessions`, (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 503,
          json: { data: { error: { message: 'Test-only runtime unavailable' } } },
        })
      : route.continue(),
  )
  await page.goto(`/projects/${p.id}`)
  await page.getByRole('button', { name: 'New coding session' }).click()
  await page.getByLabel('Session title').fill('Attempted session')
  await page.getByRole('button', { name: 'Create session', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'Test-only runtime unavailable',
  )
  await page.request.delete(`/api/v1/projects/${p.id}`, { data: { confirmName: name } })
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
  await page.goto('/projects/11111111-1111-4111-8111-111111111111/sessions/test-session-id')
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
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent('atlas-test-runtime-event', {
        detail: {
          type: 'message.part.delta',
          data: {
            type: 'message.part.delta',
            sessionId: 'test-session-id',
            data: {
              messageID: 'test-streamed-message',
              partID: 'test-streamed-part',
              field: 'text',
              delta: ' plus delta',
            },
          },
        },
      }),
    ),
  )
  await expect(
    page.getByText('Test-only streamed response plus delta', { exact: true }),
  ).toBeVisible()
  await page.getByRole('tab', { name: 'Activity', exact: true }).click()
  await expect(page.getByText('test-tool · running', { exact: true })).toBeVisible()
})

test('runtime provider/model discovery is not a credential guarantee', async ({ page }) => {
  await page.route('**/api/v1/providers', (route) =>
    route.fulfill({
      json: {
        data: {
          providers: [
            {
              id: 'test-provider-a',
              name: 'Test Provider A',
              connected: true,
              authentication: 'runtime-connected',
              models: [],
            },
            {
              id: 'test-provider-b',
              name: 'Test Provider B',
              connected: true,
              authentication: 'runtime-connected',
              models: [],
            },
          ],
        },
      },
    }),
  )
  await page.goto('/models')
  await stable(page)
  await expect(page.locator('.provider-grid .directory-card')).toHaveCount(2)
  await page.getByRole('searchbox', { name: 'Search discovered providers' }).fill('Provider B')
  await expect(page.locator('.provider-grid .directory-card')).toHaveCount(1)
  await expect(page.locator('.provider-grid')).toContainText('not independently verified')
})

for (const width of [390, 1440]) {
  test(`real project editor, safe save and Git workflow at ${width}px`, async ({ page }) => {
    test.setTimeout(60000)
    await page.setViewportSize({ width, height: 900 })
    const name = `Engineering ${width} ${Date.now()}`
    await page.goto('/projects')
    await page.getByRole('button', { name: 'New project' }).click()
    await page.getByLabel('Project name', { exact: true }).fill(name)
    await page.getByLabel('Description', { exact: true }).fill('Real browser workflow')
    await page.getByRole('button', { name: 'Create project', exact: true }).click()
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
    const id = page.url().split('/projects/')[1]
    await page.getByRole('link', { name: 'Open editor', exact: true }).click()
    await page.getByRole('button', { name: 'New file / folder' }).click()
    await page.getByLabel('Relative path', { exact: true }).fill('sample.ts')
    await page.getByRole('button', { name: 'Confirm create' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: /sample.ts/ }).click()
    const editor = page.getByRole('textbox', { name: 'Code editor: sample.ts' })
    await editor.fill('export const value = 1\n')
    await expect(page.getByRole('tab', { name: 'sample.ts •', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Save file', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Saved by backend.' })).toBeVisible()
    const disk = (
      await (await page.request.get(`/api/v1/projects/${id}/files/content?path=sample.ts`)).json()
    ).data
    expect(disk.content).toBe('export const value = 1\n')
    await editor.fill('unsaved edit')
    page.once('dialog', (dialog) => dialog.dismiss())
    await page.getByRole('button', { name: 'Close sample.ts', exact: true }).click()
    await expect(page.getByRole('tab', { name: 'sample.ts •', exact: true })).toBeVisible()
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Reload file', exact: true }).click()
    await expect(editor).toContainText('export const value = 1')
    await noOverflow(page)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.screenshot({ path: `test-results/engineering/${width}-editor.png`, fullPage: true })
    await page.getByRole('button', { name: 'Git changes', exact: true }).click()
    await expect(page.getByLabel('Git diff for sample.ts')).toContainText('+export const value = 1')
    await page.getByRole('button', { name: 'Stage sample.ts', exact: true }).click()
    await expect(
      page.getByText('No visible changes in this comparison', { exact: true }),
    ).toBeVisible()
    await page.getByRole('combobox', { name: 'Git comparison' }).selectOption('staged')
    await expect(page.getByLabel('Git diff for sample.ts')).toBeVisible()
    await page.getByRole('button', { name: 'Unstage sample.ts', exact: true }).click()
    await expect(
      page.getByText('No visible changes in this comparison', { exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Files and editor', exact: true }).click()
    await page.getByRole('button', { name: 'Delete file', exact: true }).click()
    await page.getByLabel('Type the exact path to confirm', { exact: true }).fill('sample.ts')
    await page.getByRole('button', { name: 'Confirm delete', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(
      (await page.request.get(`/api/v1/projects/${id}/files/content?path=sample.ts`)).status(),
    ).toBe(404)
    await page.getByRole('button', { name: 'New file / folder' }).click()
    await page.getByLabel('Relative path', { exact: true }).fill('empty-folder')
    await page.getByRole('checkbox', { name: /Folder/ }).check()
    await page.getByRole('button', { name: 'Confirm create' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: 'Rename empty folder' }).click()
    await page.getByLabel('Relative path', { exact: true }).fill('empty-folder')
    await page.getByLabel('Destination path').fill('renamed-folder')
    await page.getByRole('button', { name: 'Confirm rename' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: 'Delete empty folder' }).click()
    await page.getByLabel('Relative path', { exact: true }).fill('renamed-folder')
    await page.getByLabel('Type the exact path to confirm').fill('renamed-folder')
    await page.getByRole('button', { name: 'Confirm delete' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await page.getByRole('link', { name: 'Project overview', exact: true }).click()
    await page.getByRole('button', { name: 'Archive project' }).click()
    await expect(page.getByRole('button', { name: 'Restore project' })).toBeVisible()
    await page.getByRole('button', { name: 'Restore project' }).click()
    await expect(page.getByRole('button', { name: 'Archive project' })).toBeVisible()
    await page.getByRole('button', { name: 'Delete project', exact: true }).click()
    await page.getByLabel(`Type ${name} to confirm`, { exact: true }).fill(name)
    await page.getByRole('button', { name: 'Confirm delete project' }).click()
    await expect(page).toHaveURL(/\/projects$/)
  })
}

test('editor rejects an external-write conflict, protects route navigation and reopens closed tabs', async ({
  page,
}) => {
  const name = `Conflicts ${Date.now()}`,
    p = (
      await (
        await page.request.post('/api/v1/projects', { data: { name, location: 'managed' } })
      ).json()
    ).data
  try {
    await page.request.post(`/api/v1/projects/${p.id}/files`, {
      data: { path: 'a.ts', content: 'export const value = 1' },
    })
    await page.goto(`/projects/${p.id}/editor`)
    await page.getByRole('button', { name: /a.ts/ }).click()
    let editor = page.getByRole('textbox', { name: 'Code editor: a.ts' })
    await editor.fill('export const value = 2')
    await page.route(`**/api/v1/workspaces/${p.id}/status`, (route) =>
      route.fulfill({
        status: 503,
        json: { data: { error: { message: 'Test-only inventory refresh failure' } } },
      }),
    )
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Test-only inventory refresh failure')
    await expect(editor).toContainText('value = 2')
    await page.unroute(`**/api/v1/workspaces/${p.id}/status`)
    await page.getByRole('button', { name: 'Try again', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(editor).toContainText('value = 2')
    const file = (
      await (await page.request.get(`/api/v1/projects/${p.id}/files/content?path=a.ts`)).json()
    ).data
    await page.request.put(`/api/v1/projects/${p.id}/files/content`, {
      data: { path: 'a.ts', content: 'export const external = 3', expectedVersion: file.version },
    })
    await page.getByRole('button', { name: 'Save file', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('File changed on disk')
    await expect(editor).toContainText('value = 2')
    expect(
      (await (await page.request.get(`/api/v1/projects/${p.id}/files/content?path=a.ts`)).json())
        .data.content,
    ).toBe('export const external = 3')
    const dismissed = new Promise<void>((resolve) =>
      page.once('dialog', async (dialog) => {
        await dialog.dismiss()
        resolve()
      }),
    )
    await page.getByRole('link', { name: 'Project overview', exact: true }).click()
    await dismissed
    await expect(page).toHaveURL(new RegExp(`/projects/${p.id}/editor$`))
    await expect(editor).toContainText('value = 2')
    const accepted = new Promise<void>((resolve) =>
      page.once('dialog', async (dialog) => {
        await dialog.accept()
        resolve()
      }),
    )
    await page.getByRole('link', { name: 'Project overview', exact: true }).click()
    await accepted
    await expect(page).toHaveURL(new RegExp(`/projects/${p.id}$`))
    await page.getByRole('link', { name: 'Open editor', exact: true }).click()
    await page.getByRole('button', { name: /a.ts/ }).click()
    editor = page.getByRole('textbox', { name: 'Code editor: a.ts' })
    await expect(editor).toContainText('external = 3')
    await page.getByRole('button', { name: 'Close a.ts', exact: true }).click()
    await expect(page.getByRole('tab', { name: 'a.ts', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: /a.ts/ }).click()
    await expect(page.getByRole('tab', { name: 'a.ts', exact: true })).toBeVisible()
    await editor.fill('export const keyboardSaved = true')
    await editor.press('Control+s')
    await expect(page.getByRole('status').filter({ hasText: 'Saved by backend.' })).toBeVisible()
    await editor.press('Control+f')
    await expect(page.locator('.cm-search')).toBeVisible()
    await page.keyboard.press('Escape')
    const axe = await new AxeBuilder({ page })
      .include('.project-editor-layout')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    expect(axe.violations).toEqual([])
  } finally {
    await page.request.delete(`/api/v1/projects/${p.id}`, { data: { confirmName: name } })
  }
})

test('per-session model choice is submitted and only confirmed after the scoped API succeeds (explicit fixtures)', async ({
  page,
  context,
}) => {
  await fixtureSession(page)
  const name = `Model UI ${Date.now()}`,
    p = (
      await (
        await page.request.post('/api/v1/projects', { data: { name, location: 'managed' } })
      ).json()
    ).data
  let selected = { providerID: 'test', modelID: 'one' },
    created = false
  const models = ['one', 'two'].map((modelID) => ({
    providerID: 'test',
    modelID,
    name: `Test-only ${modelID}`,
    available: true,
    toolCall: true,
    reasoning: false,
  }))
  await page.route('**/api/v1/providers?*', (route) =>
    route.fulfill({
      json: {
        data: {
          providers: [
            {
              id: 'test',
              name: 'Test-only provider',
              connected: true,
              authentication: 'runtime-connected',
              models,
            },
          ],
        },
      },
    }),
  )
  const record = () => ({
    id: 'test-session-id',
    runtimeSessionId: 'fixture-native-id',
    workspaceId: p.id,
    title: 'Model UI session',
    created: Date.now(),
    updated: Date.now(),
    status: 'ready',
    model: selected,
  })
  await page.route(`**/api/v1/projects/${p.id}/sessions`, async (route) => {
    if (route.request().method() === 'POST') {
      selected = route.request().postDataJSON().model
      created = true
      await route.fulfill({ status: 201, json: { data: record() } })
    } else await route.fulfill({ json: { data: { sessions: created ? [record()] : [] } } })
  })
  await page.route('**/api/v1/sessions/test-session-id/model?*', async (route) => {
    selected = route.request().postDataJSON()
    await route.fulfill({ json: { data: { model: selected } } })
  })
  try {
    await page.goto(`/projects/${p.id}`)
    await page.getByRole('button', { name: 'New coding session' }).click()
    await page.getByLabel('Session title').fill('Model UI session')
    await page.getByRole('combobox', { name: 'Coding model' }).selectOption('test/one')
    await page.getByRole('button', { name: 'Create session', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/projects/${p.id}/sessions/test-session-id$`))
    expect(selected.modelID).toBe('one')
    await page.getByText('Session model', { exact: true }).click()
    await expect(page.getByText('Current model: test/one', { exact: true })).toBeVisible()
    await page.getByRole('combobox', { name: 'Coding model' }).selectOption('test/two')
    await expect(page.getByText('Current model: test/one', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Apply model to session' }).click()
    await expect(page.getByText('Current model: test/two', { exact: true })).toBeVisible()
    expect(selected.modelID).toBe('two')
  } finally {
    await context.unrouteAll({ behavior: 'ignoreErrors' })
    await page.request.delete(`/api/v1/projects/${p.id}`, { data: { confirmName: name } })
  }
})

test('the dev proxy refuses forwarded/public API traffic rather than exposing local execution', async ({
  page,
}) => {
  const response = await page.request.get('/api/v1/projects', {
    headers: { 'x-forwarded-for': '203.0.113.1' },
  })
  expect(response.status()).toBe(403)
  expect((await response.json()).data.error.code).toBe('local_only')
})
