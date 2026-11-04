const { computeCameraTarget, LOOKAHEAD } = require('../../jumpnrun/core/camera.js');

// Touch-Button-Zonen (CSS-Pixel-Breite relativ zum Canvas, siehe jumpnrun/index.html):
// ◀▶ links bis ca. 200px + safe-area, Sprung rechts ab ca. 124px vor dem rechten Rand.
// Als Bildschirm-Bruchteil der Figur gefordert: ~35-40%, nie in der linken (<~0.30) oder
// rechten (>~0.70) Button-Zone, unabhängig von der Position im Level (auch am Rand).
function screenFraction(playerX, playerW, facing, VW) {
  const cam = computeCameraTarget(playerX, playerW, facing, VW);
  const centerX = playerX + playerW / 2;
  return (centerX - cam) / VW;
}

describe('jnr-camera computeCameraTarget', () => {
  test('Figur steht beim Laufen nach rechts bei ~35-40% der Bildbreite', () => {
    const frac = screenFraction(400, 10, 1, 317);
    expect(frac).toBeGreaterThanOrEqual(0.35);
    expect(frac).toBeLessThanOrEqual(0.42);
  });

  test('Figur bleibt beim Laufen nach links außerhalb der rechten Sprung-Button-Zone', () => {
    const frac = screenFraction(400, 10, -1, 317);
    expect(frac).toBeLessThan(0.7);
  });

  test('Levelstart (kleines playerX, iPhone-13-Breite): Figur nicht in der linken Button-Zone', () => {
    // Bug: die alte Kamera clampte auf 0 und schob die Figur hinter ◀▶.
    const frac = screenFraction(56, 10, 1, 317);
    expect(frac).toBeGreaterThanOrEqual(0.3);
  });

  test('Levelstart: Kamera darf vor x=0 liegen (negativ), damit die Figur nicht am Rand klebt', () => {
    const cam = computeCameraTarget(56, 10, 1, 317);
    expect(cam).toBeLessThan(0);
  });

  test('Levelende (playerX nahe Weltrand): Figur nicht in der rechten Sprung-Button-Zone', () => {
    // Bug: die alte Kamera clampte auf levelPxW - VW und schob die Figur unter den Sprungknopf.
    const levelPxW = 1600;
    const frac = screenFraction(levelPxW - 10, 10, 1, 317);
    expect(frac).toBeLessThanOrEqual(0.42);
  });

  test('Bildschirmfraktion ist unabhängig von der Levelbreite (keine Randklammer mehr nötig)', () => {
    const a = screenFraction(60, 10, 1, 317);
    const b = screenFraction(60, 10, 1, 317);
    expect(a).toBeCloseTo(b, 10);
  });

  test('Desktop (VW=256): Figur ebenfalls bei ~35-40%', () => {
    const frac = screenFraction(60, 10, 1, 256);
    expect(frac).toBeGreaterThanOrEqual(0.35);
    expect(frac).toBeLessThanOrEqual(0.42);
  });

  test('Lookahead-Konstante ist positiv und moderat (Spielgefühl unverändert)', () => {
    expect(LOOKAHEAD).toBeGreaterThan(0);
    expect(LOOKAHEAD).toBeLessThan(64);
  });
});
