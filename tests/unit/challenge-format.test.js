// TDD: Tests für Display-Helpers der ausgehenden Challenges (Bug 2).
//
// formatChallengeAge(secondsAgo) → deutsche Relativ-Zeitangabe
// formatOutgoingChallengeRow(challenge, nowSec) → { title, subtitle }

const { formatChallengeAge, formatOutgoingChallengeRow } =
  require('../../1x1-trainer/logic.js');

describe('formatChallengeAge', () => {
  test('unter 60 Sekunden → "gerade eben"', () => {
    expect(formatChallengeAge(0)).toBe('gerade eben');
    expect(formatChallengeAge(30)).toBe('gerade eben');
    expect(formatChallengeAge(59)).toBe('gerade eben');
  });

  test('1 Minute → "vor 1 Minute" (Singular)', () => {
    expect(formatChallengeAge(60)).toBe('vor 1 Minute');
    expect(formatChallengeAge(90)).toBe('vor 1 Minute');
  });

  test('mehrere Minuten → "vor X Minuten" (Plural)', () => {
    expect(formatChallengeAge(120)).toBe('vor 2 Minuten');
    expect(formatChallengeAge(600)).toBe('vor 10 Minuten');
    expect(formatChallengeAge(3540)).toBe('vor 59 Minuten');
  });

  test('1 Stunde → "vor 1 Stunde" (Singular)', () => {
    expect(formatChallengeAge(3600)).toBe('vor 1 Stunde');
    expect(formatChallengeAge(5400)).toBe('vor 1 Stunde');
  });

  test('mehrere Stunden → "vor X Stunden"', () => {
    expect(formatChallengeAge(7200)).toBe('vor 2 Stunden');
    expect(formatChallengeAge(82800)).toBe('vor 23 Stunden');
  });

  test('1 Tag → "gestern"', () => {
    expect(formatChallengeAge(86400)).toBe('gestern');
    expect(formatChallengeAge(120000)).toBe('gestern');
  });

  test('mehrere Tage → "vor X Tagen"', () => {
    expect(formatChallengeAge(172800)).toBe('vor 2 Tagen');
    expect(formatChallengeAge(604800)).toBe('vor 7 Tagen');
  });

  test('negative Werte (Uhr-Drift) → "gerade eben"', () => {
    expect(formatChallengeAge(-5)).toBe('gerade eben');
  });
});

describe('formatOutgoingChallengeRow', () => {
  const baseChallenge = {
    challenged_nickname: 'Anna',
    challenger_score: 240,
    challenger_correct: 22,
    created_at: 1700000000,
  };

  test('Standard-Challenge: title nennt Empfänger, subtitle nennt Score + Alter', () => {
    const r = formatOutgoingChallengeRow(baseChallenge, 1700000000 + 600);
    expect(r.title).toBe('Du hast Anna herausgefordert');
    expect(r.subtitle).toContain('vor 10 Minuten');
    expect(r.subtitle).toContain('240');
    expect(r.subtitle).toContain('22');
  });

  test('Empfänger fehlt → "Unbekannt" als Fallback (kein Crash)', () => {
    const c = { ...baseChallenge, challenged_nickname: null };
    const r = formatOutgoingChallengeRow(c, 1700000000 + 600);
    expect(r.title).toBe('Du hast Unbekannt herausgefordert');
  });

  test('Score = 0 wird sauber gerendert (kein leerer subtitle)', () => {
    const c = { ...baseChallenge, challenger_score: 0, challenger_correct: 0 };
    const r = formatOutgoingChallengeRow(c, 1700000000 + 600);
    expect(r.subtitle).toContain('0');
  });

  test('frisch erstellt (gleicher Zeitstempel) → "gerade eben"', () => {
    const r = formatOutgoingChallengeRow(baseChallenge, baseChallenge.created_at);
    expect(r.subtitle).toContain('gerade eben');
  });
});
