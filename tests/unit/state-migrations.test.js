const { migrateState, STATE_MIGRATIONS, STATE_VERSION } = require('../../1x1-trainer/logic.js');

describe('migrateState', () => {
  test('leerer State {} bekommt komplettes v11-Schema', () => {
    const result = migrateState({});
    expect(result._version).toBe(STATE_VERSION);
    expect(result.settings).toBeDefined();
    expect(result.settings.grosses1x1).toBe(false);
    expect(result.settings.inputMode).toBe('both');
    expect(result.settings.rechenart).toBe('both'); // v7: globale Rechenart
    expect(result.blitzConfig.rechenart).toBe('mult');
    expect(result.trainingConfig.rechenart).toBe('mult');
    // v8: trainingConfig kriegt reihen[] + alleReihen
    expect(result.trainingConfig.reihen).toEqual([]);
    expect(result.trainingConfig.alleReihen).toBe(false);
    expect(result.highScores.blitzDiv).toBe(0);
    expect(result.highScores.blitzListe).toEqual([]);
    // v5: turnier highscores resettet (Marathon-Modus, neue Semantik)
    expect(result.highScores.turnier).toBe(0);
    expect(result.highScores.turnierDiv).toBe(0);
    expect(result.highScores.turnierGemischt).toBe(0);
    // v6: mp-State
    expect(result.mp).toBeDefined();
    expect(result.mp.enabled).toBe(false);
    expect(result.mp.pendingUploads).toEqual([]);
    // v9: reiheStats kriegt lastAccuracy
    expect(result.reiheStats[1].lastAccuracy).toBeNull();
    // v10: changelogSeenVersion — leerer State bekommt '2.9' (Migration setzt es,
    // weil das Feld bei {} undefined ist; defaultState wäre null bei neuer
    // Installation aber Migration v9→v10 fängt das vor)
    expect(result.changelogSeenVersion).toBe('2.9');
    // v11: diamonds — leerer State bekommt 0 (kein streakFreezeTotal in {})
    expect(result.diamonds).toBe(0);
  });

  test('v1-State mit inputMode=tap wird auf both migriert', () => {
    const v1 = { _version: 1, settings: { grosses1x1: false, inputMode: 'tap', reiheMax: { 1: 20 } } };
    const result = migrateState(v1);
    expect(result._version).toBe(STATE_VERSION);
    expect(result.settings.inputMode).toBe('both');
  });

  test('v4-State mit altem turnier-Highscore wird auf 0 resettet (v4→v5)', () => {
    const v4 = { _version: 4, name: 'Henry', xp: 1000,
      settings: { grosses1x1: false, inputMode: 'both', reiheMax: {} },
      highScores: { turnier: 247, turnierDiv: 180, turnierGemischt: 99, blitz: 50, blitzListe: [] },
      blitzConfig: { reihen: [], alleReihen: true, rechenart: 'mult' },
      trainingConfig: { rechenart: 'mult' }, turnierConfig: { rechenart: 'mult' },
      reiheStats: {}, questionStats: {},
    };
    const result = migrateState(v4);
    expect(result._version).toBe(STATE_VERSION);
    expect(result.highScores.turnier).toBe(0);
    expect(result.highScores.turnierDiv).toBe(0);
    expect(result.highScores.turnierGemischt).toBe(0);
    // Andere highscores NICHT angetastet
    expect(result.highScores.blitz).toBe(50);
    expect(result.name).toBe('Henry');
    expect(result.xp).toBe(1000);
  });

  test('v5-State ohne mp bekommt mp-Default (v5→v6)', () => {
    const v5 = { _version: 5, name: 'Henry', xp: 1000,
      settings: { grosses1x1: false, inputMode: 'both', reiheMax: {} },
      highScores: { turnier: 0, blitz: 42, blitzListe: [] },
      blitzConfig: { reihen: [], alleReihen: true, rechenart: 'mult' },
      trainingConfig: { rechenart: 'mult' }, turnierConfig: { rechenart: 'mult' },
      reiheStats: {}, questionStats: {},
    };
    const result = migrateState(v5);
    expect(result._version).toBe(STATE_VERSION);
    expect(result.mp).toBeDefined();
    expect(result.mp.enabled).toBe(false);
    expect(result.mp.groupCode).toBeNull();
    expect(result.mp.pendingUploads).toEqual([]);
  });

  test('v6-State ohne settings.rechenart bekommt Default both (v6→v7)', () => {
    const v6 = { _version: 6, name: 'Henry', xp: 1000,
      settings: { grosses1x1: false, inputMode: 'both', reiheMax: {} }, // kein rechenart
      highScores: { turnier: 0, blitz: 42, blitzListe: [] },
      blitzConfig: { reihen: [], alleReihen: true, rechenart: 'mult' },
      trainingConfig: { rechenart: 'mult' }, turnierConfig: { rechenart: 'mult' },
      mp: { enabled: true, groupCode: 'KLASSE3', nickname: 'Henry',
            pinHash: 'x', token: 'y', pendingUploads: [],
            lastSeedDate: null, lastSeed: null, lastChallengeId: null },
      reiheStats: {}, questionStats: {},
    };
    const result = migrateState(v6);
    expect(result._version).toBe(STATE_VERSION);
    expect(result.settings.rechenart).toBe('both');
    // mp bleibt unverändert (war schon da)
    expect(result.mp.groupCode).toBe('KLASSE3');
  });

  test('idempotent: aktueller State unverändert', () => {
    const baseline = migrateState({});
    const again = migrateState({ ...baseline });
    expect(again._version).toBe(baseline._version);
    expect(again.settings).toEqual(baseline.settings);
    expect(again.mp).toEqual(baseline.mp);
  });

  test('unbekannte Felder bleiben erhalten', () => {
    const input = { _version: 4, customField: 'hello', name: 'Henry' };
    const result = migrateState(input);
    expect(result.customField).toBe('hello');
    expect(result.name).toBe('Henry');
  });

  test('_version > STATE_VERSION wird nicht zurück-migriert, foo bleibt erhalten', () => {
    const future = { _version: 99, foo: 'bar' };
    const result = migrateState(future);
    // migrateState always sets _version = STATE_VERSION at the end (Iron Rule: byte-identical body)
    expect(result._version).toBe(STATE_VERSION);
    expect(result.foo).toBe('bar');
  });
});

