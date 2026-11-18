const { test, expect } = require('@playwright/test');

test.describe('Quiz Block Student View (?player=1 BroadcastChannel Sync)', () => {
  test('syncs board, question reveal without answer leak, timer, and scoreboard to student window', async ({ context }) => {
    test.setTimeout(90000);

    const hostErrors = [];
    const studentErrors = [];

    await context.addInitScript(() => {
      localStorage.setItem('kk_mode', 'sandbox');
    });

    const hostPage = await context.newPage();
    await hostPage.emulateMedia({ reducedMotion: 'reduce' });
    hostPage.on('pageerror', (err) => hostErrors.push(err.message));

    await hostPage.goto('/apps/games/quiz-block/index.html', { waitUntil: 'domcontentloaded' });
    await expect(hostPage.locator('#presets-list button').first()).toBeVisible({ timeout: 15000 });

    const studentPage = await context.newPage();
    await studentPage.emulateMedia({ reducedMotion: 'reduce' });
    studentPage.on('pageerror', (err) => studentErrors.push(err.message));

    await studentPage.goto('/apps/games/quiz-block/index.html?player=1', { waitUntil: 'domcontentloaded' });
    await expect(studentPage.locator('#student-waiting-overlay')).toBeVisible({ timeout: 10000 });

    // Host opens first built-in preset board
    await hostPage.locator('#presets-list button').first().click();

    // Student window transitions from waiting overlay to live board
    await expect(studentPage.locator('#student-waiting-overlay')).toBeHidden({ timeout: 10000 });
    await expect(studentPage.locator('#student-view-badge')).toBeVisible();
    await expect(studentPage.locator('#header-actions-bar')).toBeHidden();
    await expect(studentPage.locator('#game-board button').first()).toBeVisible();

    // Host clicks first tile -> opens question modal on both windows without leaking answer
    await hostPage.locator('#game-board button').first().click();
    await expect(hostPage.locator('#modal-play')).toBeVisible();
    await expect(studentPage.locator('#modal-play')).toBeVisible();

    const { expectedQuestion, expectedAnswer } = await hostPage.evaluate(() => ({
      expectedQuestion: (document.getElementById('play-text')?.textContent || '').trim(),
      expectedAnswer: (document.getElementById('play-answer')?.textContent || '').trim(),
    }));
    expect(expectedQuestion.length).toBeGreaterThan(0);
    expect(expectedAnswer.length).toBeGreaterThan(0);

    await expect(studentPage.locator('#play-text')).toHaveText(expectedQuestion);
    await expect(studentPage.locator('#view-answer')).toBeHidden();
    await expect(studentPage.locator('#play-answer')).toHaveText('');
    await expect(studentPage.locator('#play-q-actions')).toBeHidden();

    // Host starts countdown timer -> Student timer readout ticks down
    const initialTimerText = (await studentPage.locator('#play-timer-readout').textContent())?.trim();
    await hostPage.locator('#btn-timer').click();
    await expect(hostPage.locator('#btn-timer-label')).toHaveText('Restart Timer');
    await expect(studentPage.locator('#play-timer-readout')).not.toHaveText(initialTimerText || '', { timeout: 5000 });

    // Host reveals answer -> Student view displays answer
    await hostPage.locator('#play-q-actions button:has-text("Reveal Answer")').click();
    await expect(hostPage.locator('#view-answer')).toBeVisible();
    await expect(studentPage.locator('#view-answer')).toBeVisible({ timeout: 10000 });
    await expect(studentPage.locator('#play-answer')).toHaveText(expectedAnswer);
    await expect(studentPage.locator('#play-award-section')).toBeHidden();

    // Host awards points to Team 1 and closes modal -> Student scoreboard & visited tile update
    await hostPage.locator('#play-award-teams button:has-text("+")').first().click();
    await hostPage.locator('#play-continue-btn').click();

    await expect(studentPage.locator('#modal-play')).toBeHidden({ timeout: 10000 });
    await expect(studentPage.locator('#scoreboard-container')).toContainText('100');
    await expect(studentPage.locator('#game-board button').first()).toBeDisabled();

    expect(hostErrors).toEqual([]);
    expect(studentErrors).toEqual([]);
  });
});
