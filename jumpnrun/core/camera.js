// Lumo - Kamera (reine Funktion, kein DOM-Zugriff).
//
// Look-ahead-Kamera: die Figur bleibt horizontal immer bei derselben relativen
// Bildschirmposition (abhaengig von der Laufrichtung), unabhaengig davon, wo im
// Level sie steht. Deshalb bewusst KEIN Clamp auf [0, levelBreite - VW]: ein
// Rand-Clamp zieht die Kamera am Levelanfang/-ende auf den Weltrand, die Figur
// rutscht dann unter die Touch-Buttons (links ◀▶, rechts Sprung). Die Kamera darf
// stattdessen vor x=0 bzw. hinter dem Weltende "Luft" zeigen (der Himmel-Hintergrund
// ist darauf ausgelegt, siehe drawBackground/drawTiles in index.html).
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.JNR = root.JNR || {}; root.JNR.camera = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var LOOKAHEAD = 26;

  // Ziel-Kamera (linke Kante des sichtbaren Ausschnitts) fuer eine Figur bei playerX
  // (Hitbox-Breite playerW), die nach `facing` (-1/1) schaut, auf einem VW logische
  // Pixel breiten Bildschirm. Unclamped.
  function computeCameraTarget(playerX, playerW, facing, VW) {
    var centerX = playerX + playerW / 2;
    return centerX + facing * LOOKAHEAD - VW / 2;
  }

  return { LOOKAHEAD: LOOKAHEAD, computeCameraTarget: computeCameraTarget };
});
