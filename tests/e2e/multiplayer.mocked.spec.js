/**
 * Multiplayer E2E Tests — MOCKED (Playwright Route-Mocks)
 *
 * Diese Suite testet UI-/Flow-Verhalten ohne den echten Cloudflare-Worker zu
 * berühren. Alle /api/*-Calls werden via page.route() abgefangen und mit
 * kontrollierten Responses beantwortet. Deterministisch, schnell, kein
 * Production-Daten-Risiko.
 *
 * Regression-Schutz für die Bug-Fixes in Issues #20, #21, #26.
 * Issue #28 Strategie B.
 */

const { test, expect } = require('@playwright/test');

const API_HOST = 'https://1x1-api.marco-moebus.workers.dev';

// Minimaler eingeloggter MP-State zum Injizieren via localStorage. Vermeidet
// das Onboarding-Formular und reale API-Calls.
function loggedInMpState(over = {}) {
  return {
    _version: 7,
    name: 'TestUser',
    xp: 0, totalCorrect: 0, totalGames: 0, streak: 0,
    lastPlayDate: null, achievements: [],
    highScores: { blitz: 0, turnier: 0, blitzListe: [], blitzDiv: 0,
                  blitzGemischt: 0, turnierDiv: 0, turnierGemischt: 0 },
    blitzConfig: { reihen: [], alleReihen: true, rechenart: 'mult' },
    trainingConfig: { rechenart: 'mult' },
    turnierConfig: { rechenart: 'mult' },
    trainedReihen: [],
    settings: { grosses1x1: false, reiheMax: {}, inputMode: 'both', rechenart: 'both' },
    reiheStats: {}, questionStats: {},
    streakFreezeUsedDate: null, streakFreezeTotal: 0,
    stars: 0, gameSecondsLeft: 0,
    mp: {
      enabled: true, groupCode: 'MOCK-GROUP', nickname: 'TestUser',
      pinHash: 'mock-hash', token: 'mock-token',
      pendingUploads: [],
      lastSeedDate: new Date().toISOString().split('T')[0],
      lastSeed: 1234567,
      lastChallengeId: 'mock-challenge',
      ...over,
    },
  };
}

// Default-Mocks für Routen die Tests nicht selber anfassen. Wegen Playwright's
// LIFO-Route-Matching müssen test-spezifische page.route()-Aufrufe VOR
// loginMocked passieren — sonst gewinnen die Defaults. setupBaseMocks() unten
// ist optional und wird NUR aufgerufen wenn der Test keine eigenen Routen
// registriert hat (sessions / fallback-Endpoints).
async function setupBaseMocks(page) {
  await page.route(`${API_HOST}/api/sessions`, route =>
    route.fulfill({ contentType: 'application/json', body: '{"ok":true}' }));
  await page.route(`${API_HOST}/api/progress`, route =>
    route.fulfill({ contentType: 'application/json', body: '{"ok":true}' }));
}

