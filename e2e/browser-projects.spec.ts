import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
for (const width of [390, 1440])
  test(`real browser-local create/save/reload/export/import/delete at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/browser-projects')
    await page.getByRole('button', { name: 'New browser project', exact: true }).click()
    await page.getByLabel('Browser project name', { exact: true }).fill(`Browser ${width}`)
    await page.getByRole('button', { name: 'Create on this browser' }).click()
    await expect(page).toHaveURL(/browser-projects\/[\w-]+/)
    const url = page.url()
    await page.getByLabel('New file path').fill('src/main.ts')
    await page.getByRole('button', { name: 'Create file', exact: true }).click()
    const editor = page.getByRole('textbox', { name: 'Code editor: src/main.ts' })
    await editor.fill('export const browserValue = 42\n')
    await page.getByRole('button', { name: 'Save browser file' }).click()
    await expect(page.getByText('Saved in this browser', { exact: true })).toBeVisible()
    await page.reload()
    await page.getByRole('button', { name: 'src/main.ts', exact: true }).click()
    await expect(editor).toContainText('browserValue = 42')
    await editor.fill('export const browserValue = 43\n')
    page.once('dialog', (dialog) => dialog.dismiss())
    await page.getByRole('link', { name: 'All browser projects', exact: true }).first().click()
    await expect(editor).toContainText('browserValue = 43')
    await page.getByRole('button', { name: 'Save browser file' }).click()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export project & draft' }).click()
    const downloaded = await downloadPromise,
      path = await downloaded.path()
    expect(path).toBeTruthy()
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
      [],
    )
    await page.getByRole('button', { name: 'Rename / description' }).click()
    await page.getByLabel('Browser project name', { exact: true }).fill(`Renamed ${width}`)
    await page.getByRole('button', { name: 'Save project details' }).click()
    await expect(page.getByRole('heading', { name: `Renamed ${width}`, exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'All browser projects', exact: true }).first().click()
    await page.getByLabel('Import an exported Atlas project').setInputFiles(path!)
    await expect(page).not.toHaveURL(url)
    await expect(page.getByRole('button', { name: 'src/main.ts', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'src/main.ts', exact: true }).click()
    await expect(editor).toContainText('browserValue = 43')
    await page.getByRole('button', { name: 'Delete browser project', exact: true }).click()
    await page.getByLabel('Confirm browser project name').fill(`Browser ${width}`)
    await page.getByRole('button', { name: 'Permanently delete browser copy' }).click()
    await expect(page).toHaveURL(/browser-projects$/)
    await page.goto(url)
    await page.getByRole('button', { name: 'Delete browser project', exact: true }).click()
    await page.getByLabel('Confirm browser project name').fill(`Renamed ${width}`)
    await page.getByRole('button', { name: 'Permanently delete browser copy' }).click()
    await expect(page.getByText('No browser projects yet', { exact: true })).toBeVisible()
    await page.goto('/cloud-projects')
    await expect(
      page.getByRole('button', { name: 'Create cloud project — disabled' }),
    ).toBeDisabled()
    const response = await page.request.post('/api/cloud', { data: { name: 'Not provisioned' } })
    expect(response.status()).toBe(503)
  })
test('cross-tab browser save conflicts keep the losing draft; optional wake lock lifecycle (mocked)', async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: async () => {
          const sentinel = new EventTarget()
          Object.assign(sentinel, {
            release: async () => {
              sentinel.dispatchEvent(new Event('release'))
            },
          })
          return sentinel
        },
      },
    })
  })
  await page.goto('/browser-projects')
  await page.getByRole('checkbox', { name: 'Keep this screen awake (optional)' }).check()
  await expect(page.getByText(/Screen wake lock active/)).toBeVisible()
  await page.getByRole('checkbox', { name: 'Keep this screen awake (optional)' }).uncheck()
  await page.getByRole('button', { name: 'New browser project' }).click()
  await page.getByLabel('Browser project name', { exact: true }).fill('Concurrent browser work')
  await page.getByRole('button', { name: 'Create on this browser' }).click()
  await expect(page).toHaveURL(/browser-projects\//)
  await page.getByLabel('New file path').fill('a.ts')
  await page.getByRole('button', { name: 'Create file', exact: true }).click()
  const second = await context.newPage()
  await second.goto(page.url())
  await second.getByRole('button', { name: 'a.ts', exact: true }).click()
  await page.getByRole('textbox', { name: 'Code editor: a.ts' }).fill('first committed source')
  await page.getByRole('button', { name: 'Save browser file' }).click()
  await expect(page.getByText('Saved in this browser', { exact: true })).toBeVisible()
  await second.getByRole('textbox', { name: 'Code editor: a.ts' }).fill('second unsaved draft')
  await second.getByRole('button', { name: 'Save browser file' }).click()
  await expect(second.getByRole('alert')).toContainText('changed in another tab')
  await expect(second.getByRole('textbox', { name: 'Code editor: a.ts' })).toContainText(
    'second unsaved draft',
  )
  await second.close()
})