describe('STATE_MIGRATIONS', () => {
  test('Anzahl entspricht STATE_VERSION', () => {
    expect(STATE_MIGRATIONS.length).toBe(STATE_VERSION);
  });

  test('Migration 2 (v2->v3) legt blitzConfig + blitzListe an', () => {
    const v2 = { _version: 2, highScores: { blitz: 0 } };
    const result = STATE_MIGRATIONS[2](v2);
    expect(result.blitzConfig).toBeDefined();
    expect(result.blitzConfig.alleReihen).toBe(true);
    expect(result.highScores.blitzListe).toEqual([]);
  });

  test('Migration 3 (v3->v4) legt rechenart + Division-Felder an', () => {
    const v3 = { _version: 3, blitzConfig: { reihen: [], alleReihen: true } };
    const result = STATE_MIGRATIONS[3](v3);
    expect(result.blitzConfig.rechenart).toBe('mult');
    expect(result.trainingConfig).toEqual({ rechenart: 'mult' });
    expect(result.turnierConfig).toEqual({ rechenart: 'mult' });
    expect(result.highScores.blitzDiv).toBe(0);
  });

  test('Migration 4 (v4->v5) resettet turnier-Highscores auf 0', () => {
    const v4 = { _version: 4,
      highScores: { turnier: 500, turnierDiv: 200, turnierGemischt: 100, blitz: 42 }
    };
    const result = STATE_MIGRATIONS[4](v4);
    expect(result.highScores.turnier).toBe(0);
    expect(result.highScores.turnierDiv).toBe(0);
    expect(result.highScores.turnierGemischt).toBe(0);
    expect(result.highScores.blitz).toBe(42); // unangetastet
  });

  test('Migration 5 (v5->v6) legt mp-Default an', () => {
    const v5 = { _version: 5 };
    const result = STATE_MIGRATIONS[5](v5);
    expect(result.mp).toBeDefined();
    expect(result.mp.enabled).toBe(false);
    expect(result.mp.pendingUploads).toEqual([]);
  });

  test('Migration 5 (v5->v6) lässt existierendes mp unangetastet', () => {
    const v5 = { _version: 5, mp: { enabled: true, groupCode: 'X', nickname: 'A',
                                     pinHash: 'h', token: 't', pendingUploads: [{ a: 1 }],
                                     lastSeedDate: '2026-05-17', lastSeed: 42, lastChallengeId: 'c1' } };
    const result = STATE_MIGRATIONS[5](v5);
    expect(result.mp.enabled).toBe(true);
    expect(result.mp.groupCode).toBe('X');
    expect(result.mp.pendingUploads).toEqual([{ a: 1 }]);
  });

  test('Migration 6 (v6->v7) setzt settings.rechenart auf both', () => {
    const v6 = { _version: 6,
      settings: { grosses1x1: false, inputMode: 'both', reiheMax: {} }
    };
    const result = STATE_MIGRATIONS[6](v6);
    expect(result.settings.rechenart).toBe('both');
  });

  test('Migration 6 (v6->v7) lässt existierendes rechenart unangetastet', () => {
    const v6 = { _version: 6,
      settings: { grosses1x1: false, inputMode: 'both', reiheMax: {}, rechenart: 'mult' }
    };
    const result = STATE_MIGRATIONS[6](v6);
    expect(result.settings.rechenart).toBe('mult');
  });

  test('Migration 7 (v7->v8) ergänzt trainingConfig.reihen + alleReihen', () => {
    const v7 = { _version: 7, trainingConfig: { rechenart: 'mult' } };
    const result = STATE_MIGRATIONS[7](v7);
    expect(result.trainingConfig.reihen).toEqual([]);
    expect(result.trainingConfig.alleReihen).toBe(false);
    expect(result.trainingConfig.rechenart).toBe('mult'); // unangetastet
  });

  test('Migration 7 (v7->v8) lässt existierende reihen-Auswahl unangetastet', () => {
    const v7 = { _version: 7,
      trainingConfig: { rechenart: 'div', reihen: [3, 7], alleReihen: false } };
    const result = STATE_MIGRATIONS[7](v7);
    expect(result.trainingConfig.reihen).toEqual([3, 7]);
    expect(result.trainingConfig.alleReihen).toBe(false);
    expect(result.trainingConfig.rechenart).toBe('div');
  });

  test('Migration 7 (v7->v8) legt trainingConfig komplett an wenn fehlend', () => {
    const v7 = { _version: 7 };
    const result = STATE_MIGRATIONS[7](v7);
    expect(result.trainingConfig).toBeDefined();
    expect(result.trainingConfig.reihen).toEqual([]);
    expect(result.trainingConfig.alleReihen).toBe(false);
  });

  test('Migration 8 (v8->v9) ergänzt lastAccuracy in reiheStats', () => {
    const v8 = { _version: 8, reiheStats: {
      1: { sessions: 5, totalCorrect: 80, totalQuestions: 100, consecutivePerfect: 3,
           divConsecutivePerfect: 0, divCorrect: 0, divWrong: 0 },
      2: { sessions: 0, totalCorrect: 0, totalQuestions: 0, consecutivePerfect: 0,
           divConsecutivePerfect: 0, divCorrect: 0, divWrong: 0 },
    }};
    const result = STATE_MIGRATIONS[8](v8);
    expect(result.reiheStats[1].lastAccuracy).toBeNull();
    expect(result.reiheStats[2].lastAccuracy).toBeNull();
    // Andere Felder unangetastet
    expect(result.reiheStats[1].sessions).toBe(5);
    expect(result.reiheStats[1].consecutivePerfect).toBe(3);
  });

  test('Migration 8 (v8->v9) lässt existierenden lastAccuracy unangetastet', () => {
    const v8 = { _version: 8, reiheStats: {
      1: { sessions: 5, totalCorrect: 80, totalQuestions: 100, consecutivePerfect: 3,
           divConsecutivePerfect: 0, divCorrect: 0, divWrong: 0, lastAccuracy: 75 },
    }};
    const result = STATE_MIGRATIONS[8](v8);
    expect(result.reiheStats[1].lastAccuracy).toBe(75);
  });

  test('Migration 9 (v9->v10) setzt changelogSeenVersion=2.9 für existierende User', () => {
    const v9 = { _version: 9 };
    const result = STATE_MIGRATIONS[9](v9);
    expect(result.changelogSeenVersion).toBe('2.9');
  });

  test('Migration 9 (v9->v10) lässt existierenden changelogSeenVersion unangetastet', () => {
    const v9 = { _version: 9, changelogSeenVersion: '2.7' };
    const result = STATE_MIGRATIONS[9](v9);
    expect(result.changelogSeenVersion).toBe('2.7');
  });

  test('Migration 10 (v10->v11): kein streakFreezeTotal → diamonds=0', () => {
    const v10 = { _version: 10 };
    const result = STATE_MIGRATIONS[10](v10);
    expect(result.diamonds).toBe(0);
  });

  test('Migration 10 (v10->v11): streakFreezeTotal=2 → diamonds=2 (Loyalty)', () => {
    const v10 = { _version: 10, streakFreezeTotal: 2 };
    const result = STATE_MIGRATIONS[10](v10);
    expect(result.diamonds).toBe(2);
    expect(result.streakFreezeTotal).toBe(2); // historischer Counter bleibt
  });

  test('Migration 10 (v10->v11): streakFreezeTotal=10 → diamonds=3 (Cap)', () => {
    const v10 = { _version: 10, streakFreezeTotal: 10 };
    const result = STATE_MIGRATIONS[10](v10);
    expect(result.diamonds).toBe(3);
  });

  test('Migration 10 (v10->v11): existierender diamonds-Wert unangetastet', () => {
    const v10 = { _version: 10, streakFreezeTotal: 5, diamonds: 1 };
    const result = STATE_MIGRATIONS[10](v10);
    expect(result.diamonds).toBe(1);
  });
});