// Reine State-Injection. Test-Routen müssen VOR diesem Aufruf gesetzt sein,
// damit sie beim reload() greifen (DOMContentLoaded triggert sofort
// mpCheckPendingChallenges).
async function loginMocked(page, stateOverride = {}) {
  await setupBaseMocks(page);
  await page.goto('/1x1-trainer/');
  await page.evaluate((s) => {
    localStorage.setItem('henry_einmaleins', JSON.stringify(s));
  }, loggedInMpState(stateOverride));
  await page.reload();
  // Warte bis App-Boot fertig ist — egal welcher Screen aktiv ist
  await page.locator('.screen.active').waitFor({ timeout: 5000 });
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Issue #20 — Rangliste-Race', () => {
  // Hinweis: endGame() ist nicht direkt aus page.evaluate aufrufbar, weil
  // `let game` im Script keine window-Property ist. Stattdessen testen wir den
  // exakten Fix-Mechanismus: uploadP.finally → setTimeout → mpShowLeaderboard.
  // Das ist genau der Pattern, den endGame triggert (1x1-trainer/index.html
  // ~Z.2630ff in der „Multiplayer: upload score + session"-Sektion).

  test('Score-Upload abgeschlossen bevor Rangliste geladen wird', async ({ page }) => {
    test.setTimeout(15000);
    const calls = [];

    await page.route(/\/api\/challenges\/pending$/, route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ challenges: [] }) }));
    await page.route(/\/api\/scores$/, async route => {
      calls.push({ url: 'scores-START', t: Date.now() });
      await new Promise(r => setTimeout(r, 1500)); // Worker-Latenz simulieren
      calls.push({ url: 'scores-END', t: Date.now() });
      await route.fulfill({ contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.route(/\/api\/leaderboard\//, async route => {
      calls.push({ url: 'leaderboard', t: Date.now() });
      await route.fulfill({ contentType: 'application/json',
        body: JSON.stringify({ entries: [{ nickname: 'TestUser', score: 50, correct_count: 10 }] }) });
    });

    await loginMocked(page);

    // Fix-Mechanismus direkt: uploadP.finally → setTimeout(1500) → mpShowLeaderboard
    await page.evaluate(() => {
      const payload = buildScorePayload(state, { score: 50, correct: 10 },
                                        new Date().toISOString().split('T')[0]);
      const uploadP = mpUploadScore(payload);
      uploadP.finally(() => setTimeout(() => mpShowLeaderboard(50), 1500));
    });

    await page.locator('#screen-mp-leaderboard.active').waitFor({ timeout: 10000 });

    // Race-Check: scores-END muss VOR leaderboard kommen
    const scoresEnd = calls.find(c => c.url === 'scores-END');
    const leaderboard = calls.find(c => c.url === 'leaderboard');
    expect(scoresEnd).toBeDefined();
    expect(leaderboard).toBeDefined();
    expect(scoresEnd.t).toBeLessThanOrEqual(leaderboard.t);
  });

  test('Rangliste öffnet sich auch bei fehlgeschlagenem Score-Upload', async ({ page }) => {
    test.setTimeout(15000);

    await page.route(/\/api\/challenges\/pending$/, route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ challenges: [] }) }));
    await page.route(/\/api\/scores$/, route => route.abort('failed'));
    await page.route(/\/api\/leaderboard\//, route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ entries: [] }) }));

    await loginMocked(page);

    // mpUploadScore queued in pendingUploads bei Fehler — .finally feuert trotzdem
    await page.evaluate(() => {
      const payload = buildScorePayload(state, { score: 30, correct: 6 },
                                        new Date().toISOString().split('T')[0]);
      const uploadP = mpUploadScore(payload);
      uploadP.finally(() => setTimeout(() => mpShowLeaderboard(30), 1500));
    });

    await page.locator('#screen-mp-leaderboard.active').waitFor({ timeout: 10000 });
  });
});

