// Jedes Spiel hat seinen eigenen Service Worker im eigenen Scope (ADR-0001, Same-Origin-iframe).
// Fehlt dort eine Datei, die eine Spielseite lädt, ist das Spiel offline kaputt;
// existiert eine gelistete Datei nicht, scheitert cache.addAll und das Update bleibt hängen.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const TRAINER = path.join(ROOT, '1x1-trainer');
const swSrc = fs.readFileSync(path.join(TRAINER, 'sw.js'), 'utf8');

function geladeneDateien(spiel) {
  const html = fs.readFileSync(path.join(ROOT, spiel, 'index.html'), 'utf8');
  const skripte = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
  const schriften = [...html.matchAll(/url\(['"]?([^'")]+\.woff2)['"]?\)/g)].map((m) => m[1]);
  return [...skripte, ...schriften]
    .filter((p) => !/^https?:/.test(p))
    .map((p) => `../${spiel}/${p}`);
}

describe('Trainer-Service-Worker', () => {
  // Reserve-Kopien der Spiele im Trainer-Cache wurden nie im iframe ausgeliefert, konnten
  // aber über ein gemeinsames caches.match veraltete Dateien liefern (Review zu H1).
  // Erlaubt sind nur Dateien ausserhalb von 1x1-trainer/, die die Trainer-Seite SELBST lädt
  // (knobel-logic.js, rewards.js): die holt der Trainer-SW, nicht der Spiel-SW.
  test('cacht von ausserhalb genau die Skripte, die die Trainer-Seite selbst lädt', () => {
    const block = swSrc.match(/const ASSETS\s*=\s*\[([\s\S]*?)\]/)[1];
    const fremd = [...block.matchAll(/['"](\.\.\/[^'"]+)['"]/g)].map((m) => m[1]).sort();
    const html = fs.readFileSync(path.join(TRAINER, 'index.html'), 'utf8');
    const eigeneSeite = [...html.matchAll(/<script[^>]*\ssrc="(\.\.\/[^"]+)"/g)].map((m) => m[1]).sort();
    expect(eigeneSeite.length).toBeGreaterThan(0);
    expect(fremd).toEqual(eigeneSeite);
  });

  test('keine Spielseiten (index.html) und keine Lumo-Level-/Knobel-Assets im Trainer-Cache', () => {
    const block = swSrc.match(/const ASSETS\s*=\s*\[([\s\S]*?)\]/)[1];
    expect(block).not.toMatch(/\.\.\/(knobel|jumpnrun)\/index\.html/);
    expect(block).not.toMatch(/\.\.\/(knobel|jumpnrun)\/(fonts|data)\//);
  });

  test('jede gelistete Datei existiert', () => {
    const block = swSrc.match(/const ASSETS\s*=\s*\[([\s\S]*?)\]/)[1];
    const liste = [...block.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(liste.filter((p) => p !== './' && !fs.existsSync(path.join(TRAINER, p)))).toEqual([]);
  });
});

// Jedes eingebettete Spiel hat seinen eigenen Service Worker im eigenen Scope. Nur der
// liefert die Dateien im iframe offline aus (QA-Befund M1: Lumo offline ohne Skripte).
describe.each(['knobel', 'jumpnrun'])('Eigener Service Worker von %s', (spiel) => {
  const DIR = path.join(ROOT, spiel);
  const swPfad = path.join(DIR, 'sw.js');
  const eigeneListe = () => {
    const src = fs.readFileSync(swPfad, 'utf8');
    const block = src.match(/const ASSETS\s*=\s*\[([\s\S]*?)\]/);
    return block ? [...block[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]) : [];
  };

  test('sw.js existiert', () => {
    expect(fs.existsSync(swPfad)).toBe(true);
  });

  test('jede gelistete Datei existiert', () => {
    const fehlend = eigeneListe().filter((p) => p !== './' && !fs.existsSync(path.join(DIR, p)));
    expect(fehlend).toEqual([]);
  });

  test('Seite, alle Skripte und Schriften sind gelistet', () => {
    const liste = eigeneListe();
    const noetig = ['./', './index.html', ...geladeneDateien(spiel).map((p) => './' + p.slice(`../${spiel}/`.length))];
    expect(noetig.filter((p) => !liste.includes(p))).toEqual([]);
  });

  test('index.html registriert ./sw.js', () => {
    const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
    expect(html).toMatch(/serviceWorker\.register\(\s*['"]\.\/sw\.js['"]/);
  });
});

test('Trainer registriert die Service Worker der eingebetteten Spiele mit', () => {
  const html = fs.readFileSync(path.join(TRAINER, 'index.html'), 'utf8');
  expect(html).toMatch(/\.\.\/knobel\/sw\.js/);
  expect(html).toMatch(/\.\.\/jumpnrun\/sw\.js/);
});
