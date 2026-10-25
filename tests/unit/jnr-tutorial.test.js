// Mitmach-Tutorial von Lumo (jumpnrun/core/tutorial.js): festes Uebungslevel, Schrittlogik,
// Texte je Geraet, Grenze, die das Kind erst nach der Aktion weiterlaesst.
const TU = require('../../jumpnrun/core/tutorial.js');
const { parseLevel } = require('../../jumpnrun/core/level.js');
const G = require('../../jumpnrun/core/game.js');
const P = require('../../jumpnrun/core/physics.js');
const M = require('../../jumpnrun/core/mathgen.js');

const T = 16;
const RIGHT = { left: false, right: true, jump: false };
const NONE = { left: false, right: false, jump: false };

function neu(reihe = 2) {
  const level = parseLevel(TU.LEVEL);
  const game = G.createGame(level, TU.gameOptions(reihe));
  const tut = TU.create();
  return { level, game, tut };
}
// Ein Schritt wie im Browser: erst die Simulation, dann das Tutorial
function schritt(s, input) { G.tick(s.game, input); return TU.tick(s.tut, s.game); }
function bis(s, input, pred, max = 900) {
  for (let i = 0; i < max; i++) { schritt(s, typeof input === 'function' ? input(i) : input); if (pred(s)) return true; }
  return false;
}
function setze(s, tx) { const p = s.game.player; p.x = tx * T + 3; p.vx = 0; p.vy = 0; }

describe('Übungslevel', () => {
  test('ist ein gültiges Level mit Start, Lücke, Laterne, einem Rechenwicht und Ziel', () => {
    const L = parseLevel(TU.LEVEL);
    expect(L.h).toBe(9);
    expect(L.checkpoints).toHaveLength(1);
    expect(L.enemies).toHaveLength(1);
    expect(L.start.tx).toBeLessThan(TU.LUECKE.von);
    // Lücke: kein Boden in den Lücken-Spalten
    for (let x = TU.LUECKE.von; x <= TU.LUECKE.bis; x++) expect(L.solid[(L.h - 2) * L.w + x]).toBe(0);
    expect(L.goal.tx).toBeGreaterThan(L.enemies[0].bis);
  });

  test('zwei feste Kristalle: zuerst die richtige Zahl der Reihe, dann eine falsche', () => {
    [2, 7, 10].forEach((r) => {
      const k = TU.kristalle(r);
      expect(k).toHaveLength(2);
      expect(k[0]).toMatchObject({ good: true });
      expect(k[1]).toMatchObject({ good: false });
      expect(k[0].tx).toBeLessThan(k[1].tx);
      expect(M.isMultiple(k[0].value, r)).toBe(true);
      expect(M.isMultiple(k[1].value, r)).toBe(false);
    });
  });

  test('Spieloptionen: Zahlen-Modus mit der Reihe, Übungsmodus an, fester Seed', () => {
    const o = TU.gameOptions(7);
    expect(o).toMatchObject({ mode: 'ziel', reihe: 7, uebung: true, seed: TU.SEED });
    expect(o.crystals).toEqual(TU.kristalle(7));
    expect(TU.gameOptions(99).reihe).toBe(2); // ungültige Reihe: Standard 2er-Reihe
  });
});

