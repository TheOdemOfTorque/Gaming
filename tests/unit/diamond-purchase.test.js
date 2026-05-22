// TDD: Tests-first für Diamant-Kauf-Mechanik (#18 Folge-Härtung).
// applyDiamondPurchase ersetzt die DOM-gekoppelte buyDiamond in der Logik-Schicht.
//
// Erwartetes API:
//   applyDiamondPurchase(state) → { state, success }
// success=false wenn Cap oder zu wenig XP. Pure: kein Side-Effect.

const { applyDiamondPurchase, DIAMOND_PRICE, DIAMOND_CAP } = require('../../1x1-trainer/logic.js');

function st(over = {}) { return { xp: 5000, diamonds: 0, ...over }; }

describe('applyDiamondPurchase — Erfolgsfälle', () => {
  test('genug XP + unter Cap → diamonds++, xp -= DIAMOND_PRICE, success=true', () => {
    const s = st({ xp: 5000, diamonds: 0 });
    const r = applyDiamondPurchase(s);
    expect(r.success).toBe(true);
    expect(r.state.diamonds).toBe(1);
    expect(r.state.xp).toBe(5000 - DIAMOND_PRICE);
  });

  test('exakter Preis (DIAMOND_PRICE XP) → erlaubt', () => {
    const s = st({ xp: DIAMOND_PRICE, diamonds: 0 });
    const r = applyDiamondPurchase(s);
    expect(r.success).toBe(true);
    expect(r.state.xp).toBe(0);
  });

  test('letzter Diamant bis Cap (DIAMOND_CAP - 1 → CAP) → erlaubt', () => {
    const s = st({ xp: 9999, diamonds: DIAMOND_CAP - 1 });
    const r = applyDiamondPurchase(s);
    expect(r.success).toBe(true);
    expect(r.state.diamonds).toBe(DIAMOND_CAP);
  });
});

describe('applyDiamondPurchase — Failure-Fälle', () => {
  test('Cap erreicht → success=false, state unverändert', () => {
    const s = st({ xp: 99999, diamonds: DIAMOND_CAP });
    const r = applyDiamondPurchase(s);
    expect(r.success).toBe(false);
    expect(r.state.diamonds).toBe(DIAMOND_CAP);
    expect(r.state.xp).toBe(99999);
  });

  test('zu wenig XP → success=false, state unverändert', () => {
    const s = st({ xp: DIAMOND_PRICE - 1, diamonds: 0 });
    const r = applyDiamondPurchase(s);
    expect(r.success).toBe(false);
    expect(r.state.diamonds).toBe(0);
    expect(r.state.xp).toBe(DIAMOND_PRICE - 1);
  });

  test('0 XP + 0 Diamanten → success=false', () => {
    const r = applyDiamondPurchase(st({ xp: 0, diamonds: 0 }));
    expect(r.success).toBe(false);
  });
});

describe('applyDiamondPurchase — Reinheit', () => {
  test('mutiert input-state NICHT bei Erfolg', () => {
    const s = st({ xp: 5000, diamonds: 1 });
    const snap = JSON.parse(JSON.stringify(s));
    applyDiamondPurchase(s);
    expect(s).toEqual(snap);
  });

  test('mutiert input-state NICHT bei Fehler', () => {
    const s = st({ xp: 100, diamonds: 0 });
    const snap = JSON.parse(JSON.stringify(s));
    applyDiamondPurchase(s);
    expect(s).toEqual(snap);
  });
});
