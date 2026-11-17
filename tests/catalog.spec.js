const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const rootDir = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(rootDir, 'games.json'), 'utf8'));

test.describe('Catalog Integrity (games.json)', () => {
  test('all catalog entries have unique IDs and valid file paths on disk', () => {
    expect(Array.isArray(catalog.games)).toBe(true);
    expect(catalog.games.length).toBeGreaterThan(0);

    const seenIds = new Set();
    const missingPaths = [];
    const duplicateIds = [];

    for (const entry of catalog.games) {
      expect(entry.id).toBeTruthy();
      expect(entry.title).toBeTruthy();
      expect(entry.category).toBeTruthy();
      expect(entry.path).toBeTruthy();

      if (seenIds.has(entry.id)) {
        duplicateIds.push(entry.id);
      }
      seenIds.add(entry.id);

      const relPath = entry.path.replace(/^\.\//, '');
      const fullPath = path.join(rootDir, relPath);
      if (!fs.existsSync(fullPath)) {
        missingPaths.push(`${entry.id} -> ${entry.path}`);
      }
    }

    expect(duplicateIds).toEqual([]);
    expect(missingPaths).toEqual([]);

    const activeCount = catalog.games.filter(g => g.category !== 'under-construction').length;
    expect(catalog.metadata?.totalGames).toBe(activeCount);
  });
});

test.describe('Sampled Activity Smoke Tests (Sandbox Mode)', () => {
  const samplePaths = [
    { name: 'Printable: Domino Maker', url: '/apps/printables/domino-maker/index.html' },
    { name: 'Printable: Bingo Maker', url: '/apps/printables/bingo/index.html' },
    { name: 'Tool: Activity Bank', url: '/apps/tools/act/index.html' },
    { name: 'Game: Mystery Tiles', url: '/apps/games/mystery-tiles/index.html' },
    { name: 'Workshop: Text Workshop', url: '/apps/workshop/text-workshop/index.html' },
  ];

  for (const sample of samplePaths) {
    test(`${sample.name} loads cleanly without page errors`, async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      await page.addInitScript(() => {
        localStorage.setItem('kk_mode', 'sandbox');
      });

      await page.goto(sample.url);
      await expect(page.locator('body')).toBeVisible();
      expect(pageErrors).toEqual([]);
    });
  }
});