describe('Schritte', () => {
  test('Reihenfolge: laufen, springen, zahlen, wicht, ziel', () => {
    expect(TU.SCHRITTE).toEqual(['laufen', 'springen', 'zahlen', 'wicht', 'ziel']);
    const t = TU.create();
    expect(TU.schritt(t)).toBe('laufen');
    expect(TU.fortschritt(t)).toBe('Schritt 1 von 5');
    expect(t.fertig).toBe(false);
  });

  test('Stehen bleiben bringt nichts: der Schritt wartet auf die Aktion', () => {
    const s = neu();
    for (let i = 0; i < 300; i++) schritt(s, NONE);
    expect(TU.schritt(s.tut)).toBe('laufen');
  });

  test('laufen ist geschafft, sobald Lumo ein Stück nach rechts gelaufen ist; tick meldet die Änderung', () => {
    const s = neu();
    let geaendert = false;
    bis(s, RIGHT, () => { return TU.schritt(s.tut) !== 'laufen'; });
    expect(TU.schritt(s.tut)).toBe('springen');
    expect(s.tut.lob).toBe(true);
    // tick liefert true genau beim Wechsel
    const s2 = neu();
    for (let i = 0; i < 300 && !geaendert; i++) { G.tick(s2.game, RIGHT); geaendert = TU.tick(s2.tut, s2.game); }
    expect(geaendert).toBe(true);
    expect(TU.tick(s2.tut, s2.game)).toBe(false);
  });

  test('Sturz in die Lücke: kein Leben weg, zurück zum Start, Hinweis schlucht, Schritt bleibt', () => {
    const s = neu();
    const ok = bis(s, RIGHT, () => s.tut.hinweis === 'schlucht');
    expect(ok).toBe(true);
    expect(s.game.leben).toBe(G.LEBEN);
    expect(TU.schritt(s.tut)).toBe('springen');
    expect(s.game.player.x).toBe(s.level.start.x);
  });

  test('springen ist geschafft, wenn Lumo hinter der Lücke auf dem Boden steht', () => {
    const s = neu();
    // Lumo an die Kante stellen, dann mit Sprung rüber
    bis(s, RIGHT, () => TU.schritt(s.tut) === 'springen');
    const ok = bis(s, (i) => ({ left: false, right: true, jump: s.game.player.x > (TU.LUECKE.von - 1) * T }),
      () => TU.schritt(s.tut) === 'zahlen');
    expect(ok).toBe(true);
    expect(s.game.player.onGround).toBe(true);
  });

  function biszuZahlen() {
    const s = neu();
    bis(s, (i) => ({ left: false, right: true, jump: s.game.player.x > (TU.LUECKE.von - 1) * T && s.game.player.x < TU.LUECKE.bis * T }),
      () => TU.schritt(s.tut) === 'zahlen');
    return s;
  }

  test('zahlen: falsche Zahl berühren kostet einen Lichtpunkt (Hinweis autsch), kein Leben', () => {
    const s = biszuZahlen();
    const k = TU.kristalle(2);
    setze(s, k[1].tx - 1);
    bis(s, RIGHT, () => s.tut.hinweis === 'autsch', 120);
    expect(s.tut.hinweis).toBe('autsch');
    expect(s.game.energie).toBe(G.ENERGIE - 1);
    expect(s.game.leben).toBe(G.LEBEN);
  });

  test('zahlen: ohne die richtige Zahl hält die Grenze Lumo vor dem Wicht auf (Hinweis grenze)', () => {
    const s = biszuZahlen();
    const k = TU.kristalle(2);
    setze(s, k[1].tx + 1); // hinter beiden Kristallen, die richtige nicht gesammelt
    for (let i = 0; i < 240; i++) schritt(s, RIGHT);
    expect(s.game.player.x + P.W).toBeLessThanOrEqual(TU.grenzeX(s.tut));
    expect(s.tut.hinweis).toBe('grenze');
    expect(TU.schritt(s.tut)).toBe('zahlen');
  });

  test('zahlen ist geschafft mit der richtigen Zahl und hinter der falschen', () => {
    const s = biszuZahlen();
    const k = TU.kristalle(2);
    // richtige Zahl einsammeln, dann über die falsche springen
    const ok = bis(s, () => ({ left: false, right: true, jump: s.game.player.x > (k[1].tx - 1) * T - 4 && s.game.player.x < k[1].tx * T }),
      () => TU.schritt(s.tut) === 'wicht', 600);
    expect(ok).toBe(true);
    expect(s.game.richtig).toBe(1);
    expect(s.game.energie).toBe(G.ENERGIE); // Schrittwechsel füllt die Energie wieder auf
  });

  function biszuWicht() {
    const s = biszuZahlen();
    s.game.crystals.forEach((c) => { if (c.good) { c.state = 'weg'; s.game.richtig = 1; } else c.state = 'kaputt'; });
    setze(s, TU.kristalle(2)[1].tx + 1);
    bis(s, NONE, () => TU.schritt(s.tut) === 'wicht', 5);
    return s;
  }

  test('wicht: von der Seite gibt den Hinweis seite, die Grenze vor dem Ziel hält bis zum Draufspringen', () => {
    const s = biszuWicht();
    expect(TU.schritt(s.tut)).toBe('wicht');
    const e = s.game.enemies[0];
    const p = s.game.player;
    p.x = e.x - 8; p.y = e.y + 4; p.vx = 0; p.vy = 0;
    bis(s, NONE, () => s.tut.hinweis === 'seite', 30);
    expect(s.tut.hinweis).toBe('seite');
    // drüber hinaus bis zum Ziel laufen geht nicht
    setze(s, s.level.goal.tx - 3);
    for (let i = 0; i < 200; i++) schritt(s, RIGHT);
    expect(s.game.status).toBe('play');
    expect(TU.schritt(s.tut)).toBe('wicht');
    expect(s.tut.hinweis).toBe('grenze');
  });

  test('wicht ist geschafft nach dem Draufspringen; Lob nennt die richtige Rechnung', () => {
    const s = biszuWicht();
    const e = s.game.enemies[0];
    const p = s.game.player;
    p.x = e.x + 1; p.y = e.y - 16; p.vx = 0; p.vy = 0; p.onGround = false;
    bis(s, NONE, () => TU.schritt(s.tut) === 'ziel', 60);
    expect(TU.schritt(s.tut)).toBe('ziel');
    expect(s.tut.rechnung).toBe(M.rechnungText(e.rechnung, true));
    expect(TU.text(s.tut, { geraet: 'tasten', reihe: 2 })).toContain(s.tut.rechnung);
    expect(TU.grenzeX(s.tut)).toBe(Infinity);
  });

  test('ziel: Leuchtturm erreicht beendet das Tutorial', () => {
    const s = biszuWicht();
    s.tut.index = TU.SCHRITTE.indexOf('ziel');
    setze(s, s.level.goal.tx - 2);
    bis(s, RIGHT, () => s.tut.fertig, 200);
    expect(s.tut.fertig).toBe(true);
    expect(s.game.status).toBe('won');
    expect(TU.text(s.tut, { geraet: 'touch', reihe: 2 })).toMatch(/Geschafft/);
  });
});

