// Lumo - Integrations-Vertrag zum 1x1-Trainer (iframe + postMessage). Reine Funktionen.
//
// VERTRAG (Same-Origin-iframe; der Trainer bleibt einziger Schreiber von `henry_einmaleins`):
//
//   Spiel -> Trainer, nur wenn window.parent !== window, immer mit targetOrigin = location.origin,
//   und nur fuer geschaffte Laeufe (rewards.shouldReport; ein verlorener Lauf ohne Leben sendet nichts):
//     parent.postMessage({ type: 'jnr:result', level, medaillen, funken, xp }, location.origin)
//       level      "1-2"  Level-ID (Welt-Nummer)
//       medaillen  0..3   Anzahl in diesem Lauf (0, wenn das Ziel nicht erreicht wurde)
//       funken     >= 0   Funkenstand am Levelende (Spielwährung, nur Kosmetik)
//       xp         0      immer 0: Lumo gibt keine XP (Marco 30.10.2026). Das Feld bleibt, damit ein alter
//                         Trainer nicht bricht; der neue Trainer ignoriert es (applyJnrResult).
//
//   Spiel -> Trainer, sobald das Mitmach-Tutorial (core/tutorial.js) zu Ende gespielt ODER uebersprungen ist:
//     parent.postMessage({ type: 'jnr:tutorial', gesehen: true }, location.origin)
//       Der Trainer setzt daraufhin state.jnr.tutorialGesehen = true (applyJnrTutorial in 1x1-trainer/logic.js)
//       und schickt es beim naechsten jnr:init im Feld jnr wieder mit. Das Tutorial selbst meldet nie
//       jnr:result, gibt keine XP und kostet keine Leben. Fallback fuer einen Trainer, der die Nachricht
//       (noch) nicht kennt: Lumo merkt sich das Flag zusaetzlich in sessionStorage (`henry_jnr_tutorial`),
//       damit es in derselben Browser-Sitzung nicht bei jedem Oeffnen wieder startet.
//
//   Spiel -> Trainer, bei jedem Wechsel in den aktiven Spielmodus oder heraus (createAktivMelder):
//     parent.postMessage({ type: 'jnr:aktiv', aktiv: true|false }, location.origin)
//       aktiv  true nur in mode 'play' (ein Level oder das Mitmach-Tutorial laeuft), false in Menue/
//              Levelauswahl, Reihenwahl, Pause-Dialog (auch Hilfe daraus, Dreh-Hinweis), Game Over,
//              Gewonnen-Dialog und nach jnr:timeup. Die Hilfe im Menue bleibt mode 'menu'.
//       Der Trainer laesst die Stern-Zeit nur laufen, solange aktiv true ist (lumoTimerSollLaufen in
//       1x1-trainer/logic.js; Herkunft wie bei jnr:result geprueft). Lumo meldet seinen ersten Stand
//       sofort beim Start und den aktuellen Stand nochmals als Antwort auf jedes jnr:init. Ein Lumo,
//       das (z.B. aus einem alten Cache) nie jnr:aktiv sendet, laesst die Zeit wie frueher durchlaufen.
//       Standalone (ohne Parent) sendet Lumo nichts.
//
//   Spiel -> Trainer, wenn das Kind Lumo verlassen will (buildBeendenMessage):
//     parent.postMessage({ type: 'jnr:beenden' }, location.origin)
//       Gesendet vom Knopf "Zurueck zum Trainer" im Lumo-Menue (nur eingebettet sichtbar) und vom Dialog
//       "Deine Stern-Zeit ist vorbei" nach jnr:timeup. Der Trainer schliesst daraufhin das Overlay
//       (closeGame). Ablauf bei Zeitablauf: Trainer sendet jnr:timeup -> Lumo haelt an (mode 'ended'),
//       zeigt den Dialog mit genau einem Knopf und bestaetigt sofort mit jnr:zeitende -> Knopf sendet
//       jnr:beenden -> Trainer schliesst.
//       Standalone (ohne Parent) gibt es den Menue-Knopf nicht und jnr:timeup kommt nie.
//
//   Spiel -> Trainer, sofort als Antwort auf jnr:timeup (buildZeitendeMessage):
//     parent.postMessage({ type: 'jnr:zeitende' }, location.origin)
//       Bestaetigt, dass der Dialog "Deine Stern-Zeit ist vorbei" steht und das Kind ihn selbst mit
//       "Zurueck zum Trainer" (jnr:beenden) schliesst; der Trainer wartet dann beliebig lange.
//       Fallback im Trainer: kommt innerhalb von LUMO_BEENDEN_FALLBACK_MS (5 s, 1x1-trainer/logic.js)
//       nach jnr:timeup weder jnr:zeitende noch jnr:beenden (altes Lumo aus dem Cache, das den Dialog
//       ohne Knopf zeigt), schliesst der Trainer von selbst.
//
//   Trainer -> Spiel (Spiel prüft event.origin === location.origin und event.source === parent):
//     { type: 'jnr:init', level?, jnr?, options?, lernstand? }
//        level   optional: "1-2" startet direkt dieses Level (sonst Levelauswahl)
//        jnr     optional: Fortschritt { levels: { "1-2": { medals, bestTimeMs, bestFunken } },
//                xpAwarded: { "1-2": true }, funkenTotal, lastLevel, tutorialGesehen }
//                Alte Staende koennen Eintraege der gestrichenen Stufe "1-1" enthalten: sie bleiben
//                erhalten, Lumo zeigt sie nicht an. Ein unbekanntes `level` (z.B. "1-1") oeffnet das Menue.
//                tutorialGesehen fehlt oder ist nicht true: Lumo startet vor dem ersten Level, das das Kind
//                im Menue waehlt, das Tutorial (ein Direktstart ueber `level` laesst es aus)
//        options optional: { steuerung: 'standard'|'einfach', mathe: 'ziel'|'aus', farbhilfe, musik }
//        lernstand optional: { "2": 0.9, "7": 0.3, ... } Lernstand je Reihe (Schluessel "2".."10",
//                Werte 0..1, nur bereits geuebte Reihen; der Trainer rechnet ihn mit computeLernstand
//                in 1x1-trainer/logic.js aus den Leitner-Serien). Lumo empfiehlt daraus die 1-2
//                schwaechsten Reihen auf dem Reihen-Auswahlbildschirm. Fehlt das Feld oder ist es
//                ungueltig, ist lernstand null: alle Reihen waehlbar, keine Empfehlung. Ungueltige
//                Eintraege fallen einzeln weg. Nur fluechtig, landet nie im Spielstand.
//     { type: 'jnr:pause' }   pausiert das Spiel (App-Wechsel, Dialog über dem Spiel; auch das X der
//                             Trainer-Leiste, solange Lumo aktiv meldet: erst Pause, das zweite X schliesst)
//     { type: 'jnr:timeup' }  Stern-Zeit abgelaufen: Spiel stoppt sauber (Loop aus, Ton aus) und zeigt
//                             "Deine Stern-Zeit ist vorbei" mit dem Knopf "Zurueck zum Trainer" (jnr:beenden),
//                             antwortet sofort mit jnr:zeitende, bleibt in mode 'ended' haengen, bis ein erneutes jnr:init kommt (Reset-Pfad,
//                             z.B. nach Einloesen eines neuen Sterns); ein jnr:init aus mode 'won' wirkt genauso
//
//   Debug-Hilfen (window.__jnr) gibt es nur mit einem Debug-Parameter in der URL (debugErlaubt):
//   ?jnrDebug=1 oder einer der Debug-Parameter jnrLevel, jnrSeed, jnrReihe, jnrTutorial=1. Der Trainer
//   laedt Lumo ohne Parameter, im Trainer gibt es also keine Debug-Hilfen.
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

  function buildTutorialMessage() { return { type: 'jnr:tutorial', gesehen: true }; }

  // "Zurueck zum Trainer" (Menue, nur eingebettet) und "Deine Stern-Zeit ist vorbei": der Trainer schliesst Lumo.
  function buildBeendenMessage() { return { type: 'jnr:beenden' }; }
  // Antwort auf jnr:timeup: der Dialog steht, der Trainer soll auf jnr:beenden warten (kein Fallback).
  function buildZeitendeMessage() { return { type: 'jnr:zeitende' }; }

  function sanitizeLernstand(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    var out = {}, any = false;
    Object.keys(raw).forEach(function (k) {
      if (!/^(?:[2-9]|10)$/.test(k)) return;
      var v = raw[k];
      if (typeof v !== 'number' || !isFinite(v) || v < 0 || v > 1) return;
      out[k] = v; any = true;
    });
    return any ? out : null;
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
        jnr: R.sanitizeJnr(merged),
        lernstand: sanitizeLernstand(data.lernstand)
      };
    }
    return null;
  }

  function buildAktivMessage(aktiv) { return { type: 'jnr:aktiv', aktiv: !!aktiv }; }

  // Aktiv gespielt wird nur in mode 'play' (Level oder Tutorial), siehe Vertrag oben.
  function istAktiv(mode) { return mode === 'play'; }

  // Meldet den Aktivzustand ueber send(msg), aber nur bei einem Wechsel (der erste Aufruf meldet
  // immer). immer = true meldet den aktuellen Stand erneut (Antwort auf jnr:init).
  function createAktivMelder(send) {
    var letzter = null;
    return {
      melde: function (mode, immer) {
        var a = istAktiv(mode);
        if (a === letzter && !immer) return false;
        letzter = a;
        send(buildAktivMessage(a));
        return true;
      }
    };
  }

  // search: location.search ('?jnrDebug=1&...'). true, wenn window.__jnr bereitgestellt werden darf.
  function debugErlaubt(search) {
    var q = new URLSearchParams(search || '');
    return q.get('jnrDebug') === '1' || q.get('jnrTutorial') === '1' ||
      q.has('jnrLevel') || q.has('jnrSeed') || q.has('jnrReihe');
  }

  function isTrustedMessage(event, ownOrigin, parentWindow) {
    return !!event && event.origin === ownOrigin && event.source === parentWindow;
  }

  function isEmbedded(win) { return win.parent !== win; }

  return { buildResultMessage: buildResultMessage, buildTutorialMessage: buildTutorialMessage, buildBeendenMessage: buildBeendenMessage, buildZeitendeMessage: buildZeitendeMessage, buildAktivMessage: buildAktivMessage, istAktiv: istAktiv, createAktivMelder: createAktivMelder, debugErlaubt: debugErlaubt, parseHostMessage: parseHostMessage, sanitizeLernstand: sanitizeLernstand, isTrustedMessage: isTrustedMessage, isEmbedded: isEmbedded };
});
