const { test, expect } = require('@playwright/test');

const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

test.describe('RPG Hub & Arcane Tabletop Smoke Tests (Sandbox Mode)', () => {
  test('RPG Hub landing page loads cleanly and displays all 4 tool cards', async ({ page }) => {
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

    const response = await page.goto('/apps/games/dnd/index.html', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);

    await expect(page.locator('main h1')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('main h1')).toContainText('RPG HUB');

    await expect(page.locator('a[data-shortcut="1"]')).toBeVisible();
    await expect(page.locator('a[data-shortcut="1"]')).toContainText('Character Roster');
    await expect(page.locator('a[data-shortcut="2"]')).toBeVisible();
    await expect(page.locator('a[data-shortcut="2"]')).toContainText('Arcane Tabletop');
    await expect(page.locator('a[data-shortcut="3"]')).toBeVisible();
    await expect(page.locator('a[data-shortcut="3"]')).toContainText('Dungeon Printer');
    await expect(page.locator('a[data-shortcut="4"]')).toBeVisible();
    await expect(page.locator('a[data-shortcut="4"]')).toContainText('Arcane Soundboard');

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Arcane Tabletop (dnd-map) loads cleanly and toggles DM/Player view', async ({ page }) => {
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
    await page.route(/^https:\/\/www\.transparenttextures\.com\//, (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PNG })
    );

    const response = await page.goto('/apps/games/dnd/pages/dnd-map/index.html', { waitUntil: 'load' });
    expect(response?.status()).toBe(200);

    await expect(page.locator('#dm-sidebar')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#tool-sidebar')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#canvas-wrapper')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#layer-ruler')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#campaign-select')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#btn-new-map')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#mode-toggle')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#mode-toggle')).toContainText('Enter Player View');

    await expect(page.locator('#layer-map')).toBeAttached();
    await expect(page.locator('#layer-grid')).toBeAttached();
    await expect(page.locator('#layer-token')).toBeAttached();
    await expect(page.locator('#layer-fog')).toBeAttached();
    await expect(page.locator('#layer-los')).toBeAttached();

    await page.locator('#mode-toggle').click();
    await expect(page.locator('#dm-sidebar')).toBeHidden();
    await expect(page.locator('#tool-sidebar')).toBeHidden();
    await expect(page.locator('#player-toolbar')).toBeVisible();
    await expect(page.locator('#mode-toggle')).toContainText('Enter DM View');

    await page.locator('#mode-toggle').click();
    await expect(page.locator('#dm-sidebar')).toBeVisible();
    await expect(page.locator('#tool-sidebar')).toBeVisible();
    await expect(page.locator('#player-toolbar')).toBeHidden();
    await expect(page.locator('#mode-toggle')).toContainText('Enter Player View');

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
