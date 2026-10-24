// Lumo - Tile-AABB-Kollision. Reine Funktionen, kein DOM.
// Laden: Node/Jest per require, Browser per <script> (Namespace window.JNR.collision).
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.JNR = root.JNR || {}; root.JNR.collision = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var TILE = 16;
  var EPS = 1e-6;

  // level: { w, h, solid: Uint8Array(w*h) }  (Kacheln, 1 = fest)
  // Links/rechts außerhalb des Levels ist Wand, oben Himmel, unten Abgrund.
  function solidAt(level, tx, ty) {
    if (tx < 0 || tx >= level.w) return true;
    if (ty < 0 || ty >= level.h) return false;
    return level.solid[ty * level.w + tx] === 1;
  }

  function overlapsSolid(level, x, y, w, h) {
    var tx0 = Math.floor(x / TILE), tx1 = Math.floor((x + w - EPS) / TILE);
    var ty0 = Math.floor(y / TILE), ty1 = Math.floor((y + h - EPS) / TILE);
    for (var ty = ty0; ty <= ty1; ty++)
      for (var tx = tx0; tx <= tx1; tx++)
        if (solidAt(level, tx, ty)) return true;
    return false;
  }

  // box: { x, y, w, h }. Gibt die neue Position zurück, bündig an der Kachelkante bei Treffer.
  function moveX(level, box, dx) {
    var nx = box.x + dx;
    if (dx === 0 || !overlapsSolid(level, nx, box.y, box.w, box.h)) return { x: nx, hit: false };
    var edge;
    if (dx > 0) edge = Math.floor((nx + box.w - EPS) / TILE) * TILE - box.w;
    else edge = (Math.floor(nx / TILE) + 1) * TILE;
    return { x: edge, hit: true };
  }

  function moveY(level, box, dy) {
    var ny = box.y + dy;
    if (dy === 0 || !overlapsSolid(level, box.x, ny, box.w, box.h))
      return { y: ny, hitDown: false, hitUp: false };
    if (dy > 0) return { y: Math.floor((ny + box.h - EPS) / TILE) * TILE - box.h, hitDown: true, hitUp: false };
    return { y: (Math.floor(ny / TILE) + 1) * TILE, hitDown: false, hitUp: true };
  }

  return { TILE: TILE, solidAt: solidAt, overlapsSolid: overlapsSolid, moveX: moveX, moveY: moveY };
});
