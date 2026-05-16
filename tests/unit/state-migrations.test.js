const { migrateState, STATE_MIGRATIONS, STATE_VERSION } = require('../../1x1-trainer/logic.js');

describe('migrateState', () => {
  test('leerer State {} bekommt komplettes v4-Schema', () => {
    const result = migrateState({});
    expect(result._version).toBe(4);
    expect(result.settings).toBeDefined();
    expect(result.settings.grosses1x1).toBe(false);
    expect(result.settings.inputMode).toBe('both');
    expect(result.blitzConfig.rechenart).toBe('mult');
    expect(result.trainingConfig.rechenart).toBe('mult');
    expect(result.highScores.blitzDiv).toBe(0);
    expect(result.highScores.blitzListe).toEqual([]);
  });

  test('v1-State mit inputMode=tap wird auf both migriert', () => {
    const v1 = { _version: 1, settings: { grosses1x1: false, inputMode: 'tap', reiheMax: { 1: 20 } } };
    const result = migrateState(v1);
    expect(result._version).toBe(4);
    expect(result.settings.inputMode).toBe('both');
  });

  test('idempotent: v4-State unverändert', () => {
    const baseline = migrateState({});
    const again = migrateState({ ...baseline });
    expect(again._version).toBe(baseline._version);
    expect(again.settings).toEqual(baseline.settings);
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
});
