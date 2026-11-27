const { test, expect } = require('@playwright/test');

test.describe('My Space & My Class Smoke Tests (Sandbox Mode)', () => {
  test('My Space dashboard loads cleanly and renders core widgets', async ({ page }) => {
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

    const response = await page.goto('/apps/my-space/index.html', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);

    await expect(page.locator('header h1')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('header h1')).toContainText('My Space Dashboard');
    await expect(page.locator('#sync-badge')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#schedule-widget-content')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#admin-widget-content')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#tasks-widget-content')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#widget-date')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#widget-date')).toHaveText(/\S+/);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('My Class loads cleanly in empty Sandbox state and fetches pu-comments.json', async ({ page }) => {
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

    const puCommentsPromise = page.waitForResponse(
      (res) => res.url().includes('/apps/my-space/class/data/pu-comments.json') && res.status() === 200,
      { timeout: 15000 }
    );
    const response = await page.goto('/apps/my-space/class/index.html', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);
    await puCommentsPromise;

    await expect(page.locator('#noClassState')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#noScheduleState')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#noScheduleState')).toContainText('No Classes Found');
    await expect(page.locator('#classWorkspace')).toBeHidden();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('My Class opens a seeded class workspace and loads Comments and Reports tabs cleanly', async ({ page }) => {
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
      localStorage.setItem('schedule_events', JSON.stringify([
        {
          id: 'smoke-cls-1',
          name: 'Grade 5A',
          typeId: 'class',
          date: '2026-11-27',
          startTime: '09:00',
          endTime: '10:00',
          color: '#1ea7fd',
        },
      ]));
    });
    await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
      route.fulfill({ status: 200, contentType: 'text/css', body: '' })
    );

    const response = await page.goto('/apps/my-space/class/index.html', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);

    await expect(page.locator('#classSelector option[value="Grade 5A"]')).toBeAttached({ timeout: 15000 });
    await page.locator('#classSelector').selectOption('Grade 5A');

    await expect(page.locator('#classWorkspace')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#classNameDisplay')).toHaveText('Grade 5A');

    await page.locator('#tab-students').click();
    await expect(page.locator('#content-students')).toBeVisible();

    await page.locator('#tab-comments').click();
    await expect(page.locator('#content-comments')).toBeVisible();

    const [reportCommentsResp] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/apps/my-space/class/data/report-comments.json') && res.status() === 200,
        { timeout: 15000 }
      ),
      page.locator('#tab-reports').click(),
    ]);
    expect(reportCommentsResp.status()).toBe(200);
    await expect(page.locator('#content-reports')).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