describe('Texte', () => {
  const amSchritt = (id, extra) => Object.assign(TU.create(), { index: TU.SCHRITTE.indexOf(id) }, extra);

  test('laufen: Touch nennt den Knopf ▶, Tastatur die Pfeiltaste, einfache Steuerung den Halt-Knopf', () => {
    const t = amSchritt('laufen');
    expect(TU.text(t, { geraet: 'touch', reihe: 2 })).toContain('▶');
    expect(TU.text(t, { geraet: 'tasten', reihe: 2 })).toMatch(/Pfeiltaste/);
    expect(TU.text(t, { geraet: 'touch', einfach: true, reihe: 2 })).toMatch(/von selbst/);
    expect(TU.text(t, { geraet: 'touch', einfach: true, reihe: 2 })).toMatch(/Halt/);
  });

  test('springen: Touch nennt ▲, Tastatur die Leertaste', () => {
    const t = amSchritt('springen');
    expect(TU.text(t, { geraet: 'touch', reihe: 2 })).toContain('▲');
    expect(TU.text(t, { geraet: 'tasten', reihe: 2 })).toMatch(/Leertaste/);
  });

  test('zahlen nennt die Reihe und beide Zahlen', () => {
    const t = amSchritt('zahlen');
    const k = TU.kristalle(7);
    const txt = TU.text(t, { geraet: 'tasten', reihe: 7 });
    expect(txt).toContain('7er-Reihe');
    expect(txt).toContain(String(k[0].value));
    expect(txt).toContain(String(k[1].value));
  });

  test('wicht erklärt das Draufspringen, ziel den Leuchtturm', () => {
    expect(TU.text(amSchritt('wicht'), { geraet: 'touch', reihe: 2 })).toMatch(/von oben/);
    expect(TU.text(amSchritt('ziel'), { geraet: 'touch', reihe: 2 })).toMatch(/Leuchtturm/);
  });

  test('Hinweise stehen vor dem Schritt-Text, Lob beginnt mit Super', () => {
    expect(TU.text(amSchritt('springen', { hinweis: 'schlucht' }), { geraet: 'touch', reihe: 2 })).toMatch(/^Hoppla.*Leben/);
    expect(TU.text(amSchritt('zahlen', { hinweis: 'autsch' }), { geraet: 'touch', reihe: 2 })).toMatch(/^Autsch.*Lichtpunkt/);
    expect(TU.text(amSchritt('wicht', { hinweis: 'seite' }), { geraet: 'touch', reihe: 2 })).toMatch(/von oben/);
    expect(TU.text(amSchritt('zahlen', { hinweis: 'grenze' }), { geraet: 'touch', reihe: 2 })).toContain(String(TU.kristalle(2)[0].value));
    expect(TU.text(amSchritt('springen', { lob: true }), { geraet: 'touch', reihe: 2 })).toMatch(/^Super!/);
  });

  test('ohne gültige Reihe gilt die 2er-Reihe', () => {
    expect(TU.text(amSchritt('zahlen'), { geraet: 'touch' })).toContain('2er-Reihe');
  });
});

describe('Automatischer Start', () => {
  test('nur, solange es weder im Fortschritt noch in dieser Sitzung als gesehen gilt', () => {
    expect(TU.sollAutomatischStarten({ tutorialGesehen: false }, false)).toBe(true);
    expect(TU.sollAutomatischStarten({ tutorialGesehen: true }, false)).toBe(false);
    expect(TU.sollAutomatischStarten({ tutorialGesehen: false }, true)).toBe(false);
    expect(TU.sollAutomatischStarten(null, false)).toBe(true);
  });
});

describe('Zeiger auf das Ziel des Schritts', () => {
  test('springen zeigt auf die Lücke, zahlen auf die richtige Zahl, wicht auf den Wicht, ziel auf den Leuchtturm', () => {
    const s = neu(2);
    expect(TU.zeiger(s.tut, s.game)).toBeNull(); // laufen: kein Zeiger
    s.tut.index = 1;
    expect(TU.zeiger(s.tut, s.game).x).toBe(((TU.LUECKE.von + TU.LUECKE.bis + 1) / 2) * T);
    s.tut.index = 2;
    const k = TU.kristalle(2)[0];
    expect(TU.zeiger(s.tut, s.game)).toEqual({ x: k.tx * T + 8, y: k.ty * T - 2 });
    s.game.crystals[0].state = 'weg';
    expect(TU.zeiger(s.tut, s.game)).toBeNull(); // eingesammelt: weiter nach rechts, kein Zeiger
    s.tut.index = 3;
    const e = s.game.enemies[0];
    expect(TU.zeiger(s.tut, s.game).x).toBe(e.x + 6);
    expect(TU.zeiger(s.tut, s.game).y).toBeLessThan(e.y);
    s.tut.index = 4;
    expect(TU.zeiger(s.tut, s.game).x).toBe(s.level.goal.tx * T + 8);
  });
});
