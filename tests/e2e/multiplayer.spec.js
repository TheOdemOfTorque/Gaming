/**
 * Multiplayer E2E Tests (Playwright)
 *
 * Testet die vollständige Browser-UX: Gruppe beitreten, Blitz spielen,
 * Rangliste, direkte Challenge annehmen.
 *
 * Die Tests injizieren MP-State direkt in localStorage, um das Onboarding-
 * Formular zu überspringen — der Fokus liegt auf dem Spiel-Flow, nicht auf
 * der Dateneingabe (die wird durch separate Unit-Tests abgedeckt).
 */

const { test, expect } = require('@playwright/test');
const { createHash } = require('node:crypto');

const API  = 'https://1x1-api.marco-moebus.workers.dev';
const CODE = 'TEST-E2E'; // feste Test-Gruppe — muss einmalig im Worker angelegt sein

function sha256hex(s) {
  return createHash('sha256').update(s).digest('hex');
}

// Erstellt einen minimalen state, der einen eingeloggten MP-Spieler simuliert.
async function buildMpState(nickname, token, extraMp = {}) {
  return {
    _version: 6,
    name: nickname,
    xp: 0, stars: 0, streak: 0,
    lastPlayDate: null, streakFreezeUsedDate: null, streakFreezeTotal: 0,
    totalCorrect: 0, totalGames: 0,
    achievements: [], questionStats: {}, gameSecondsLeft: 0,
    highScores: {
      blitz: 0, turnier: 0, blitzDiv: 0, blitzGemischt: 0,
      turnierDiv: 0, turnierGemischt: 0, blitzListe: [],
    },
    blitzConfig: { reihen: [], alleReihen: true, rechenart: 'mult' },
    trainingConfig: { rechenart: 'mult' },
    turnierConfig: { rechenart: 'mult' },
    settings: { grosses1x1: false, reiheMax: Object.fromEntries(Array.from({length:20},(_,i)=>[i+1,20])), inputMode: 'tap', rechenart: 'both' },
    trainedReihen: [],
    reiheStats: Object.fromEntries(Array.from({length:20},(_,i)=>[i+1,{sessions:0,totalCorrect:0,totalQuestions:0,consecutivePerfect:0,divConsecutivePerfect:0,divCorrect:0,divWrong:0}])),
    mp: {
      enabled: true,
      groupCode: CODE,
      nickname,
      pinHash: sha256hex('1234'),
      token,
      pendingUploads: [],
      lastSeed: null,
      lastSeedDate: null,
      lastChallengeId: null,
      _activeChallengeId: null,
      ...extraMp,
    },
  };
}

// Setzt localStorage auf den gegebenen State und lädt die Seite neu.
async function loginAs(page, nickname, token, extraMp = {}) {
  await page.goto('/1x1-trainer/');
  await page.evaluate(([state]) => {
    localStorage.setItem('henry_einmaleins', JSON.stringify(state));
  }, [await buildMpState(nickname, token, extraMp)]);
  await page.reload();
  // Warte bis die App initialisiert ist
  await page.waitForSelector('#screen-home.active, #screen-home', { timeout: 5000 });
}

// Spielt eine Blitz-Runde bis zum Ende (alle Fragen antippen — immer richtig).
// Gibt den finalen Score zurück.
async function playBlitzRound(page) {
  // Blitz-Modal öffnen und sofort starten (alleReihen, inputMode=tap)
  await page.click('.mode-card.blitz');
  await page.locator('#blitz-modal').waitFor({ state: 'visible' });
  await page.click('#blitz-start-btn');

  // Warte auf das Spiel-Screen
  await page.locator('#screen-game.active').waitFor({ timeout: 5000 });

  // Antippen-Modus: richtige Antwort-Schaltfläche per aria-label oder Text finden
  // Warte bis das Timer-Overlay weg ist und die Frage sichtbar ist
  let answeredCount = 0;
  const timeout = Date.now() + 62000; // 60s Spielzeit + 2s Puffer

  while (Date.now() < timeout) {
    // Prüfe ob das Ergebnis-Screen erschienen ist
    const resultVisible = await page.locator('#screen-results.active').isVisible().catch(() => false);
    if (resultVisible) break;

    // Korrekte Antwort ist das Button mit class 'correct-answer' (wenn Antippen-Modus)
    const correctBtn = page.locator('.answer-btn.correct-answer, [data-correct="true"]');
    const hasCls = await page.locator('.answer-btn').count().catch(() => 0);
    if (hasCls > 0) {
      // Erste sichtbare Antwort-Schaltfläche suchen
      const btns = await page.locator('.answer-btn').all();
      if (btns.length > 0) {
        // Wir evaluieren im Browser, welcher Button die korrekte Antwort hat
        const correct = await page.evaluate(() => {
          if (!window.game || !window.game.q) return null;
          return window.game.q.answer;
        }).catch(() => null);

        if (correct !== null) {
          // Klicke den Button mit dem richtigen Text
          const btn = page.locator(`.answer-btn:text-is("${correct}")`);
          if (await btn.isVisible({ timeout: 200 }).catch(() => false)) {
            await btn.click({ timeout: 200 }).catch(() => {});
            answeredCount++;
          }
        }
      }
    }
    await page.waitForTimeout(80);
  }

  // Warte auf Ergebnis-Screen
  await page.locator('#screen-results.active').waitFor({ timeout: 5000 });
  const scoreText = await page.locator('#res-correct').textContent();
  return parseInt(scoreText, 10);
}

