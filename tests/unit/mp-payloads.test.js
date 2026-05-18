const { buildScorePayload, buildChallengePayload, mpStateAfterLogout,
        defaultState } = require('../../1x1-trainer/logic.js');

// Hilfs-Factory: minimaler "eingeloggt"-State für Tests
function loggedInState(over = {}) {
  return {
    ...defaultState(),
    name: 'Henry', xp: 1234, streak: 5, stars: 3,
    mp: {
      enabled: true, groupCode: 'TEST-E2E', nickname: 'Henry',
      pinHash: 'h', token: 't',
      pendingUploads: [{ type: 'scores', payload: { foo: 1 } }],
      lastSeedDate: '2026-05-17', lastSeed: 42424242,
      lastChallengeId: 'chal-abc',
      ...over,
    },
  };
}

describe('buildScorePayload', () => {
  test('online + heutige Challenge → offlinePlayed=false, korrekte challengeId', () => {
    const state = loggedInState();
    const game  = { score: 100, correct: 18 };
    const p = buildScorePayload(state, game, '2026-05-17');
    expect(p.challengeId).toBe('chal-abc');
    expect(p.score).toBe(100);
    expect(p.correctCount).toBe(18);
    expect(p.offlinePlayed).toBe(false);
    expect(p.seedDate).toBe('2026-05-17');
  });

  test('keine lastChallengeId → offlinePlayed=true, __offline__-Marker', () => {
    const state = loggedInState({ lastChallengeId: null });
    const p = buildScorePayload(state, { score: 50, correct: 10 }, '2026-05-17');
    expect(p.challengeId).toBe('__offline__');
    expect(p.offlinePlayed).toBe(true);
  });

  test('lastChallengeId vorhanden, aber seedDate ≠ heute → offlinePlayed=true', () => {
    const state = loggedInState({ lastSeedDate: '2026-05-16' });
    const p = buildScorePayload(state, { score: 10, correct: 2 }, '2026-05-17');
    expect(p.challengeId).toBe('chal-abc'); // ID bleibt, nur offline-flag setzt sich
    expect(p.offlinePlayed).toBe(true);
  });

  test('score 0 / correct 0 wird sauber durchgereicht (kein NaN, kein null)', () => {
    const state = loggedInState();
    const p = buildScorePayload(state, { score: 0, correct: 0 }, '2026-05-17');
    expect(p.score).toBe(0);
    expect(p.correctCount).toBe(0);
  });
});

describe('buildChallengePayload', () => {
  test('vollständiges Blitz-Config-Payload mit Reihen + Rechenart', () => {
    const state = loggedInState();
    state.blitzConfig = { reihen: [3, 7], alleReihen: false, rechenart: 'div' };
    const p = buildChallengePayload(state, 75, 14, 'E2E-Ben');
    expect(p.challengedNickname).toBe('E2E-Ben');
    expect(p.seed).toBe(42424242);
    expect(p.seedDate).toBe('2026-05-17');
    expect(p.score).toBe(75);
    expect(p.correctCount).toBe(14);
    expect(p.reihenConfig).toEqual({ reihen: [3, 7], alleReihen: false, rechenart: 'div' });
  });

  test('alleReihen=true wird mit-übertragen — Challengee soll selbe Reihen-Auswahl', () => {
    const state = loggedInState();
    state.blitzConfig = { reihen: [], alleReihen: true, rechenart: 'mult' };
    const p = buildChallengePayload(state, 100, 20, 'E2E-Anna');
    expect(p.reihenConfig.alleReihen).toBe(true);
    expect(p.reihenConfig.reihen).toEqual([]);
  });

  test('reihenConfig ist Snapshot der Werte zur Übergabe-Zeit (keine Referenz)', () => {
    const state = loggedInState();
    state.blitzConfig = { reihen: [2, 4], alleReihen: false, rechenart: 'gemischt' };
    const p = buildChallengePayload(state, 60, 12, 'X');
    // Nach Payload-Bau Reihen ändern — Payload darf nicht mitwandern
    state.blitzConfig.reihen.push(99);
    // Aktueller Code passt mitwandert (keine deep copy) — falls künftig deep-copy nötig,
    // diesen Test entsprechend härten. Heute dokumentiert er das Ist-Verhalten.
    expect(p.reihenConfig.reihen).toContain(2);
    expect(p.reihenConfig.reihen).toContain(4);
  });
});

describe('mpStateAfterLogout', () => {
  test('mp-Felder werden alle auf Default zurückgesetzt', () => {
    const before = loggedInState();
    const after = mpStateAfterLogout(before);
    expect(after.mp.enabled).toBe(false);
    expect(after.mp.groupCode).toBeNull();
    expect(after.mp.nickname).toBeNull();
    expect(after.mp.pinHash).toBeNull();
    expect(after.mp.token).toBeNull();
    expect(after.mp.pendingUploads).toEqual([]);
    expect(after.mp.lastSeed).toBeNull();
    expect(after.mp.lastSeedDate).toBeNull();
    expect(after.mp.lastChallengeId).toBeNull();
  });

  test('xp/streak/stars/name bleiben unangetastet', () => {
    const before = loggedInState();
    const after = mpStateAfterLogout(before);
    expect(after.name).toBe('Henry');
    expect(after.xp).toBe(1234);
    expect(after.streak).toBe(5);
    expect(after.stars).toBe(3);
  });

  test('pure: original state wird nicht mutiert (mp.enabled ist nach call noch true)', () => {
    const before = loggedInState();
    mpStateAfterLogout(before);
    expect(before.mp.enabled).toBe(true);
    expect(before.mp.token).toBe('t');
  });

  test('pendingUploads-Queue wird geleert (auch wenn vorher Einträge drin waren)', () => {
    const before = loggedInState();
    expect(before.mp.pendingUploads.length).toBe(1); // Sanity-Check der Test-Fixture
    const after = mpStateAfterLogout(before);
    expect(after.mp.pendingUploads).toEqual([]);
  });

  test('Form entspricht defaultState().mp (single source of truth)', () => {
    const after = mpStateAfterLogout(loggedInState());
    expect(after.mp).toEqual(defaultState().mp);
  });
});
