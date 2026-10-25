// Lumo - Medaillen, XP und Spielstand (state.jnr). Reine Funktionen, kein localStorage.
// Das Spiel vergibt keine Sterne (Sterne kaufen Spielzeit, das gäbe eine Endlosschleife).
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.JNR = root.JNR || {}; root.JNR.rewards = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var FUNKEN_QUOTE = 0.8;

  function parseLevelId(id) {
    var m = /^(\d+)-(\d+)$/.exec(String(id));
    if (!m || +m[1] < 1 || +m[2] < 1) throw new Error('Ungültige Level-ID: ' + id);
    return { welt: +m[1], nr: +m[2] };
  }

  // stats: { reached, richtig, totalGood, fehltreffer }
  function calcMedals(s) {
    if (!s.reached || s.lost) return { geschafft: false, funken: false, fehlerfrei: false, anzahl: 0 };
    var funken = s.totalGood === 0 || s.richtig / s.totalGood >= FUNKEN_QUOTE;
    var fehlerfrei = s.fehltreffer === 0;
    return { geschafft: true, funken: funken, fehlerfrei: fehlerfrei, anzahl: 1 + (funken ? 1 : 0) + (fehlerfrei ? 1 : 0) };
  }

  // Einmalig pro Level: 20 XP mal Levelnummer in der Welt plus 10 je Medaille.
  function xpFor(levelId, anzahl, bereitsErhalten) {
    if (bereitsErhalten || anzahl < 1) return 0;
    return 20 * parseLevelId(levelId).nr + 10 * anzahl;
  }

  function defaultOptions() { return { steuerung: 'standard', mathe: 'ziel', farbhilfe: true, musik: true }; }
  function defaultJnr() {
    // tutorialGesehen: das Mitmach-Tutorial (core/tutorial.js) lief schon einmal durch oder wurde uebersprungen
    return { v: 1, levels: {}, lastLevel: null, funkenTotal: 0, xpAwarded: {}, options: defaultOptions(), tutorialGesehen: false };
  }

  function num(v, lo, hi, dflt) {
    return (typeof v === 'number' && isFinite(v) && v >= lo && v <= hi) ? v : dflt;
  }

  function sanitizeJnr(raw) {
    var j = defaultJnr();
    if (!raw || typeof raw !== 'object') return j;
    if (raw.levels && typeof raw.levels === 'object') {
      Object.keys(raw.levels).forEach(function (id) {
        if (!/^\d+-\d+$/.test(id)) return;
        var l = raw.levels[id] || {};
        j.levels[id] = {
          medals: Math.round(num(l.medals, 0, 3, l.medals > 3 ? 3 : 0)),
          bestTimeMs: num(l.bestTimeMs, 1, 1e9, null),
          bestFunken: Math.round(num(l.bestFunken, 0, 9999, 0))
        };
      });
    }
    if (raw.xpAwarded && typeof raw.xpAwarded === 'object') {
      Object.keys(raw.xpAwarded).forEach(function (id) { if (raw.xpAwarded[id] === true) j.xpAwarded[id] = true; });
    }
    j.funkenTotal = Math.round(num(raw.funkenTotal, 0, 1e9, 0));
    j.tutorialGesehen = raw.tutorialGesehen === true;
    j.lastLevel = typeof raw.lastLevel === 'string' && /^\d+-\d+$/.test(raw.lastLevel) ? raw.lastLevel : null;
    var o = raw.options;
    if (o && typeof o === 'object') {
      if (o.steuerung === 'einfach' || o.steuerung === 'standard') j.options.steuerung = o.steuerung;
      if (o.mathe === 'aus' || o.mathe === 'ziel') j.options.mathe = o.mathe;
      if (typeof o.farbhilfe === 'boolean') j.options.farbhilfe = o.farbhilfe;
      if (typeof o.musik === 'boolean') j.options.musik = o.musik;
    }
    return j;
  }

  // stats: { reached, richtig, totalGood, fehltreffer, funken, timeMs }
  function buildResult(levelId, stats, jnr) {
    var m = calcMedals(stats);
    return {
      level: levelId,
      medaillen: m.anzahl,
      funken: stats.funken,
      xp: xpFor(levelId, m.anzahl, !!(jnr && jnr.xpAwarded && jnr.xpAwarded[levelId])),
      timeMs: stats.timeMs,
      details: m
    };
  }

  function mergeResult(jnr, r) {
    var j = sanitizeJnr(jnr);
    var old = j.levels[r.level];
    var t = typeof r.timeMs === 'number' && r.timeMs > 0 ? r.timeMs : null;
    j.levels[r.level] = {
      medals: Math.max(old ? old.medals : 0, r.medaillen),
      bestTimeMs: old && old.bestTimeMs != null ? (t != null ? Math.min(old.bestTimeMs, t) : old.bestTimeMs) : t,
      bestFunken: Math.max(old ? old.bestFunken : 0, r.funken)
    };
    if (r.medaillen >= 1) j.xpAwarded[r.level] = true;
    j.funkenTotal += r.funken;
    j.lastLevel = r.level;
    return j;
  }

  // Nur ein geschaffter Lauf geht als jnr:result an den Trainer und in den Spielstand. Ein verlorener
  // Lauf (alle Leben weg) bringt weder XP noch Funken noch Fortschritt.
  function shouldReport(stats) {
    return !!(stats && stats.reached && !stats.lost);
  }

  // Level n+1 ist frei, sobald Level n geschafft ist (mindestens 1 Medaille).
  function isUnlocked(jnr, id, order) {
    var i = order.indexOf(id);
    if (i <= 0) return i === 0;
    var prev = jnr.levels[order[i - 1]];
    return !!(prev && prev.medals >= 1);
  }

  return {
    parseLevelId: parseLevelId, calcMedals: calcMedals, xpFor: xpFor,
    defaultJnr: defaultJnr, sanitizeJnr: sanitizeJnr,
    buildResult: buildResult, mergeResult: mergeResult, isUnlocked: isUnlocked, shouldReport: shouldReport
  };
});
