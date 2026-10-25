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
