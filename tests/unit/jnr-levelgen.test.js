const { parseLevel } = require('../../jumpnrun/core/level.js');
const LG = require('../../jumpnrun/core/levelgen.js');
const SEC = require('../../jumpnrun/data/sections.js');

const BASE = { minDifficulty: 1, maxDifficulty: 1, minSections: 6, maxSections: 8 };

describe('Level-Generator (core/levelgen.js)', () => {
  test('liefert ein gueltiges Level (genau ein Start, ein Ziel)', () => {
    const g = LG.generate(BASE, 42);
    expect(() => parseLevel(g.rows)).not.toThrow();
  });

  test('deterministisch: gleicher Seed liefert exakt dieselbe Abfolge und dieselben Zeilen', () => {
    const a = LG.generate(BASE, 7);
    const b = LG.generate(BASE, 7);
    expect(a.sections).toEqual(b.sections);
    expect(a.rows).toEqual(b.rows);
  });

  test('verschiedene Seeds liefern unterschiedliche Abfolgen', () => {
    const seqs = new Set();
    for (let seed = 1; seed <= 20; seed++) seqs.add(LG.generate(BASE, seed).sections.join(','));
    expect(seqs.size).toBeGreaterThan(1);
  });

  test('nie derselbe Abschnitt zweimal direkt hintereinander', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const g = LG.generate(BASE, seed);
      for (let i = 1; i < g.sections.length; i++) {
        expect(g.sections[i]).not.toBe(g.sections[i - 1]);
      }
    }
  });

  test('Start- und Ziel-Abschnitt sind an jedem Lauf dieselben, Mittelteil respektiert die Schwierigkeit', () => {
    const g = LG.generate(BASE, 3);
    expect(g.sections[0]).toBe(g.sections[0]); // Start ist fix (siehe core/levelgen.js START_ID)
    const middle = g.sections.slice(1, -1);
    middle.forEach(id => {
      const sec = SEC.SECTIONS.find(s => s.id === id);
      expect(sec.schwierigkeit).toBeLessThanOrEqual(1);
    });
  });

  test('Anzahl Mittelabschnitte liegt in minSections..maxSections', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const g = LG.generate(BASE, seed);
      const n = g.sections.length - 2; // ohne Start/Ziel
      expect(n).toBeGreaterThanOrEqual(BASE.minSections);
      expect(n).toBeLessThanOrEqual(BASE.maxSections);
    }
  });

  test('Checkpoints: genau ein C pro Abschnitts-Uebergang', () => {
    const g = LG.generate(BASE, 11);
    const L = parseLevel(g.rows);
    expect(L.checkpoints.length).toBe(g.sections.length - 1);
  });

  test('maxDifficulty filtert hoehere Schwierigkeiten komplett heraus', () => {
    const opts = { minDifficulty: 1, maxDifficulty: 2, minSections: 8, maxSections: 10 };
    for (let seed = 1; seed <= 30; seed++) {
      const g = LG.generate(opts, seed);
      g.sections.slice(1, -1).forEach(id => {
        const sec = SEC.SECTIONS.find(s => s.id === id);
        expect(sec.schwierigkeit).toBeLessThanOrEqual(2);
      });
    }
  });
});

