// Vor dem require setzen: Datumslogik soll in einer Zeitzone mit UTC-Versatz laufen,
// sonst fällt ein UTC-statt-Lokal-Fehler im Test nicht auf.
process.env.TZ = 'Europe/Berlin';
const { lokalesDatum, spielGeladen, sternZeitEinloesen } = require('../../1x1-trainer/logic.js');

describe('lokalesDatum (Knobel-Tages-XP, QA-Befund N3)', () => {
  test('liefert das lokale Kalenderdatum als YYYY-MM-DD', () => {
    expect(lokalesDatum(new Date(2026, 9, 26, 14, 0))).toBe('2026-10-26');
  });

  test('kurz nach Mitternacht zählt schon der neue lokale Tag (UTC wäre noch gestern)', () => {
    const d = new Date(2026, 9, 27, 0, 30);
    expect(d.toISOString().slice(0, 10)).toBe('2026-10-26'); // so rechnete der Trainer bisher
    expect(lokalesDatum(d)).toBe('2026-10-27');
  });

  test('Monate und Tage zweistellig, Jahreswechsel lokal', () => {
    expect(lokalesDatum(new Date(2027, 0, 1, 0, 5))).toBe('2027-01-01');
    expect(lokalesDatum(new Date(2026, 2, 9, 12, 0))).toBe('2026-03-09');
  });

  test('ohne Argument: heute, gleiches Format wie Knobels heute()', () => {
    const jetzt = new Date();
    const p = (x) => (x < 10 ? '0' : '') + x;
    expect(lokalesDatum()).toBe(jetzt.getFullYear() + '-' + p(jetzt.getMonth() + 1) + '-' + p(jetzt.getDate()));
  });
});

describe('spielGeladen (Stern erst abziehen, wenn das Spiel wirklich da ist, QA-Befund M1)', () => {
  test('Lumo: geladen, wenn JNR.host im iframe existiert', () => {
    expect(spielGeladen('jnr', { JNR: { host: {} } })).toBe(true);
    expect(spielGeladen('jnr', { JNR: {} })).toBe(false);
    expect(spielGeladen('jnr', {})).toBe(false);
  });

  test('Knobel: geladen, wenn KnobelLogic im iframe existiert', () => {
    expect(spielGeladen('knobel', { KnobelLogic: {} })).toBe(true);
    expect(spielGeladen('knobel', {})).toBe(false);
  });

  test('kein Fenster, unbekanntes Spiel oder fremdes Fenster (Fehlerseite wirft): nicht geladen', () => {
    expect(spielGeladen('jnr', null)).toBe(false);
    expect(spielGeladen('quatsch', { JNR: { host: {} } })).toBe(false);
    const fehlerseite = {};
    Object.defineProperty(fehlerseite, 'JNR', { get() { throw new Error('SecurityError'); } });
    expect(spielGeladen('jnr', fehlerseite)).toBe(false);
  });
});

describe('sternZeitEinloesen', () => {
  test('keine Restzeit: ein Stern wird zu 10 Minuten', () => {
    const r = sternZeitEinloesen({ stars: 2, gameSecondsLeft: 0 }, 'jnr');
    expect(r.abgezogen).toBe(true);
    expect(r.state).toEqual({ stars: 1, gameSecondsLeft: 600 });
  });

  test('laufender Block: kein Stern', () => {
    const s = { stars: 2, gameSecondsLeft: 120 };
    const r = sternZeitEinloesen(s, 'jnr');
    expect(r.abgezogen).toBe(false);
    expect(r.state).toBe(s);
  });

  test('Knobel kostet keine Stern-Zeit', () => {
    const s = { stars: 2, gameSecondsLeft: 0 };
    expect(sternZeitEinloesen(s, 'knobel')).toEqual({ state: s, abgezogen: false });
  });

  test('ohne Stern nichts abziehen (nie negativ)', () => {
    const s = { stars: 0, gameSecondsLeft: 0 };
    expect(sternZeitEinloesen(s, 'jnr')).toEqual({ state: s, abgezogen: false });
  });

  test('pure: Eingabe bleibt unverändert', () => {
    const s = { stars: 1, gameSecondsLeft: 0 };
    sternZeitEinloesen(s, 'jnr');
    expect(s).toEqual({ stars: 1, gameSecondsLeft: 0 });
  });
});
