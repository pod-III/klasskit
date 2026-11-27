const { test, expect } = require('@playwright/test');

test.describe('KlassKit Hub & Landing', () => {
  test('public landing page loads cleanly', async ({ page }) => {
    test.setTimeout(60000);
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
      route.fulfill({ status: 200, contentType: 'text/css', body: '' })
    );

    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveTitle(/KlassKit/);
    expect(pageErrors).toEqual([]);
  });

  test('hub loads catalog, supports search shortcut, theme toggle, split screen, and timer in Sandbox mode', async ({ page }) => {
    test.setTimeout(90000);
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      localStorage.setItem('kk_mode', 'sandbox');
    });
    await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
      route.fulfill({ status: 200, contentType: 'text/css', body: '' })
    );

    await page.goto('/hub.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#hub-loading-state')).toBeHidden({ timeout: 30000 });
    await expect(page.locator('#landing-view')).toBeVisible();

    // "/" shortcut focuses search input and switches to filtered library grid
    await page.keyboard.press('/');
    const searchInput = page.locator('#search-input');
    await expect(searchInput).toBeFocused();
    await searchInput.fill('Domino');
    await expect(page.locator('#grid-library-all')).toBeVisible();
    await expect(page.locator('#grid-library-all')).toContainText('Domino Maker');

    // Theme toggle persists theme_hub (click visible desktop header toggle)
    const initialDark = await page.locator('html').evaluate(el => el.classList.contains('dark'));
    await page.locator('button[aria-label="Toggle Blackboard Mode"]').click();
    const afterToggleDark = await page.locator('html').evaluate(el => el.classList.contains('dark'));
    expect(afterToggleDark).toBe(!initialDark);

    // Open two activities into workspace tabs, open settings menu, and toggle Split Screen
    await page.evaluate(() => {
      window.GameModal.open('scoreboard');
      window.GameModal.open('scrambler');
    });
    const gameModal = page.locator('#game-modal');
    await expect(gameModal).toBeVisible();
    await expect(page.locator('#side-panel-tabs [role="tab"]')).toHaveCount(2);

    await page.locator('[data-action="toggleSettings"]').click();
    await expect(page.locator('#settings-menu')).not.toHaveClass(/pointer-events-none/);
    await page.locator('[data-action="toggleSplitScreen"]').click();
    await expect(page.locator('#tab-content-area')).toHaveClass(/split-mode/);

    // Toggle Universal Floating Timer
    await page.locator('[data-action="toggleTimer"]').click();
    await expect(page.locator('#universal-timer')).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});
