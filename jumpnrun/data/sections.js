// Lumo - Abschnitts-Bibliothek: viele kurze, handgebaute ASCII-Abschnitte (12-20 Kacheln breit),
// aus denen core/levelgen.js zufaellige Level zusammensetzt (siehe ADR-0002 im Vault).
// Zeichen wie core/level.js, aber ohne S/G/C: die setzt der Generator an den Uebergaengen.
// Jeder Abschnitt ist an beiden Enden (2 Kacheln) flach auf Standardhoehe (Zeile 7-8 Boden,
// Zeile 0-6 Luft), damit jede Reihenfolge anschlussfaehig ist. 'o' = Kristallplatz
// (Zahl kommt von core/mathgen.js), '^' Dornen, '~' Federpilz.
//
// schwierigkeit 1: nur Laufen/Springen/Sammeln, keine Gefahren (passt zu Stufe 1-1).
// schwierigkeit 2: genau ein Gefahrentyp (Dornen oder Federpilz).
// schwierigkeit 3: Kombinationen, etwas laenger.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.JNR = root.JNR || {}; root.JNR.sections = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var SECTIONS = [
    {
      id: 'd1-lauf-a', schwierigkeit: 1, mechanik: ["lauf"],
      rows: [
      '.............',
      '.............',
      '.............',
      '.............',
      '.............',
      '.............',
      '..oo.....o...',
      '#############',
      '#############',
      ]
    },
    {
      id: 'd1-lauf-b', schwierigkeit: 1, mechanik: ["lauf"],
      rows: [
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..oo.......o..',
      '##############',
      '##############',
      ]
    },
    {
      id: 'd1-luecke-a', schwierigkeit: 1, mechanik: ["luecke"],
      rows: [
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
      '..o........o...',
      '#####.####.####',
      '#####.####.####',
      ]
    },
    {
      id: 'd1-luecke-b', schwierigkeit: 1, mechanik: ["luecke"],
      rows: [
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
      '......o........',
      '####..###..####',
      '####..###..####',
      ]
    },
    {
      id: 'd1-treppe-a', schwierigkeit: 1, mechanik: ["treppe"],
      rows: [
      '..............',
      '..............',
      '..............',
      '..............',
      '......o.......',
      '......##......',
      '....######o...',
      '##############',
      '##############',
      ]
    },
    {
      id: 'd1-treppe-b', schwierigkeit: 1, mechanik: ["treppe"],
      rows: [
      '..............',
      '..............',
      '..............',
      '..............',
      '.......o......',
      '...o.####.....',
      '...########...',
      '##############',
      '##############',
      ]
    },
    {
      id: 'd1-schwebend-a', schwierigkeit: 1, mechanik: ["schwebend"],
      rows: [
      '.............',
      '.............',
      '.............',
      '.............',
      '......o......',
      '.....###.....',
      '.....###.....',
      '####.....####',
      '####.....####',
      ]
    },
    {
      id: 'd1-kristallbogen-a', schwierigkeit: 1, mechanik: ["kristallbogen"],
      rows: [
      '..............',
      '..............',
      '..............',
      '..............',
      '......o.......',
      '....o.##o.....',
      '..o.######o...',
      '##############',
      '##############',
      ]
    },
    {
      id: 'd1-lauf-c', schwierigkeit: 1, mechanik: ["lauf"],
      rows: [
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..o.o......o..',
      '##############',
      '##############',
      ]
    },
    {
      id: 'd2-dornen-a', schwierigkeit: 2, mechanik: ["dornen"],
      rows: [
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
      '..o..^...^..o..',
      '###############',
      '###############',
      ]
    },
    {
      id: 'd2-dornen-b', schwierigkeit: 2, mechanik: ["dornen"],
      rows: [
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
      '..o.^.o...^....',
      '###############',
      '###############',
      ]
    },
    {
      id: 'd2-federpilz-a', schwierigkeit: 2, mechanik: ["federpilz"],
      rows: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '..o..~..o....o..',
      '######..########',
      '######..########',
      ]
    },
    {
      id: 'd2-federpilz-b', schwierigkeit: 2, mechanik: ["federpilz"],
      rows: [
      '..............',
      '..............',
      '..............',
      '..............',
      '......o.......',
      '.....###......',
      '....~#####o...',
      '##############',
      '##############',
      ]
    },
    {
      id: 'd2-luecke-dornen', schwierigkeit: 2, mechanik: ["luecke","dornen"],
      rows: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '..o.....^o......',
      '####..#####.####',
      '####..#####.####',
      ]
    },
    {
      id: 'd2-treppe-dornen', schwierigkeit: 2, mechanik: ["treppe","dornen"],
      rows: [
      '..............',
      '..............',
      '..............',
      '..............',
      '.....o........',
      '...^.###......',
      '...#######o...',
      '##############',
      '##############',
      ]
    },
    {
      id: 'd2-schwebend-b', schwierigkeit: 2, mechanik: ["schwebend"],
      rows: [
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '......##......',
      '..o...##..o...',
      '####......####',
      '####......####',
      ]
    },
    {
      id: 'd3-kombo-a', schwierigkeit: 3, mechanik: ["luecke","dornen","federpilz"],
      rows: [
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '..o.^...~...o..^o...',
      '#########...########',
      '#########...########',
      ]
    },
    {
      id: 'd3-kombo-b', schwierigkeit: 3, mechanik: ["treppe","dornen","schwebend"],
      rows: [
      '...................',
      '...................',
      '...................',
      '.........o.........',
      '.........##........',
      '...^.##..##........',
      '...####......##o...',
      '#######......######',
      '#######......######',
      ]
    },
    {
      id: 'd3-kombo-c', schwierigkeit: 3, mechanik: ["federpilz","luecke","kristallbogen"],
      rows: [
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..o.~...o..^..o...',
      '#####...##########',
      '#####...##########',
      ]
    },
    {
      id: 'd3-kombo-d', schwierigkeit: 3, mechanik: ["dornen","federpilz","treppe"],
      rows: [
      '.................',
      '.................',
      '.................',
      '.................',
      '.........o.......',
      '.........###o....',
      '...^##~..#####...',
      '#######..########',
      '#######..########',
      ]
    },
    {
      id: 'd3-kombo-e', schwierigkeit: 3, mechanik: ["luecke","treppe","dornen"],
      rows: [
      '..................',
      '..................',
      '..................',
      '..................',
      '.........o........',
      '.......^.##.......',
      '.....o.######.o...',
      '###..########.####',
      '###..########.####',
      ]
    },
    {
      id: 'd3-kombo-f', schwierigkeit: 3, mechanik: ["schwebend","federpilz","dornen"],
      rows: [
      '................',
      '................',
      '................',
      '................',
      '......o.........',
      '......##........',
      '....~.##.^..o...',
      '#####....#.#####',
      '#####....#.#####',
      ]
    },
  ];

  var MECHANIKEN = Array.from(new Set(SECTIONS.reduce(function (a, s) { return a.concat(s.mechanik); }, [])));
  function byDifficulty(max) { return SECTIONS.filter(function (s) { return s.schwierigkeit <= max; }); }

  return { SECTIONS: SECTIONS, MECHANIKEN: MECHANIKEN, byDifficulty: byDifficulty };
});
