// Lumo - Spielerphysik mit festem 60-Hz-Schritt. Reine Funktionen, kein DOM, keine Zufallszahlen.
// Einheiten: Pixel und Schritte (1 Schritt = 1/60 s).
(function (root, factory) {
  var deps = (typeof module === 'object' && module.exports)
    ? { collision: require('./collision.js') }
    : { collision: root.JNR.collision };
  var api = factory(deps.collision);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.JNR = root.JNR || {}; root.JNR.physics = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C) {
  var K = {
    FIXED_DT: 1 / 60,
    W: 10, H: 12,                // Terrain-Hitbox von Lumo (Grafik ist 14 x 14)
    ACC: 0.22, AIR_ACC: 0.17, FRIC: 0.25, AIR_FRIC: 0.06, MAX_RUN: 1.5,
    JUMP_V: 5.7,
    GRAV_UP: 0.30, GRAV_APEX: 0.18, APEX_BAND: 1.0, GRAV_DOWN: 0.42, MAX_FALL: 5.5,
    CUT: 0.5,                    // Aufwärtsgeschwindigkeit beim Loslassen
    COYOTE: 6,                   // ca. 100 ms
    BUFFER: 7,                   // ca. 120 ms
    CORNER: 4                    // Ecken-Toleranz in Pixeln
  };

  function createPlayer(x, y) {
    return {
      x: x, y: y, vx: 0, vy: 0, facing: 1,
      onGround: false, coyote: 0, buffer: 0, jumpHeld: false, canCut: false
    };
  }

  // input: { left, right, jump } (gehaltene Tasten). Gibt { jumped, landed } zurück.
  function step(p, input, level) {
    var was = p.onGround;
    var pressed = !!input.jump && !p.jumpHeld;
    p.jumpHeld = !!input.jump;
    if (pressed) p.buffer = K.BUFFER;
    if (was) p.coyote = K.COYOTE;

    // waagerecht
    var dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) {
      var a = was ? K.ACC : K.AIR_ACC;
      if (p.vx * dir < 0) a *= 2; // Umkehren geht schneller
      p.vx += dir * a;
      if (p.vx > K.MAX_RUN) p.vx = K.MAX_RUN;
      if (p.vx < -K.MAX_RUN) p.vx = -K.MAX_RUN;
      p.facing = dir;
    } else {
      var f = was ? K.FRIC : K.AIR_FRIC;
      if (Math.abs(p.vx) <= f) p.vx = 0; else p.vx -= Math.sign(p.vx) * f;
    }

    // Sprung (Coyote Time + Jump Buffer)
    var jumped = false;
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -K.JUMP_V;
      p.onGround = false;
      p.coyote = 0; p.buffer = 0;
      p.canCut = true;
      jumped = true;
    }
    // variable Sprunghöhe
    if (!input.jump && p.vy < 0 && p.canCut) { p.vy *= K.CUT; p.canCut = false; }

    // Schwerkraft
    var g;
    if (p.vy < 0) g = Math.abs(p.vy) < K.APEX_BAND ? K.GRAV_APEX : K.GRAV_UP;
    else g = Math.abs(p.vy) < K.APEX_BAND ? K.GRAV_APEX : K.GRAV_DOWN;
    p.vy = Math.min(p.vy + g, K.MAX_FALL);

    // Bewegung und Kollision
    var rx = C.moveX(level, { x: p.x, y: p.y, w: K.W, h: K.H }, p.vx);
    p.x = rx.x;
    if (rx.hit) p.vx = 0;

    var ry = C.moveY(level, { x: p.x, y: p.y, w: K.W, h: K.H }, p.vy);
    var landed = false;
    if (ry.hitUp) {
      var ny = p.y + p.vy, shifted = false;
      for (var k = 1; k <= K.CORNER && !shifted; k++) {
        if (!C.overlapsSolid(level, p.x - k, ny, K.W, K.H)) { p.x -= k; shifted = true; }
        else if (!C.overlapsSolid(level, p.x + k, ny, K.W, K.H)) { p.x += k; shifted = true; }
      }
      if (shifted) p.y = ny; else { p.y = ry.y; p.vy = 0; }
      p.onGround = false;
    } else if (ry.hitDown) {
      p.y = ry.y; p.vy = 0; p.onGround = true; p.canCut = false;
      landed = !was;
    } else {
      p.y = ry.y; p.onGround = false;
    }

    if (!was) p.coyote = Math.max(0, p.coyote - 1);
    p.buffer = Math.max(0, p.buffer - 1);
    return { jumped: jumped, landed: landed };
  }

  K.createPlayer = createPlayer;
  K.step = step;
  return K;
});
