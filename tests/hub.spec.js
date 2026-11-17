const { test, expect } = require('@playwright/test');

test.describe('KlassKit Hub & Landing', () => {
  test('public landing page loads cleanly', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/index.html');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveTitle(/KlassKit/);
    expect(pageErrors).toEqual([]);
  });

  test('hub loads catalog, supports search shortcut, theme toggle, split screen, and timer in Sandbox mode', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.addInitScript(() => {
      localStorage.setItem('kk_mode', 'sandbox');
    });

    await page.goto('/hub.html');
    await expect(page.locator('#hub-loading-state')).toBeHidden({ timeout: 10000 });
    await expect(page.locator('#landing-view')).toBeVisible();

    // "/" shortcut focuses search input and switches to filtered library grid
    await page.keyboard.press('/');
    const searchInput = page.locator('#search-input');
    await expect(searchInput).toBeFocused();
    await searchInput.fill('Domino');
    await expect(page.locator('#grid-library-all')).toBeVisible();
    await expect(page.locator('#grid-library-all')).toContainText('Domino Maker');

    // Theme toggle persists theme_hub
    const initialDark = await page.locator('html').evaluate(el => el.classList.contains('dark'));
    await page.locator('[data-action="toggleTheme"]').first().click();
    const afterToggleDark = await page.locator('html').evaluate(el => el.classList.contains('dark'));
    expect(afterToggleDark).toBe(!initialDark);

    // Open two activities into workspace tabs and toggle Split Screen
    await page.evaluate(() => {
      window.App && window.TabManager;
      GameModal.open('bingo');
      GameModal.open('clock');
    });
    const gameModal = page.locator('#game-modal');
    await expect(gameModal).toBeVisible();

    await page.locator('[data-action="toggleSplitScreen"]').click();
    await expect(page.locator('#tab-content-area')).toHaveClass(/split-mode/);

    // Toggle Universal Floating Timer
    await page.locator('[data-action="toggleTimer"]').click();
    await expect(page.locator('#universal-timer')).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});
