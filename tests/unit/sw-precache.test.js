// Der Trainer-Service-Worker cacht auch die eingebetteten Spiele (ADR-0001).
// Fehlt dort eine Datei, die eine Spielseite lädt, ist das Spiel offline kaputt;
// existiert eine gelistete Datei nicht, scheitert cache.addAll und das Update bleibt hängen.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const TRAINER = path.join(ROOT, '1x1-trainer');
const swSrc = fs.readFileSync(path.join(TRAINER, 'sw.js'), 'utf8');
const gelistet = [...swSrc.matchAll(/['"](\.\.\/[^'"]+)['"]/g)].map((m) => m[1]);

function geladeneDateien(spiel) {
  const html = fs.readFileSync(path.join(ROOT, spiel, 'index.html'), 'utf8');
  const skripte = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
  const schriften = [...html.matchAll(/url\(['"]?([^'")]+\.woff2)['"]?\)/g)].map((m) => m[1]);
  return [...skripte, ...schriften]
    .filter((p) => !/^https?:/.test(p))
    .map((p) => `../${spiel}/${p}`);
}

describe('Trainer-Service-Worker: Precache-Liste der eingebetteten Spiele', () => {
  test('jede gelistete Datei existiert', () => {
    const fehlend = gelistet.filter((p) => !fs.existsSync(path.join(TRAINER, p)));
    expect(fehlend).toEqual([]);
  });

  test.each(['knobel', 'jumpnrun'])('alle Skripte und Schriften von %s sind gelistet', (spiel) => {
    const fehlend = geladeneDateien(spiel).filter((p) => !gelistet.includes(p));
    expect(fehlend).toEqual([]);
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
