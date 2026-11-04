const H = require('../../jumpnrun/core/host.js');

describe('buildResultMessage', () => {
  test('hat genau die Vertragsfelder', () => {
    const m = H.buildResultMessage({ level: '1-2', medaillen: 3, funken: 9, xp: 0, timeMs: 1234 });
    expect(m).toEqual({ type: 'jnr:result', level: '1-2', medaillen: 3, funken: 9, xp: 0 });
  });
});

describe('parseHostMessage', () => {
  test('jnr:pause und jnr:timeup', () => {
    expect(H.parseHostMessage({ type: 'jnr:pause' })).toEqual({ kind: 'pause' });
    expect(H.parseHostMessage({ type: 'jnr:timeup' })).toEqual({ kind: 'timeup' });
  });
  test('jnr:init übernimmt Fortschritt und Optionen bereinigt (auch Alteinträge der gestrichenen Stufe 1-1)', () => {
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
  test('init mit jnr aber ohne separates options-Feld behält die Optionen aus jnr', () => {
    const m = H.parseHostMessage({
      type: 'jnr:init', level: '1-2',
      jnr: {
        levels: { '1-1': { medals: 2, bestTimeMs: 5, bestFunken: 3 } },
        options: { steuerung: 'einfach', mathe: 'aus', farbhilfe: false, musik: false }
      }
    });
    expect(m.jnr.options).toEqual({ steuerung: 'einfach', mathe: 'aus', farbhilfe: false, musik: false });
  });
  test('init ohne Daten ist gültig (Standardwerte)', () => {
    const m = H.parseHostMessage({ type: 'jnr:init' });
    expect(m.kind).toBe('init');
    expect(m.level).toBeNull();
    expect(m.jnr.levels).toEqual({});
  });
  test('init ohne lernstand ergibt lernstand null (Standalone-Verhalten)', () => {
    expect(H.parseHostMessage({ type: 'jnr:init' }).lernstand).toBeNull();
  });
  test('init übernimmt einen gültigen lernstand', () => {
    const m = H.parseHostMessage({ type: 'jnr:init', lernstand: { 2: 0.9, '7': 0.3, 10: 0, 5: 1 } });
    expect(m.lernstand).toEqual({ 2: 0.9, 7: 0.3, 10: 0, 5: 1 });
  });
  test('lernstand: ungültige Einträge fallen weg, gültige bleiben', () => {
    const m = H.parseHostMessage({ type: 'jnr:init', lernstand: {
      1: 0.5, 11: 0.5, 'x': 0.5, '3.5': 0.5, '03': 0.5,
      4: -0.1, 6: 1.5, 8: NaN, 9: '0.4', 7: null, 3: Infinity, 2: 0.25
    } });
    expect(m.lernstand).toEqual({ 2: 0.25 });
  });
  test('lernstand ohne gültige Einträge oder mit falschem Typ ergibt null', () => {
    expect(H.parseHostMessage({ type: 'jnr:init', lernstand: {} }).lernstand).toBeNull();
    expect(H.parseHostMessage({ type: 'jnr:init', lernstand: { 1: 0.5 } }).lernstand).toBeNull();
    expect(H.parseHostMessage({ type: 'jnr:init', lernstand: [0.1, 0.2, 0.3] }).lernstand).toBeNull();
    expect(H.parseHostMessage({ type: 'jnr:init', lernstand: 'viel' }).lernstand).toBeNull();
    expect(H.parseHostMessage({ type: 'jnr:init', lernstand: null }).lernstand).toBeNull();
  });
  test('lernstand landet nicht im jnr-Fortschritt (kein Schreiben in den Spielstand)', () => {
    const m = H.parseHostMessage({ type: 'jnr:init', lernstand: { 7: 0.3 } });
    expect(m.jnr.lernstand).toBeUndefined();
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

describe('Tutorial-Vertrag', () => {
  test('buildTutorialMessage hat genau die Vertragsfelder', () => {
    expect(H.buildTutorialMessage()).toEqual({ type: 'jnr:tutorial', gesehen: true });
  });
  test('jnr:init reicht tutorialGesehen aus dem Fortschritt durch', () => {
    expect(H.parseHostMessage({ type: 'jnr:init', jnr: { tutorialGesehen: true } }).jnr.tutorialGesehen).toBe(true);
    expect(H.parseHostMessage({ type: 'jnr:init', jnr: {} }).jnr.tutorialGesehen).toBe(false);
    expect(H.parseHostMessage({ type: 'jnr:init' }).jnr.tutorialGesehen).toBe(false);
  });
  test('das Spiel versteht jnr:tutorial nicht als Host-Nachricht (Richtung Spiel -> Trainer)', () => {
    expect(H.parseHostMessage({ type: 'jnr:tutorial', gesehen: true })).toBeNull();
  });
});

// jnr:aktiv meldet zwei Dinge (Vertrag core/host.js): aktiv = ein Level oder das Tutorial laeuft
// (fuer das X der Trainer-Leiste), zeit = die Stern-Zeit soll laufen. Gleiche Regel wie Space Invader
// (Marco 30.10.2026): Zeit laeuft, solange Lumo offen ist, auch im Menue und in der Reihenwahl; sie
// steht in der Pause und in Dialogen, die das Spiel anhalten.
describe('jnr:aktiv (aktiv im Level, zeit fuer die Stern-Zeit)', () => {
  test('buildAktivMessage hat genau die Vertragsfelder', () => {
    expect(H.buildAktivMessage(true, true)).toEqual({ type: 'jnr:aktiv', aktiv: true, zeit: true });
    expect(H.buildAktivMessage(false, true)).toEqual({ type: 'jnr:aktiv', aktiv: false, zeit: true });
    expect(H.buildAktivMessage(false, false)).toEqual({ type: 'jnr:aktiv', aktiv: false, zeit: false });
    expect(H.buildAktivMessage(1, 0)).toEqual({ type: 'jnr:aktiv', aktiv: true, zeit: false });
  });

  test('aktiv ist nur mode play (Level oder Tutorial)', () => {
    expect(H.istAktiv('play')).toBe(true);
    ['menu', 'reihenwahl', 'pause', 'won', 'lost', 'ended', undefined].forEach((m) => {
      expect(H.istAktiv(m)).toBe(false);
    });
  });

  test('Stern-Zeit laeuft in Menue, Reihenwahl und Spiel, steht in Pause und Dialogen', () => {
    ['menu', 'reihenwahl', 'play'].forEach((m) => expect(H.zeitLaeuft(m)).toBe(true));
    ['pause', 'won', 'lost', 'ended', undefined].forEach((m) => expect(H.zeitLaeuft(m)).toBe(false));
  });

  test('Melder sendet bei jedem Wechsel von aktiv oder zeit, auf Wunsch den aktuellen Stand erneut', () => {
    const sent = [];
    const m = H.createAktivMelder((msg) => sent.push(msg));
    m.melde('menu');               // erster Stand wird immer gemeldet
    m.melde('menu');
    m.melde('reihenwahl');         // gleicher Stand wie im Menue: nichts
    m.melde('play');               // aktiv wechselt
    m.melde('play');
    m.melde('pause');              // aktiv und zeit wechseln
    m.melde('won');                // gleicher Stand wie in der Pause: nichts
    m.melde('won', true);          // z.B. als Antwort auf jnr:init
    m.melde('menu');               // zeit wechselt
    expect(sent).toEqual([
      { type: 'jnr:aktiv', aktiv: false, zeit: true },
      { type: 'jnr:aktiv', aktiv: true, zeit: true },
      { type: 'jnr:aktiv', aktiv: false, zeit: false },
      { type: 'jnr:aktiv', aktiv: false, zeit: false },
      { type: 'jnr:aktiv', aktiv: false, zeit: true },
    ]);
  });

  test('das Spiel versteht jnr:aktiv nicht als Host-Nachricht (Richtung Spiel -> Trainer)', () => {
    expect(H.parseHostMessage({ type: 'jnr:aktiv', aktiv: true })).toBeNull();
  });
});

// Neue Stern-Zeit nach Ablauf (Stern eingesetzt im Trainer): der Trainer schickt jnr:weiter, Lumo
// setzt eine Pause fort, die der Trainer beim Ablauf ausgeloest hat.
describe('jnr:weiter (nach "Stern einsetzen & weiterspielen")', () => {
  test('wird als Host-Nachricht erkannt', () => {
    expect(H.parseHostMessage({ type: 'jnr:weiter' })).toEqual({ kind: 'weiter' });
  });
});

describe('debugErlaubt (window.__jnr nur mit Debug-Parameter)', () => {
  test('ohne Parameter oder mit fremden Parametern: keine Debug-Hilfen', () => {
    expect(H.debugErlaubt('')).toBe(false);
    expect(H.debugErlaubt('?foo=1')).toBe(false);
    expect(H.debugErlaubt('?jnrDebug=0')).toBe(false);
    expect(H.debugErlaubt('?jnrTutorial=0')).toBe(false);
    expect(H.debugErlaubt(undefined)).toBe(false);
  });
  test('jnrDebug=1 und die bestehenden Debug-Parameter schalten frei', () => {
    ['?jnrDebug=1', '?jnrLevel=1-2', '?jnrSeed=3', '?jnrReihe=7', '?jnrTutorial=1', 'jnrDebug=1', '?a=1&jnrSeed=1'].forEach((q) => {
      expect(H.debugErlaubt(q)).toBe(true);
    });
  });
});

describe('jnr:beenden (Lumo verlassen, Zurueck zum Trainer)', () => {
  test('buildBeendenMessage hat genau die Vertragsfelder', () => {
    expect(H.buildBeendenMessage()).toEqual({ type: 'jnr:beenden' });
  });
  test('das Spiel versteht jnr:beenden nicht als Host-Nachricht (Richtung Spiel -> Trainer)', () => {
    expect(H.parseHostMessage({ type: 'jnr:beenden' })).toBeNull();
  });
  test('buildZeitendeMessage bestaetigt jnr:timeup (Dialog steht), ebenfalls nur Richtung Trainer', () => {
    expect(H.buildZeitendeMessage()).toEqual({ type: 'jnr:zeitende' });
    expect(H.parseHostMessage({ type: 'jnr:zeitende' })).toBeNull();
  });
});
