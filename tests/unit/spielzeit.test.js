const { invaderTimerSollLaufen, zeitAbgelaufenAktion, zeitAnzeige, sternZeitEinloesen } = require('../../1x1-trainer/logic.js');

// Gleiche Spielzeit-Regel fuer Space Invader und Lumo (Marco 30.10.2026, Spec „Spielzeit und XP für
// Lumo und Knobel“): Die Zeit laeuft, solange das Spiel offen und sichtbar ist, auch im Menue. Sie
// steht in der Pause, im Hintergrund und in Dialogen, die das Spiel anhalten.
describe('invaderTimerSollLaufen', () => {
  const sichtbar = true;
  test('laeuft im Spiel und im Menue', () => {
    ['playing', 'menu'].forEach((invState) => {
      expect(invaderTimerSollLaufen({ invState, settFrom: 'menu', sichtbar })).toBe(true);
    });
  });
  // Marco 31.10.2026: bei beiden Spielen steht die Zeit in Game Over, Namenseingabe und Bestenliste.
  test('steht in Game Over, Namenseingabe und Bestenliste', () => {
    ['dying', 'entering', 'scores'].forEach((invState) => {
      expect(invaderTimerSollLaufen({ invState, settFrom: 'menu', sichtbar })).toBe(false);
    });
  });
  test('steht in der Pause', () => {
    expect(invaderTimerSollLaufen({ invState: 'paused', settFrom: 'menu', sichtbar })).toBe(false);
  });
  test('steht in den Einstellungen, die aus der Pause geoeffnet wurden', () => {
    expect(invaderTimerSollLaufen({ invState: 'settings', settFrom: 'pause', sichtbar })).toBe(false);
    expect(invaderTimerSollLaufen({ invState: 'settings', settFrom: 'menu', sichtbar })).toBe(true);
  });
  test('steht in den Einstellungen, die aus der Bestenliste geoeffnet wurden', () => {
    expect(invaderTimerSollLaufen({ invState: 'settings', settFrom: 'scores', sichtbar })).toBe(false);
  });
  test('steht, solange der Stern-Dialog offen ist', () => {
    expect(invaderTimerSollLaufen({ invState: 'menu', settFrom: 'menu', sichtbar, sternDialog: true })).toBe(false);
  });
  test('steht im Hintergrund', () => {
    expect(invaderTimerSollLaufen({ invState: 'playing', settFrom: 'menu', sichtbar: false })).toBe(false);
  });
});

describe('zeitAbgelaufenAktion (bei 0:00, fuer beide Spiele gleich)', () => {
  test('mit Sternen: Stern einsetzen und weiterspielen anbieten', () => {
    expect(zeitAbgelaufenAktion({ stars: 1, gameSecondsLeft: 0 })).toBe('stern_anbieten');
    expect(zeitAbgelaufenAktion({ stars: 4, gameSecondsLeft: 0 })).toBe('stern_anbieten');
  });
  test('ohne Sterne: Ende, zurueck zum Trainer', () => {
    expect(zeitAbgelaufenAktion({ stars: 0, gameSecondsLeft: 0 })).toBe('ende');
    expect(zeitAbgelaufenAktion({ gameSecondsLeft: 0 })).toBe('ende');
  });
});

describe('Stern einsetzen nach Ablauf (sternZeitEinloesen, fuer Invader und Lumo)', () => {
  test('zieht einen Stern ab und gibt 10 Minuten', () => {
    ['invader', 'jnr'].forEach((g) => {
      const r = sternZeitEinloesen({ stars: 2, gameSecondsLeft: 0 }, g);
      expect(r.abgezogen).toBe(true);
      expect(r.state).toMatchObject({ stars: 1, gameSecondsLeft: 600 });
    });
  });
  test('ohne Stern passiert nichts', () => {
    expect(sternZeitEinloesen({ stars: 0, gameSecondsLeft: 0 }, 'jnr').abgezogen).toBe(false);
  });
});

describe('zeitAnzeige (Invader und Lumo, rot ab 2 Minuten)', () => {
  test('Format m:ss', () => {
    expect(zeitAnzeige(600).text).toBe('⏱ 10:00');
    expect(zeitAnzeige(125).text).toBe('⏱ 2:05');
    expect(zeitAnzeige(9).text).toBe('⏱ 0:09');
    expect(zeitAnzeige(0).text).toBe('⏱ 0:00');
  });
  test('Warnung ab 2:00 und darunter', () => {
    expect(zeitAnzeige(121).warnung).toBe(false);
    expect(zeitAnzeige(120).warnung).toBe(true);
    expect(zeitAnzeige(1).warnung).toBe(true);
    expect(zeitAnzeige(0).warnung).toBe(true);
  });
  test('kaputte Werte zeigen 0:00', () => {
    expect(zeitAnzeige(undefined)).toEqual({ text: '⏱ 0:00', warnung: true });
    expect(zeitAnzeige(-5).text).toBe('⏱ 0:00');
  });
});

// Review B3: kurze Pausen duerfen angefangene Sekunden nicht verschlucken. Der gemeinsame Timer
// sammelt verbrauchte Millisekunden ueber Pausen hinweg und zieht erst je volle Sekunde ab.
describe('sammleSpielzeit (Millisekunden ueber Pausen hinweg aufsummieren)', () => {
  const { sammleSpielzeit } = require('../../1x1-trainer/logic.js');
  test('unter einer Sekunde wird nur gesammelt', () => {
    expect(sammleSpielzeit(0, 800)).toEqual({ gesammeltMs: 800, sekunden: 0 });
  });
  test('angefangene Sekunden aus mehreren kurzen Stuecken ergeben volle Sekunden', () => {
    let g = 0, sek = 0;
    for (let i = 0; i < 10; i++) { const r = sammleSpielzeit(g, 800); g = r.gesammeltMs; sek += r.sekunden; }
    expect(sek).toBe(8);
    expect(g).toBe(0);
  });
  test('Rest bleibt stehen, mehrere Sekunden auf einmal', () => {
    expect(sammleSpielzeit(700, 2500)).toEqual({ gesammeltMs: 200, sekunden: 3 });
  });
  test('negative, kaputte oder riesige Zeitspruenge zaehlen nicht oder hoechstens 5 s', () => {
    expect(sammleSpielzeit(300, -50)).toEqual({ gesammeltMs: 300, sekunden: 0 });
    expect(sammleSpielzeit(300, NaN)).toEqual({ gesammeltMs: 300, sekunden: 0 });
    expect(sammleSpielzeit(0, 60000)).toEqual({ gesammeltMs: 0, sekunden: 5 });
    expect(sammleSpielzeit(undefined, 400)).toEqual({ gesammeltMs: 400, sekunden: 0 });
  });
});
