const { compareVersion, changelogSince } = require('../../1x1-trainer/logic.js');

describe('compareVersion', () => {
  test('gleiche Versionen liefern 0', () => {
    expect(compareVersion('2.9', '2.9')).toBe(0);
    expect(compareVersion('3.0', '3.0')).toBe(0);
  });

  test('Major-Sprung: 3.0 > 2.10', () => {
    expect(compareVersion('3.0', '2.10')).toBeGreaterThan(0);
    expect(compareVersion('2.10', '3.0')).toBeLessThan(0);
  });

  test('Minor-Sprung numerisch korrekt: 2.10 > 2.9 (NICHT string-compare)', () => {
    expect(compareVersion('2.10', '2.9')).toBeGreaterThan(0);
    expect(compareVersion('2.9', '2.10')).toBeLessThan(0);
  });

  test('Patch-Versionen: 2.9.1 > 2.9', () => {
    expect(compareVersion('2.9.1', '2.9')).toBeGreaterThan(0);
    expect(compareVersion('2.9', '2.9.1')).toBeLessThan(0);
  });

  test('null/undefined wird als 0 behandelt', () => {
    expect(compareVersion(null, '2.9')).toBeLessThan(0);
    expect(compareVersion('2.9', null)).toBeGreaterThan(0);
    expect(compareVersion(undefined, undefined)).toBe(0);
  });
});

describe('changelogSince', () => {
  const CHANGELOG = [
    { version: '2.10', date: '2026-05-21', entries: ['🆕 Multi-Reihen-Training'] },
    { version: '2.9',  date: '2026-05-18', entries: ['🆕 Multiplayer'] },
    { version: '2.8',  date: '2026-05-17', entries: ['🔧 Bug-Fix'] },
  ];

  test('seenVersion=null → leeres Array (erste Installation)', () => {
    expect(changelogSince(CHANGELOG, null, '2.10')).toEqual([]);
    expect(changelogSince(CHANGELOG, undefined, '2.10')).toEqual([]);
  });

  test('seenVersion=2.9 + current=2.10 → nur 2.10-Eintrag', () => {
    const res = changelogSince(CHANGELOG, '2.9', '2.10');
    expect(res).toHaveLength(1);
    expect(res[0].version).toBe('2.10');
  });

  test('seenVersion=2.8 + current=2.10 → beide neueren (2.10, 2.9), absteigend', () => {
    const res = changelogSince(CHANGELOG, '2.8', '2.10');
    expect(res.map(e => e.version)).toEqual(['2.10', '2.9']);
  });

  test('seenVersion=2.10 + current=2.10 → leer (alles gesehen)', () => {
    expect(changelogSince(CHANGELOG, '2.10', '2.10')).toEqual([]);
  });

  test('currentVersion=2.9 kappt 2.10-Eintrag — Future-Entries werden nicht angezeigt', () => {
    const res = changelogSince(CHANGELOG, '2.8', '2.9');
    expect(res.map(e => e.version)).toEqual(['2.9']);
  });

  test('currentVersion=undefined erlaubt alle neueren (Bypass-Mode für Settings-Test-Trigger)', () => {
    const res = changelogSince(CHANGELOG, '2.8', undefined);
    expect(res.map(e => e.version)).toEqual(['2.10', '2.9']);
  });

  test('leeres CHANGELOG → leeres Array', () => {
    expect(changelogSince([], '2.9', '2.10')).toEqual([]);
    expect(changelogSince(null, '2.9', '2.10')).toEqual([]);
  });

  test('Sortierung absteigend bei unsortiertem CHANGELOG', () => {
    const unsorted = [
      { version: '2.8', entries: ['a'] },
      { version: '2.10', entries: ['b'] },
      { version: '2.9', entries: ['c'] },
    ];
    const res = changelogSince(unsorted, '2.7', '2.10');
    expect(res.map(e => e.version)).toEqual(['2.10', '2.9', '2.8']);
  });
});