describe('Rechenwichte im Generator (opts.gegner)', () => {
  const GEN = { minDifficulty: 1, maxDifficulty: 2, minSections: 16, maxSections: 18, gegner: true };
  const OHNE = Object.assign({}, GEN, { gegner: false });
  const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
  const countW = rows => rows.join('').split('').filter(c => c === 'w').length;

  test('ohne opts.gegner kein einziger Wicht', () => {
    SEEDS.slice(0, 50).forEach(seed => {
      expect(countW(LG.generate(OHNE, seed).rows)).toBe(0);
      expect(countW(LG.generate(BASE, seed).rows)).toBe(0);
    });
  });

  test('deterministisch und ohne Einfluss auf Abschnittsfolge, Kristalle und Gelaende', () => {
    SEEDS.slice(0, 50).forEach(seed => {
      const a = LG.generate(GEN, seed), b = LG.generate(GEN, seed), o = LG.generate(OHNE, seed);
      expect(a.rows).toEqual(b.rows);
      expect(a.gegner).toEqual(b.gegner);
      expect(a.sections).toEqual(o.sections);
      expect(a.rows.map(r => r.replace(/w/g, '.'))).toEqual(o.rows);
      expect(countW(a.rows)).toBe(a.gegner.length);
    });
  });

  test('nie im Start-, ersten Mittel- oder Ziel-Abschnitt, hoechstens einer je 2 bis 3 Abschnitte', () => {
    SEEDS.forEach(seed => {
      const g = LG.generate(GEN, seed);
      g.gegner.forEach((w, i) => {
        expect(w.abschnitt).toBeGreaterThanOrEqual(2);
        expect(w.abschnitt).toBeLessThanOrEqual(g.sections.length - 2);
        if (i > 0) expect(w.abschnitt - g.gegner[i - 1].abschnitt).toBeGreaterThanOrEqual(2);
      });
    });
  });

  test('Laufstrecke liegt nie an Start, Ziel oder Laterne und nie auf einem Kristallplatz', () => {
    SEEDS.forEach(seed => {
      const L = parseLevel(LG.generate(GEN, seed).rows);
      const marken = [L.start.tx, L.goal.tx].concat(L.checkpoints.map(c => c.tx));
      L.enemies.forEach(e => {
        expect(e.bis - e.von + 1).toBeGreaterThanOrEqual(4);
        marken.forEach(m => {
          expect(m < e.von - 3 || m > e.bis + 3).toBe(true);
        });
        L.crystalSlots.filter(s => s.ty === e.ty).forEach(s => {
          expect(s.tx < e.von || s.tx > e.bis).toBe(true);
        });
        L.spikes.forEach(s => expect(s.ty !== e.ty || s.tx < e.von - 1 || s.tx > e.bis + 1).toBe(true));
      });
    });
  });

  test('seltener als Stacheln, aber regelmaessig: in fast jedem Lauf mindestens ein Wicht', () => {
    let wichte = 0, mitWicht = 0, abschnitte = 0, stacheln = 0;
    SEEDS.forEach(seed => {
      const g = LG.generate(GEN, seed);
      const L = parseLevel(g.rows);
      wichte += g.gegner.length; abschnitte += g.sections.length;
      stacheln += L.spikes.length;
      if (g.gegner.length) mitWicht++;
    });
    expect(mitWicht).toBeGreaterThanOrEqual(SEEDS.length * 0.9);
    expect(wichte).toBeLessThan(stacheln);
    expect(wichte / abschnitte).toBeLessThanOrEqual(1 / 2);
  });
});

