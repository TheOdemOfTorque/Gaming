// TDD: Tests-first für Auto-Spend-Logik (#18 Folge-Härtung).
// Logik existiert aktuell DOM-gekoppelt in updateHomeUI. Diese Tests treiben
// die Extraktion in eine pure Funktion computeStreakProtection.
//
// Erwartetes API:
//   computeStreakProtection(state, todayStr) → {
//     state: {…},        // (immutable) neuer State nach Auto-Spend
//     saved: bool,       // true wenn Diamant eingelöst wurde
//     broken: bool,      // true wenn Streak gebrochen ist
//   }
// Pure: kein DOM, kein Toast, mutiert input-state NICHT.

const { computeStreakProtection } = require('../../1x1-trainer/logic.js');

// Helper: Tagesabstand-strings
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toDateString();
}
const TODAY = new Date().toDateString();

function makeState(over = {}) {
  return {
    streak: 5,
    diamonds: 0,
    lastPlayDate: TODAY,
    streakFreezeUsedDate: null,
    streakFreezeTotal: 0,
    ...over,
  };
}

describe('computeStreakProtection — keine Schutz-Aktion nötig', () => {
  test('lastPlayDate === heute → unchanged, weder saved noch broken', () => {
    const s = makeState({ lastPlayDate: TODAY });
    const r = computeStreakProtection(s, TODAY);
    expect(r.saved).toBe(false);
    expect(r.broken).toBe(false);
    expect(r.state.streak).toBe(5);
    expect(r.state.diamonds).toBe(0);
  });

  test('lastPlayDate === gestern → unchanged (Streak noch heil)', () => {
    const s = makeState({ lastPlayDate: daysAgo(1) });
    const r = computeStreakProtection(s, TODAY);
    expect(r.saved).toBe(false);
    expect(r.broken).toBe(false);
    expect(r.state.streak).toBe(5);
  });

  test('streak === 0 → keine Aktion auch wenn Lücke', () => {
    const s = makeState({ streak: 0, lastPlayDate: daysAgo(5) });
    const r = computeStreakProtection(s, TODAY);
    expect(r.saved).toBe(false);
    expect(r.broken).toBe(false);
    expect(r.state.streak).toBe(0);
  });

  test('lastPlayDate fehlt (null) → keine Aktion', () => {
    const s = makeState({ lastPlayDate: null });
    const r = computeStreakProtection(s, TODAY);
    expect(r.saved).toBe(false);
    expect(r.broken).toBe(false);
  });
});

describe('computeStreakProtection — Lücke mit 0 Diamanten = Streak bricht', () => {
  test('2-Tage-Lücke + 0 Diamanten → streak=0, broken=true, kein Toast', () => {
    const s = makeState({ streak: 5, diamonds: 0, lastPlayDate: daysAgo(2) });
    const r = computeStreakProtection(s, TODAY);
    expect(r.broken).toBe(true);
    expect(r.saved).toBe(false);
    expect(r.state.streak).toBe(0);
    expect(r.state.diamonds).toBe(0);  // nichts ausgegeben
  });

  test('5-Tage-Lücke + 0 Diamanten → streak=0', () => {
    const s = makeState({ streak: 10, diamonds: 0, lastPlayDate: daysAgo(5) });
    const r = computeStreakProtection(s, TODAY);
    expect(r.broken).toBe(true);
    expect(r.state.streak).toBe(0);
  });
});

describe('computeStreakProtection — Lücke mit Diamanten = Auto-Spend', () => {
  test('2-Tage-Lücke + 1 Diamant → saved=true, diamonds=0, streak bleibt', () => {
    const s = makeState({ streak: 5, diamonds: 1, lastPlayDate: daysAgo(2) });
    const r = computeStreakProtection(s, TODAY);
    expect(r.saved).toBe(true);
    expect(r.broken).toBe(false);
    expect(r.state.streak).toBe(5);
    expect(r.state.diamonds).toBe(0);
  });

  test('Auto-Spend setzt streakFreezeUsedDate + inkrementiert streakFreezeTotal', () => {
    const s = makeState({ streak: 7, diamonds: 2, lastPlayDate: daysAgo(2),
                          streakFreezeUsedDate: null, streakFreezeTotal: 4 });
    const r = computeStreakProtection(s, TODAY);
    expect(r.state.streakFreezeUsedDate).not.toBeNull();
    expect(r.state.streakFreezeTotal).toBe(5);
  });

  test('Auto-Spend setzt lastPlayDate auf heute — die Lücke ist geschlossen', () => {
    const s = makeState({ streak: 3, diamonds: 1, lastPlayDate: daysAgo(2) });
    const r = computeStreakProtection(s, TODAY);
    expect(r.state.lastPlayDate).toBe(TODAY);
  });

  test('Mehrere-Tage-Lücke + 1 Diamant → genau 1 Diamant verbraucht (nicht pro Tag)', () => {
    const s = makeState({ streak: 5, diamonds: 1, lastPlayDate: daysAgo(7) });
    const r = computeStreakProtection(s, TODAY);
    expect(r.saved).toBe(true);
    expect(r.state.diamonds).toBe(0);  // nicht 0 - 6 = -6, sondern 1 - 1 = 0
    expect(r.state.streak).toBe(5);
  });

  test('Mehrere-Tage-Lücke + 3 Diamanten → genau 1 Diamant verbraucht', () => {
    const s = makeState({ streak: 5, diamonds: 3, lastPlayDate: daysAgo(4) });
    const r = computeStreakProtection(s, TODAY);
    expect(r.saved).toBe(true);
    expect(r.state.diamonds).toBe(2);
  });
});

describe('computeStreakProtection — Reinheit', () => {
  test('mutiert input-state NICHT', () => {
    const s = makeState({ streak: 5, diamonds: 1, lastPlayDate: daysAgo(2) });
    const snapshot = JSON.parse(JSON.stringify(s));
    computeStreakProtection(s, TODAY);
    expect(s).toEqual(snapshot);
  });
});
