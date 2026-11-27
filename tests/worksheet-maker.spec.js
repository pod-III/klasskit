const { test, expect } = require('@playwright/test');

test.describe('Worksheet Maker Smoke Tests (Sandbox Mode)', () => {
  test('loads cleanly, renders builder, adds a question, and switches to A4 preview', async ({ page }) => {
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

    const presetsPromise = page.waitForResponse(
      (res) => res.url().includes('/apps/printables/worksheet-maker/presets.json') && res.status() === 200,
      { timeout: 15000 }
    );
    const response = await page.goto('/apps/printables/worksheet-maker/index.html', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);
    await presetsPromise;

    await expect(page.locator('#ws-sidebar')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#previewArea')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#previewArea input[data-action="update-ws-title"]')).toBeVisible({ timeout: 15000 });

    await page.locator('#previewArea button[data-action="add-question"][data-type="mcq"]').first().click();
    await expect(page.locator('#ws-summary-pill')).toContainText('1 Qs');

    await page.locator('#previewArea button[data-action="set-view-mode"][data-mode="preview"]').click();
    await expect(page.locator('#print-sheet-container')).toBeVisible();
    await expect(page.locator('#a4-pages-stack .a4-sheet').first()).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