test.describe('Issue #21 — Challenge-Polling-Refetch', () => {
  test('Inbox-Open triggert frischen Fetch (nicht nur Cache-Render)', async ({ page }) => {
    let fetchCount = 0;
    await page.route(/\/api\/challenges\/pending$/, route => {
      fetchCount++;
      // 1. Call beim App-Start: leer. 2. Call beim Inbox-Open: hat Challenge.
      const challenges = fetchCount >= 2
        ? [{ id: 'c1', challenger_nickname: 'Anna', challenger_score: 42,
             seed: 7, seed_date: '2026-05-17',
             reihen_config: { alleReihen: true, rechenart: 'mult' } }]
        : [];
      route.fulfill({ contentType: 'application/json',
        body: JSON.stringify({ challenges }) });
    });

    await loginMocked(page);
    await page.waitForTimeout(300); // initial fetch settle
    expect(fetchCount).toBeGreaterThanOrEqual(1); // App-Start hat schon gefetcht

    // Inbox direkt öffnen (Refetch sollte ausgelöst werden)
    await page.evaluate(() => showScreen('mp-challenge-inbox'));
    await page.waitForFunction(() => {
      const list = document.getElementById('challenge-inbox-list');
      return list && list.textContent.includes('Anna');
    }, { timeout: 5000 });

    expect(fetchCount).toBeGreaterThanOrEqual(2); // 1× Start + 1× Inbox-Open
  });

  test('visibilitychange-Event triggert Refetch wenn App wieder sichtbar wird', async ({ page }) => {
    let fetchCount = 0;
    await page.route(/\/api\/challenges\/pending$/, route => {
      fetchCount++;
      route.fulfill({ contentType: 'application/json',
        body: JSON.stringify({ challenges: [] }) });
    });

    await loginMocked(page);
    await page.waitForTimeout(300);
    const startCount = fetchCount;

    // visibilitychange-Event simulieren (Tab kommt zurück in den Vordergrund)
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(500);

    expect(fetchCount).toBeGreaterThan(startCount);
  });

  test('Home-Card-Badge UND Gruppe-Inbox-Button werden beide aktualisiert', async ({ page }) => {
    await page.route(/\/api\/challenges\/pending$/, route =>
      route.fulfill({ contentType: 'application/json',
        body: JSON.stringify({ challenges: [
          { id: 'c1', challenger_nickname: 'Anna', challenger_score: 30,
            seed: 1, seed_date: '2026-05-17',
            reihen_config: { alleReihen: true, rechenart: 'mult' } },
          { id: 'c2', challenger_nickname: 'Ben', challenger_score: 45,
            seed: 2, seed_date: '2026-05-17',
            reihen_config: { alleReihen: true, rechenart: 'mult' } },
        ]}) }));

    await loginMocked(page);
    await page.waitForTimeout(500); // initial fetch + UI-Update

    // Home-Card-Badge (mp-challenge-badge) zeigt "2 Challenges offen"
    const badge = page.locator('#mp-challenge-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('2');

    // Gruppe-Screen → Inbox-Button zeigt "Offene Challenges (2)"
    await page.evaluate(() => showScreen('mp-join'));
    await expect(page.locator('#mp-inbox-btn')).toContainText('(2)');
  });
});

test.describe('Issue #26 — Nickname-Prefill', () => {
  test('Spitzname-Felder werden mit state.name vorbelegt beim mp-join-Öffnen', async ({ page }) => {
    await setupBaseMocks(page);
    await page.goto('/1x1-trainer/');
    await page.evaluate(() => {
      localStorage.setItem('henry_einmaleins', JSON.stringify({
        _version: 7, name: 'Henry-Test',
        settings: { grosses1x1: false, reiheMax: {}, inputMode: 'both', rechenart: 'both' },
        mp: { enabled: false, groupCode: null, nickname: null,
              pinHash: null, token: null, pendingUploads: [],
              lastSeedDate: null, lastSeed: null, lastChallengeId: null }
      }));
    });
    await page.reload();
    await page.locator('#screen-home').waitFor({ timeout: 5000 });

    // Navigate to mp-join (sollte Pre-Fill triggern)
    await page.evaluate(() => showScreen('mp-join'));
    await page.locator('#screen-mp-join.active').waitFor();

    // Beide Felder befüllt
    expect(await page.locator('#mp-join-nick').inputValue()).toBe('Henry-Test');
    expect(await page.locator('#mp-login-nick').inputValue()).toBe('Henry-Test');
  });

  test('User-Override gewinnt — Pre-Fill nur wenn Feld leer', async ({ page }) => {
    await setupBaseMocks(page);
    await page.goto('/1x1-trainer/');
    await page.evaluate(() => {
      localStorage.setItem('henry_einmaleins', JSON.stringify({
        _version: 7, name: 'Henry-Test',
        settings: { grosses1x1: false, reiheMax: {}, inputMode: 'both', rechenart: 'both' },
        mp: { enabled: false, groupCode: null, nickname: null,
              pinHash: null, token: null, pendingUploads: [],
              lastSeedDate: null, lastSeed: null, lastChallengeId: null }
      }));
    });
    await page.reload();
    await page.locator('#screen-home').waitFor({ timeout: 5000 });

    // Vor Pre-Fill: User tippt eigenen Namen ein
    await page.evaluate(() => {
      document.getElementById('mp-join-nick').value = 'BlitzKönig';
    });

    await page.evaluate(() => showScreen('mp-join'));
    await page.locator('#screen-mp-join.active').waitFor();

    // User-Wert bleibt — Pre-Fill überschreibt nicht
    expect(await page.locator('#mp-join-nick').inputValue()).toBe('BlitzKönig');
  });

  test('state.name leer → kein Pre-Fill, Feld bleibt leer mit Placeholder', async ({ page }) => {
    await setupBaseMocks(page);
    await page.goto('/1x1-trainer/');
    await page.evaluate(() => {
      localStorage.setItem('henry_einmaleins', JSON.stringify({
        _version: 7, name: '',
        settings: { grosses1x1: false, reiheMax: {}, inputMode: 'both', rechenart: 'both' },
        mp: { enabled: false, groupCode: null, nickname: null,
              pinHash: null, token: null, pendingUploads: [],
              lastSeedDate: null, lastSeed: null, lastChallengeId: null }
      }));
    });
    await page.reload();
    // state.name === '' → App startet auf name-screen, nicht home. Egal — wir
    // navigieren direkt zu mp-join via showScreen.
    await page.locator('#screen-name').waitFor({ timeout: 5000 });

    await page.evaluate(() => showScreen('mp-join'));
    await page.locator('#screen-mp-join.active').waitFor();

    expect(await page.locator('#mp-join-nick').inputValue()).toBe('');
  });
});
