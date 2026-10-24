const { computeLayout, VW_MIN, VH } = require('../../jumpnrun/core/viewport.js');

describe('jnr-viewport computeLayout', () => {
  test('iPhone 13 quer (844x390, dpr 3) füllt die Breite, Höhe bleibt 144px-Basis', () => {
    const l = computeLayout(844, 390, 3);
    expect(l.k).toBe(8);
    expect(l.VW).toBe(317);
    expect(l.VH).toBe(144);
    expect(l.ch).toBeLessThanOrEqual(390);
    expect(390 - l.ch).toBeLessThan(VH / 3);
    expect(l.cw).toBeGreaterThanOrEqual(844);
    expect(l.cw).toBeLessThan(844 + 5);
  });

  test('iPhone SE quer (667x375, dpr 2)', () => {
    const l = computeLayout(667, 375, 2);
    expect(l.k).toBe(5);
    expect(l.VW).toBe(267);
  });

  test('Desktop 16:9 (1280x720, dpr 1) braucht keine Verbreiterung', () => {
    const l = computeLayout(1280, 720, 1);
    expect(l.k).toBe(5);
    expect(l.VW).toBe(VW_MIN);
    expect(l.cw).toBe(1280);
    expect(l.ch).toBe(720);
  });

  test('Hochformat (390x844, dpr 3) bleibt mindestens 256px breit und wird nicht schmaler', () => {
    const l = computeLayout(390, 844, 3);
    expect(l.VW).toBeGreaterThanOrEqual(VW_MIN);
  });

  test('Querformat: Canvas ist senkrecht am unteren Rand verankert (kein Leerraum unter dem Boden)', () => {
    const l = computeLayout(844, 390, 3);
    expect(l.top).toBe(390 - l.ch);
  });

  test('Hochformat: Canvas bleibt senkrecht zentriert, nicht am unteren Rand (sonst liegen die Buttons auf Lumo)', () => {
    const l = computeLayout(390, 844, 3);
    expect(l.top).toBe((844 - l.ch) / 2);
  });

  test('Desktop 16:9: kein Leerraum, Verankerung ist irrelevant', () => {
    const l = computeLayout(1280, 720, 1);
    expect(l.top).toBe(0);
  });

  test('sehr kleine Fenster erzeugen mindestens Skalierung 1', () => {
    const l = computeLayout(100, 50, 1);
    expect(l.k).toBeGreaterThanOrEqual(1);
  });
});
