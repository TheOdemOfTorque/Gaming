// Lumo - Integrations-Vertrag zum 1x1-Trainer (iframe + postMessage). Reine Funktionen.
//
// VERTRAG (Same-Origin-iframe; der Trainer bleibt einziger Schreiber von `henry_einmaleins`):
//
//   Spiel -> Trainer, nur wenn window.parent !== window, immer mit targetOrigin = location.origin:
//     parent.postMessage({ type: 'jnr:result', level, medaillen, funken, xp }, location.origin)
//       level      "1-2"  Level-ID (Welt-Nummer)
//       medaillen  0..3   Anzahl in diesem Lauf (0, wenn das Ziel nicht erreicht wurde)
//       funken     >= 0   Funkenstand am Levelende (Spielwährung, nur Kosmetik)
//       xp         >= 0   XP-Vorschlag: nur beim ersten Abschluss des Levels > 0 (Trainer rechnet gut)
//
//   Trainer -> Spiel (Spiel prüft event.origin === location.origin und event.source === parent):
//     { type: 'jnr:init', level?, jnr?, options? }
//        level   optional: "1-2" startet direkt dieses Level (sonst Levelauswahl)
//        jnr     optional: Fortschritt { levels: { "1-1": { medals, bestTimeMs, bestFunken } },
//                xpAwarded: { "1-1": true }, funkenTotal, lastLevel }
//        options optional: { steuerung: 'standard'|'einfach', mathe: 'ziel'|'aus', farbhilfe, musik }
//     { type: 'jnr:pause' }   pausiert das Spiel (App-Wechsel, Dialog über dem Spiel)
//     { type: 'jnr:timeup' }  Stern-Zeit abgelaufen: Spiel stoppt sauber (Loop aus, Ton aus, Hinweis),
//                             bleibt in mode 'ended' haengen, bis ein erneutes jnr:init kommt (Reset-Pfad,
//                             z.B. nach Einloesen eines neuen Sterns); ein jnr:init aus mode 'won' wirkt genauso
//
//   Im eingebetteten Modus schreibt das Spiel NICHT in localStorage. Standalone speichert es unter
//   `henry_jnr` (siehe rewards.js, Form wie state.jnr in der Spec).
(function (root, factory) {
  var deps = (typeof module === 'object' && module.exports)
    ? { rewards: require('./rewards.js') } : { rewards: root.JNR.rewards };
  var api = factory(deps.rewards);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.JNR = root.JNR || {}; root.JNR.host = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (R) {
  function buildResultMessage(r) {
    return { type: 'jnr:result', level: r.level, medaillen: r.medaillen, funken: r.funken, xp: r.xp };
  }

  function parseHostMessage(data) {
    if (!data || typeof data !== 'object' || typeof data.type !== 'string') return null;
    if (data.type === 'jnr:pause') return { kind: 'pause' };
    if (data.type === 'jnr:timeup') return { kind: 'timeup' };
    if (data.type === 'jnr:init') {
      var merged = Object.assign({}, data.jnr && typeof data.jnr === 'object' ? data.jnr : {});
      if (data.options && typeof data.options === 'object') merged.options = data.options;
      return {
        kind: 'init',
        level: typeof data.level === 'string' && /^\d+-\d+$/.test(data.level) ? data.level : null,
        jnr: R.sanitizeJnr(merged)
      };
    }
    return null;
  }

  function isTrustedMessage(event, ownOrigin, parentWindow) {
    return !!event && event.origin === ownOrigin && event.source === parentWindow;
  }

  function isEmbedded(win) { return win.parent !== win; }

  return { buildResultMessage: buildResultMessage, parseHostMessage: parseHostMessage, isTrustedMessage: isTrustedMessage, isEmbedded: isEmbedded };
});
