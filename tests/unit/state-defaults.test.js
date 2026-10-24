const { defaultSettings, defaultReiheStats, defaultState, defaultQS, STATE_VERSION } = require('../../1x1-trainer/logic.js');

describe('defaultSettings', () => {
  test('Shape mit grosses1x1=false, inputMode=both, reiheMax[1..20]=20', () => {
    const s = defaultSettings();
    expect(s.grosses1x1).toBe(false);
    expect(s.inputMode).toBe('both');
    expect(s.reiheMax[1]).toBe(20);
    expect(s.reiheMax[20]).toBe(20);
    expect(Object.keys(s.reiheMax)).toHaveLength(20);
  });
});

describe('defaultReiheStats', () => {
  test('20 Einträge, alle Felder auf 0/null', () => {
    const s = defaultReiheStats();
    expect(Object.keys(s)).toHaveLength(20);
    expect(s[1].sessions).toBe(0);
    expect(s[1].consecutivePerfect).toBe(0);
    expect(s[1].divConsecutivePerfect).toBe(0);
    expect(s[1].divCorrect).toBe(0);
    expect(s[20].totalCorrect).toBe(0);
    expect(s[1].lastAccuracy).toBeNull();  // v9: lastAccuracy
  });
});

describe('defaultState', () => {
  test('_version === STATE_VERSION', () => {
    expect(defaultState()._version).toBe(STATE_VERSION);
  });

  test('hat alle Top-Level-Felder', () => {
    const s = defaultState();
    expect(s.xp).toBe(0);
    expect(s.name).toBe('');
    expect(s.highScores).toBeDefined();
    expect(s.blitzConfig).toBeDefined();
    expect(s.trainingConfig).toBeDefined();
    expect(s.turnierConfig).toBeDefined();
  });

  // Regression: defaultState() setzt _version direkt auf STATE_VERSION, dadurch
  // läuft migrateState(defaultState()) die v11→v12-Migration NIE (fromVersion ===
  // STATE_VERSION). Ein Neuinstall-State muss knobel/jnr deshalb schon selbst mitbringen.
  test('hat state.knobel und state.jnr (v12, auch ohne Migration)', () => {
    const s = defaultState();
    expect(s.knobel).toEqual({ tagesXp: { datum: null, xp: 0 }, stufe: { mauer: 1, kaefige: 1 } });
    expect(s.jnr).toEqual({
      v: 1, levels: {}, lastLevel: null, funkenTotal: 0, xpAwarded: {},
      options: { steuerung: 'standard', mathe: 'ziel', farbhilfe: true, musik: true },
    });
  });
});

describe('defaultQS', () => {
  test('liefert frisches QS-Objekt', () => {
    expect(defaultQS()).toEqual({ correct: 0, wrong: 0, consecutiveCorrect: 0 });
  });

  test('zwei Aufrufe liefern unterschiedliche Objekt-Referenzen', () => {
    expect(defaultQS()).not.toBe(defaultQS());
  });
});
