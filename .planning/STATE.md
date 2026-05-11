# Project State: Prime Empire — Abschnitt 1

**Initialized:** 2026-05-10
**Last Updated:** 2026-05-10

---

## Current Phase

**Phase:** 0 (Initialized — not started)
**Status:** Ready for Phase 1

## Phase Progress

| Phase | Title | Status | Started | Completed |
|-------|-------|--------|---------|-----------|
| 1 | Freeze-Bug Fix | ⬜ Pending | — | — |
| 2 | Touch-Controls + Cleanup | ⬜ Pending | — | — |
| 3 | Co-op KI | ⬜ Pending | — | — |
| 4 | Bank-Zone | ⬜ Pending | — | — |
| 5 | Bank-Interieur + Slot | ⬜ Pending | — | — |
| 6 | Audio | ⬜ Pending | — | — |

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-10 | `scene.launch + sleep` statt `scene.start` | GameScene bleibt im Speicher; kein Re-Init der Tilemap |
| 2026-05-10 | Biased RNG: Jackpot in 3–8 Spins | Kind muss gewinnen können; 4% Gewinnchance zu frustrierend |
| 2026-05-10 | Teammate-Rescue auf v2 verschoben | Grundmechanik (Freeze-Fix + D-Pad) wichtiger für MVP |
| 2026-05-10 | Spieler-Freeze 2500ms, Gegner 5000ms | Asymmetrie macht Co-op sinnvoll; Spieler erholt sich schneller |

## Open Questions

- Slot-Interaktion: Walk-into-tile oder Taste/Touch wenn in der Nähe? (Phase 5 klärt)
- Nach Jackpot: `scene.stop('GameScene')` (GC) oder sleeping lassen? (Abschnitt 2 Integration)

## Blockers

None.

---

*State initialized: 2026-05-10*