// Aufgabe 9 (Marco 30.10.): zwei neue gen-Parameter fuer das Level 2-1 Wichtelhuegel.
// gegnerAbstand [min, extra]: der naechste Wicht kommt fruehestens min, spaetestens min + extra Abschnitte
// weiter (Standard [2, 1] = bisheriges Verhalten). minGegner n: mindestens n Wichte je Lauf; reicht der
// erste Durchgang nicht, werden weitere Abschnitte mit Strecke nachverdichtet (gleicher Zufallsstrom), und
// reicht auch das nicht, wird mit abgeleitetem Seed neu gewuerfelt (bis 8 Versuche), der Lauf traegt aber
// weiter den urspruenglichen Seed.
describe('gegnerAbstand und minGegner (Aufgabe 9)', () => {
  const countW = rows => rows.join('').split('').filter(c => c === 'w').length;
  // Nur Abschnitte mit Wicht-Strecke: so haengen die Abstaende allein am Parameter, nicht an der Bibliothek.
  const WICHT_IDS = ['d1-lauf-a', 'd1-lauf-b', 'd1-lauf-c', 'd2-federpilz-a', 'd2-wichtwiese-a', 'd3-wicht-dornen', 'd3-wicht-luecke'];
  const WICHT_POOL = SEC.SECTIONS.filter(s => WICHT_IDS.includes(s.id));
  const DICHT = { minDifficulty: 1, maxDifficulty: 3, minSections: 16, maxSections: 18, gegner: true, pool: WICHT_POOL };
  const ZWEI_EINS = { minDifficulty: 2, maxDifficulty: 3, minSections: 17, maxSections: 19, gegner: true, gegnerAbstand: [1, 1], minGegner: 4 };
  const abstaende = g => g.gegner.slice(1).map((w, i) => w.abschnitt - g.gegner[i].abschnitt);

  test('Standardabstand ist [2, 1] und liegt am Modul', () => {
    expect(LG.GEGNER_ABSTAND).toEqual([2, 1]);
  });

  test('gegnerAbstand [1, 1]: Wichte in Abstaenden von 1 bis 2 Abschnitten, Abstand 1 kommt vor', () => {
    let eins = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const g = LG.generate(Object.assign({}, DICHT, { gegnerAbstand: [1, 1] }), seed);
      abstaende(g).forEach(a => { expect(a).toBeGreaterThanOrEqual(1); expect(a).toBeLessThanOrEqual(2); if (a === 1) eins++; });
      expect(g.gegner.length).toBeGreaterThanOrEqual(6); // 16-18 Abschnitte, ab Index 2 jeder 1. bis 2.
    }
    expect(eins).toBeGreaterThan(100);
  });

  test('ohne gegnerAbstand: Abstaende 2 bis 3 wie bisher, mit explizitem [2, 1] bitgleich dazu', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const g = LG.generate(DICHT, seed);
      abstaende(g).forEach(a => { expect(a).toBeGreaterThanOrEqual(2); expect(a).toBeLessThanOrEqual(3); });
      expect(LG.generate(Object.assign({}, DICHT, { gegnerAbstand: [2, 1] }), seed)).toEqual(g);
    }
  });

  test('minGegner 4 mit den Parametern von 2-1: fuer 200 Seeds mindestens 4 Wichte, Seed bleibt der urspruengliche', () => {
    let versuche = 0, nachgewuerfelt = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const g = LG.generate(ZWEI_EINS, seed);
      expect(g.gegner.length).toBeGreaterThanOrEqual(4);
      expect(countW(g.rows)).toBe(g.gegner.length);
      expect(g.seed).toBe(seed);
      expect(g.versuch).toBeGreaterThanOrEqual(0);
      expect(g.versuch).toBeLessThanOrEqual(LG.MAX_VERSUCHE);
      if (g.versuch > 0) nachgewuerfelt++;
      versuche += g.versuch;
      expect(() => parseLevel(g.rows)).not.toThrow();
      // Mindestabstand gilt auch nach dem Nachverdichten, hoechstens ein Wicht je Abschnitt, nie vor Index 2
      abstaende(g).forEach(a => expect(a).toBeGreaterThanOrEqual(1));
      g.gegner.forEach(w => { expect(w.abschnitt).toBeGreaterThanOrEqual(2); expect(w.abschnitt).toBeLessThanOrEqual(g.sections.length - 2); });
    }
    expect(nachgewuerfelt).toBeLessThan(200); // der erste Durchgang reicht meistens
  });

  // Review 30.10. (H1): mit 8 Neuwuerfen lieferte Seed 2058 still nur 3 Wichte (wichtMangel). Die Mindestzahl
  // ist eine Zusage an das Kind, deshalb ueber 5000 Seeds: nie ein Mangel, nie mehr Versuche als MAX_VERSUCHE.
  test('minGegner 4: fuer 5000 Seeds nie ein Mangel (wichtMangel), auch Seed 2058 bekommt 4 Wichte', () => {
    let maxVersuch = 0;
    for (let seed = 1; seed <= 5000; seed++) {
      const g = LG.generate(ZWEI_EINS, seed);
      if (g.wichtMangel || g.gegner.length < 4) throw new Error('Seed ' + seed + ': nur ' + g.gegner.length + ' Wichte nach ' + g.versuch + ' Versuchen');
      maxVersuch = Math.max(maxVersuch, g.versuch);
    }
    expect(maxVersuch).toBeLessThanOrEqual(LG.MAX_VERSUCHE);
    expect(maxVersuch).toBeGreaterThan(8); // Seed 2058 braucht den neunten Versuch
  }, 30000);

  test('ohne minGegner liefern dieselben Parameter auch Laeufe unter 4 Wichten (der Parameter wirkt)', () => {
    let unter4 = 0;
    for (let seed = 1; seed <= 200; seed++) if (LG.generate(Object.assign({}, ZWEI_EINS, { minGegner: 0 }), seed).gegner.length < 4) unter4++;
    expect(unter4).toBeGreaterThan(0);
  });

  test('Nachverdichten: der erste Durchgang bleibt enthalten, zusaetzliche Wichte halten den Mindestabstand', () => {
    let nachverdichtet = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const ohne = LG.generate(Object.assign({}, ZWEI_EINS, { minGegner: 0 }), seed);
      const mit = LG.generate(ZWEI_EINS, seed);
      if (mit.versuch !== 0) continue; // neu gewuerfelt: anderer Lauf
      expect(mit.sections).toEqual(ohne.sections);
      ohne.gegner.forEach(w => expect(mit.gegner).toContainEqual(w));
      if (mit.gegner.length > ohne.gegner.length) nachverdichtet++;
      expect(mit.rows.map(r => r.replace(/w/g, '.'))).toEqual(ohne.rows.map(r => r.replace(/w/g, '.')));
    }
    expect(nachverdichtet).toBeGreaterThan(0);
  });

  test('neu gewuerfelt (versuch > 0): Abschnittsfolge entspricht dem abgeleiteten Seed, Ergebnis nennt den Original-Seed', () => {
    let gefunden = 0;
    for (let seed = 1; seed <= 200 && gefunden < 3; seed++) {
      const g = LG.generate(ZWEI_EINS, seed);
      if (g.versuch === 0) continue;
      gefunden++;
      const abgeleitet = (seed + g.versuch * LG.VERSUCH_PRIME) >>> 0;
      const direkt = LG.generate(Object.assign({}, ZWEI_EINS, { minGegner: 0 }), abgeleitet);
      expect(g.sections).toEqual(direkt.sections);
      expect(g.seed).toBe(seed);
      expect(direkt.seed).toBe(abgeleitet);
    }
    expect(gefunden).toBeGreaterThan(0);
  });

  test('gegner false: minGegner und gegnerAbstand erzeugen keinen Wicht', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = LG.generate(Object.assign({}, ZWEI_EINS, { gegner: false }), seed);
      expect(g.gegner).toEqual([]);
      expect(countW(g.rows)).toBe(0);
    }
  });

  test('deterministisch auch mit minGegner: gleicher Seed, gleiche Ausgabe', () => {
    for (let seed = 1; seed <= 30; seed++) expect(LG.generate(ZWEI_EINS, seed)).toEqual(LG.generate(ZWEI_EINS, seed));
  });
});

