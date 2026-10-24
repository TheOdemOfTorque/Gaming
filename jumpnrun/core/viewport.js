// Lumo - Bildschirm-Layout (reine Funktion, kein DOM-Zugriff).
//
// Die sichtbare Welt ist logisch 144 px hoch (VH, 9 Kacheln a 16 px), ganzzahlig
// pixelgenau skaliert. Die Breite (VW) ist nicht auf 256 px fixiert, sondern wird je
// nach Bildschirmbreite so gewaehlt, dass die Welt den sichtbaren Bereich ausfuellt
// (nie schmaler als die urspruengliche 256-px-Basisbreite).
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.JNR = root.JNR || {}; root.JNR.viewport = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var VH = 144, VW_MIN = 256;

  function computeLayout(W, H, dpr) {
    dpr = dpr || 1;
    var k = Math.max(1, Math.floor(Math.min(H * dpr / VH, W * dpr / VW_MIN)));
    var VW = Math.max(VW_MIN, Math.ceil(W * dpr / k));
    var cw = VW * k / dpr, ch = VH * k / dpr;
    // Ist die Hoehe der begrenzende Faktor (typisch Querformat), bleibt kaum Resthoehe
    // (< VH/dpr): die Welt wird am unteren Rand verankert, der Boden sitzt am Bildschirmrand.
    // Ist die Breite der begrenzende Faktor (typisch Hochformat), ist die Resthoehe gross;
    // dort zentrieren, sonst liegt die Touch-Steuerung ganz unten auf der sichtbaren Welt.
    var slack = H - ch, top = slack < ch ? slack : slack / 2;
    return { k: k, VW: VW, VH: VH, cw: cw, ch: ch, left: (W - cw) / 2, top: top };
  }

  return { VH: VH, VW_MIN: VW_MIN, computeLayout: computeLayout };
});