// ── Hilfsfunktion: Test-Spieler-Tokens holen ─────────────────────────────────

let _p1Token, _p2Token;

async function getTokens() {
  if (_p1Token && _p2Token) return { p1Token: _p1Token, p2Token: _p2Token };

  // Versuche einzuloggen; falls Spieler nicht existiert, erst beitreten
  async function authOrJoin(nickname, pin) {
    const pinHash = sha256hex(pin);
    let res = await fetch(`${API}/api/players/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupCode: CODE, nickname, pinHash }),
    });
    if (res.status === 401 || res.status === 404) {
      res = await fetch(`${API}/api/players/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupCode: CODE, nickname, pinHash }),
      });
    }
    const data = await res.json();
    if (!data.token) throw new Error(`Konnte ${nickname} nicht einloggen: ${JSON.stringify(data)}`);
    return data.token;
  }

  _p1Token = await authOrJoin('E2E-Anna', '1234');
  _p2Token = await authOrJoin('E2E-Ben', '5678');
  return { p1Token: _p1Token, p2Token: _p2Token };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Multiplayer Onboarding', () => {
  test('Gruppe-beitreten-Formular wird angezeigt', async ({ page }) => {
    await page.goto('/1x1-trainer/');
    await page.evaluate(() => localStorage.removeItem('henry_einmaleins'));
    await page.reload();

    // Name eingeben falls nötig
    const nameInput = page.locator('#name-input');
    if (await nameInput.isVisible({ timeout: 1500 }).catch(() => false)) {
      await nameInput.fill('Tester');
      await page.locator('#screen-name button').click();
    }

    // MP-Button auf Home-Screen anklicken
    await page.locator('#mp-home-card').click({ timeout: 3000 });
    await expect(page.locator('#screen-mp-join')).toBeVisible();
    await expect(page.locator('#mp-join-code')).toBeVisible();
  });

  test('Falsche Gruppe → Fehlermeldung', async ({ page }) => {
    await page.goto('/1x1-trainer/');
    await page.evaluate(() => localStorage.removeItem('henry_einmaleins'));
    await page.reload();
    const nameInput = page.locator('#name-input');
    if (await nameInput.isVisible({ timeout: 1500 }).catch(() => false)) {
      await nameInput.fill('Tester');
      await page.locator('#screen-name button').click();
    }
    await page.locator('#mp-home-card').click({ timeout: 3000 });

    await page.fill('#mp-join-code', 'XXXX-9999');
    await page.fill('#mp-join-nick', 'Tester');
    await page.fill('#mp-join-pin', '1234');
    await page.click('button:has-text("Gruppe beitreten")');

    await expect(page.locator('#mp-join-error')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Blitz mit Multiplayer', () => {
  test('Gruppe-Screen zeigt Namen und Aktionen wenn eingeloggt', async ({ page }) => {
    const { p1Token } = await getTokens();
    await loginAs(page, 'E2E-Anna', p1Token);

    await page.locator('#mp-home-card').click({ timeout: 3000 });
    await expect(page.locator('#screen-mp-join')).toBeVisible();
    await expect(page.locator('#mp-group-actions')).toBeVisible();
    await expect(page.locator('button:has-text("Rangliste")').first()).toBeVisible();
  });

  test('Rangliste-Screen öffnet sich und lädt Daten', async ({ page }) => {
    const { p1Token } = await getTokens();
    await loginAs(page, 'E2E-Anna', p1Token);

    await page.locator('#mp-home-card').click({ timeout: 3000 });
    await page.locator('button:has-text("Rangliste")').click();

    await expect(page.locator('#screen-mp-leaderboard')).toBeVisible();
    // Entweder Einträge oder "Noch keine Einträge" — beides ist valide
    await expect(
      page.locator('#mp-leaderboard-body tr').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('nach Blitz-Runde erscheint Rangliste automatisch', async ({ page }) => {
    const { p1Token } = await getTokens();
    await loginAs(page, 'E2E-Anna', p1Token);

    // Blitz direkt starten (inputMode=tap, alleReihen)
    await page.click('.mode-card.blitz');
    await page.locator('#blitz-modal').waitFor({ state: 'visible' });
    await page.click('#blitz-start-btn');
    await page.locator('#screen-game.active').waitFor({ timeout: 5000 });

    // Warte bis der 60s-Timer abgelaufen ist (oder Ergebnis erscheint)
    await page.locator('#screen-results.active, #screen-mp-leaderboard.active').waitFor({ timeout: 65000 });

    // Nach 1.5s sollte automatisch die Rangliste erscheinen
    await page.locator('#screen-mp-leaderboard.active').waitFor({ timeout: 5000 });
    await expect(page.locator('#screen-mp-leaderboard')).toBeVisible();
  }, 80000);
});

test.describe('Direkte Challenges', () => {
  test('Challenge-Inbox zeigt offene Herausforderungen', async ({ page }) => {
    const { p1Token, p2Token } = await getTokens();

    // Anna fordert Ben heraus (direkt via API)
    const today = new Date().toISOString().split('T')[0];
    await fetch(`${API}/api/challenges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Player-Token': p1Token },
      body: JSON.stringify({
        challengedNickname: 'E2E-Ben',
        seed: 20260425,
        seedDate: today,
        score: 400,
        correctCount: 22,
        reihenConfig: { alleReihen: true, rechenart: 'mult' },
      }),
    });

    // Ben öffnet seine Inbox
    await loginAs(page, 'E2E-Ben', p2Token);
    await page.locator('#mp-home-card').click({ timeout: 3000 });
    await page.locator('button:has-text("Challenges")').click();

    await expect(page.locator('#screen-mp-challenge-inbox')).toBeVisible();
    // Mindestens eine offene Challenge sollte sichtbar sein
    await expect(page.locator('#challenge-inbox-list')).toBeVisible({ timeout: 6000 });
    await expect(page.locator('#challenge-inbox-list').locator('text=E2E-Anna').first()).toBeVisible({ timeout: 3000 });
  });

  test('Challenge annehmen startet Blitz mit korrektem Seed', async ({ page }) => {
    const { p1Token, p2Token } = await getTokens();
    const seed = 20260101;
    const today = new Date().toISOString().split('T')[0];

    // Anna erstellt Challenge mit bekanntem Seed
    const res = await fetch(`${API}/api/challenges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Player-Token': p1Token },
      body: JSON.stringify({
        challengedNickname: 'E2E-Ben',
        seed,
        seedDate: today,
        score: 300,
        correctCount: 18,
        reihenConfig: { alleReihen: true, rechenart: 'mult' },
      }),
    });
    const { id: challengeId } = await res.json();

    // Ben loggt ein und nimmt Challenge an
    await loginAs(page, 'E2E-Ben', p2Token);
    await page.locator('#mp-home-card').click({ timeout: 3000 });
    await page.locator('button:has-text("Challenges")').click();
    await page.locator('#screen-mp-challenge-inbox').waitFor();

    // Klick auf "Annehmen" der frisch erstellten Challenge — neueste zuerst (ORDER BY created_at DESC)
    const acceptBtn = page.locator('#challenge-inbox-list button:has-text("Annehmen")').first();
    await acceptBtn.waitFor({ timeout: 5000 });
    await acceptBtn.click();

    // Das Spiel sollte starten
    await page.locator('#screen-game.active').waitFor({ timeout: 8000 });

    // Verifiziere, dass die richtige Challenge aktiv ist (challengeId aus API-Antwort)
    // _activeChallengeId wird in mpAcceptChallenge + startBlitz gesetzt und via saveState() persistiert
    const activeChallenge = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('henry_einmaleins') || '{}');
      return s.mp?._activeChallengeId;
    });
    expect(activeChallenge).toBe(challengeId);
  });
});

test.describe('Offline-Verhalten', () => {
  test('pendingUploads werden beim Start synchronisiert', async ({ page }) => {
    const { p1Token } = await getTokens();

    // Heutigen Challenge-ID holen
    const cr = await fetch(`${API}/api/challenge/today?group=${CODE}`);
    const { challengeId, date, seed } = await cr.json();

    // State mit einem pending Upload initialisieren
    await loginAs(page, 'E2E-Anna', p1Token, {
      lastChallengeId: challengeId,
      lastSeedDate: date,
      lastSeed: seed,
      pendingUploads: [{
        type: 'scores',
        payload: { challengeId, score: 150, correctCount: 9, offlinePlayed: true },
        createdAt: Date.now() - 60000,
      }],
    });

    // mpSyncPending wird beim Load aufgerufen — warte kurz
    await page.waitForTimeout(3000);

    // pendingUploads sollte jetzt leer sein
    const pending = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('henry_einmaleins') || '{}');
      return s.mp?.pendingUploads?.length ?? -1;
    });
    expect(pending).toBe(0);
  });
});