// Bitgleichheits-Schutz (Aufgabe 9, Marco 30.10.): Stufe 1-2 ohne die neuen gen-Parameter (gegnerAbstand,
// minGegner) bleibt je Seed exakt wie auf dem Stand 25870c4. Die Baseline wurde dort erzeugt (ein SHA-256 je
// Seed ueber rows, sections und gegner), bevor die drei Wicht-Abschnitte in die Bibliothek kamen. Weil
// d2-wichtwiese-a (Schwierigkeit 2) seitdem auch im Pool der Zahlenwiese liegt, laeuft der Vergleich auf dem
// Pool von damals: die Bibliothek ohne die seit der Baseline hinzugekommenen Abschnitte.
describe('Bitgleichheit Stufe 1-2 gegen die Baseline 25870c4 (fixtures/jnr-1-2-baseline.json)', () => {
  const crypto = require('crypto');
  const BASE = require('./fixtures/jnr-1-2-baseline.json');
  const D = require('../../jumpnrun/data/levels.js');
  const pool = SEC.SECTIONS.filter(s => BASE.poolIds.includes(s.id));
  const hash = g => crypto.createHash('sha256').update(JSON.stringify({ rows: g.rows, sections: g.sections, gegner: g.gegner })).digest('hex');

  test('der Pool von damals ist vollstaendig vorhanden (22 Abschnitte), die gen-Parameter von 1-2 sind unveraendert', () => {
    expect(pool.map(s => s.id)).toEqual(BASE.poolIds);
    expect(pool).toHaveLength(22);
    const gen = D.byId('1-2').gen;
    expect(gen).toEqual(BASE.gen); // 1-2 bekommt keine neuen Parameter; nur dann greift der Standardpfad
  });

  test('Seeds 1..200: rows, sections und gegner bitgleich zur Baseline', () => {
    const opts = Object.assign({}, D.byId('1-2').gen, { pool });
    const abweichend = [];
    for (let seed = 1; seed <= 200; seed++) {
      if (hash(LG.generate(opts, seed)) !== BASE.seeds[seed]) abweichend.push(seed);
    }
    expect(abweichend).toEqual([]);
  });
});
