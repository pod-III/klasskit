const { test, expect } = require('@playwright/test');

test.describe('Lesson Note Smoke Tests (Sandbox Mode)', () => {
  test('loads cleanly with zero console errors and renders the main editor', async ({ page }) => {
    test.setTimeout(60000);

    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      localStorage.setItem('kk_mode', 'sandbox');
    });
    await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
      route.fulfill({ status: 200, contentType: 'text/css', body: '' })
    );

    const response = await page.goto('/apps/tools/lesson-note/index.html', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);

    await expect(page.locator('#topBar')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#sidebar')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#editorMain')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#noteTitle')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#note-toolbar .ql-toolbar')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#editor-container .ql-editor')).toBeVisible({ timeout: 15000 });

    await expect(page.locator('#notesCountBadge')).toHaveText('1', { timeout: 15000 });

    await page.locator('#noteTitle').fill('Smoke Test Lesson');
    await page.locator('#editor-container .ql-editor').click();
    await page.keyboard.type('Hello KlassKit');

    await expect(page.locator('#noteTitle')).toHaveValue('Smoke Test Lesson');
    await expect(page.locator('#editor-container .ql-editor')).toContainText('Hello KlassKit');

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
