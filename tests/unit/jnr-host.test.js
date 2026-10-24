const H = require('../../jumpnrun/core/host.js');

describe('buildResultMessage', () => {
  test('hat genau die Vertragsfelder', () => {
    const m = H.buildResultMessage({ level: '1-1', medaillen: 3, funken: 9, xp: 50, timeMs: 1234 });
    expect(m).toEqual({ type: 'jnr:result', level: '1-1', medaillen: 3, funken: 9, xp: 50 });
  });
});

describe('parseHostMessage', () => {
  test('jnr:pause und jnr:timeup', () => {
    expect(H.parseHostMessage({ type: 'jnr:pause' })).toEqual({ kind: 'pause' });
    expect(H.parseHostMessage({ type: 'jnr:timeup' })).toEqual({ kind: 'timeup' });
  });
  test('jnr:init übernimmt Fortschritt und Optionen bereinigt', () => {
    const m = H.parseHostMessage({
      type: 'jnr:init', level: '1-2',
      jnr: { levels: { '1-1': { medals: 2, bestTimeMs: 5, bestFunken: 3 } }, xpAwarded: { '1-1': true } },
      options: { steuerung: 'einfach', mathe: 'aus', farbhilfe: false, musik: false, unsinn: 1 }
    });
    expect(m.kind).toBe('init');
    expect(m.level).toBe('1-2');
    expect(m.jnr.levels['1-1'].medals).toBe(2);
    expect(m.jnr.xpAwarded['1-1']).toBe(true);
    expect(m.jnr.options).toEqual({ steuerung: 'einfach', mathe: 'aus', farbhilfe: false, musik: false });
  });
  test('init ohne Daten ist gültig (Standardwerte)', () => {
    const m = H.parseHostMessage({ type: 'jnr:init' });
    expect(m.kind).toBe('init');
    expect(m.level).toBeNull();
    expect(m.jnr.levels).toEqual({});
  });
  test('fremde oder kaputte Nachrichten ergeben null', () => {
    expect(H.parseHostMessage(null)).toBeNull();
    expect(H.parseHostMessage('jnr:pause')).toBeNull();
    expect(H.parseHostMessage({ type: 'etwas:anderes' })).toBeNull();
    expect(H.parseHostMessage({})).toBeNull();
  });
});

describe('isTrustedMessage', () => {
  const parent = {};
  test('nur gleicher Origin und Nachricht vom Parent-Fenster', () => {
    expect(H.isTrustedMessage({ origin: 'https://a.de', source: parent }, 'https://a.de', parent)).toBe(true);
    expect(H.isTrustedMessage({ origin: 'https://evil.de', source: parent }, 'https://a.de', parent)).toBe(false);
    expect(H.isTrustedMessage({ origin: 'https://a.de', source: {} }, 'https://a.de', parent)).toBe(false);
  });
});

describe('isEmbedded', () => {
  test('erkennt iframe', () => {
    const w = {}; w.parent = w;
    expect(H.isEmbedded(w)).toBe(false);
    expect(H.isEmbedded({ parent: {} })).toBe(true);
  });
});
