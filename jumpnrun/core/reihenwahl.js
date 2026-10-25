// Lumo - Reihenwahl vor jeder Mathe-Stufe: welche Reihen waehlbar sind, welche empfohlen werden
// (aus dem Lernstand des Trainers, siehe jnr:init.lernstand in core/host.js), welche vorgewaehlt
// ist, Tastatur-Navigation im 3er-Raster und die kurzen Texte fuer Ziel-Chip und Hilfe.
// Reine Funktionen.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.JNR = root.JNR || {}; root.JNR.reihenwahl = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var MIN = 2, MAX = 10, SPALTEN = 3, MAX_EMPFEHLUNGEN = 2;
  var REIHEN = [];
  for (var r = MIN; r <= MAX; r++) REIHEN.push(r);

  function istReihe(n) { return typeof n === 'number' && Number.isInteger(n) && n >= MIN && n <= MAX; }

  // Bis zu 2 geuebte, noch nicht gemeisterte Reihen (Wert < 1), schwaechste zuerst,
  // bei Gleichstand die kleinere Reihe. Ohne Lernstand: keine Empfehlung.
  function empfehlungen(lernstand) {
    if (!lernstand || typeof lernstand !== 'object') return [];
    var liste = [];
    REIHEN.forEach(function (reihe) {
      var v = lernstand[reihe];
      if (typeof v === 'number' && isFinite(v) && v >= 0 && v < 1) liste.push({ reihe: reihe, v: v });
    });
    liste.sort(function (a, b) { return a.v - b.v || a.reihe - b.reihe; });
    return liste.slice(0, MAX_EMPFEHLUNGEN).map(function (e) { return e.reihe; });
  }

  // Vorauswahl: schwaechste Empfehlung, sonst die letzte Wahl, sonst die Reihe der Stufe, sonst 2.
  function vorauswahl(lernstand, letzte, stufenReihe) {
    var emp = empfehlungen(lernstand);
    if (emp.length) return emp[0];
    if (istReihe(letzte)) return letzte;
    if (istReihe(stufenReihe)) return stufenReihe;
    return MIN;
  }

  // Raster: 2 3 4 / 5 6 7 / 8 9 10. Am Rand bleibt die Auswahl stehen.
  function naechsteReihe(aktuell, richtung) {
    var i = aktuell - MIN, zeile = Math.floor(i / SPALTEN);
    var zeilen = Math.ceil(REIHEN.length / SPALTEN);
    if (richtung === 'links' && i > 0) i--;
    else if (richtung === 'rechts' && i < REIHEN.length - 1) i++;
    else if (richtung === 'hoch' && zeile > 0) i -= SPALTEN;
    else if (richtung === 'runter' && zeile < zeilen - 1 && i + SPALTEN < REIHEN.length) i += SPALTEN;
    return MIN + i;
  }

  function beispiel(reihe) { return [reihe, reihe * 2, reihe * 3].join(', '); }
  function chipReihe(reihe) { return reihe + 'er-Reihe'; }
  function zaehler(gesammelt, gesamt) { return gesammelt + ' / ' + gesamt; }

  return {
    REIHEN: REIHEN, SPALTEN: SPALTEN, istReihe: istReihe, empfehlungen: empfehlungen, vorauswahl: vorauswahl,
    naechsteReihe: naechsteReihe, beispiel: beispiel, chipReihe: chipReihe, zaehler: zaehler
  };
});
