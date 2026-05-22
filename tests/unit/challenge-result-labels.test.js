// TDD: Tests-first für Bug 4 — Challenge-Result zeigt hardcoded "Du" / "Gegner"
// statt echter Nicknames.
//
// formatChallengeResultLabels(myNickname, opponentNickname) → { myLabel, theirLabel }
//   Pure: liefert die zwei Label-Strings für die Result-Tabelle.

const { formatChallengeResultLabels } = require('../../1x1-trainer/logic.js');

describe('formatChallengeResultLabels', () => {
  test('beide Nicknames vorhanden → werden direkt verwendet', () => {
    const r = formatChallengeResultLabels('Marco', 'Anna');
    expect(r.myLabel).toBe('Marco');
    expect(r.theirLabel).toBe('Anna');
  });

  test('eigener Nickname fehlt → "Du" als Fallback', () => {
    const r = formatChallengeResultLabels(null, 'Anna');
    expect(r.myLabel).toBe('Du');
    expect(r.theirLabel).toBe('Anna');
  });

  test('Gegner-Nickname fehlt → "Gegner" als Fallback', () => {
    const r = formatChallengeResultLabels('Marco', null);
    expect(r.myLabel).toBe('Marco');
    expect(r.theirLabel).toBe('Gegner');
  });

  test('beide fehlen → beide Fallbacks', () => {
    const r = formatChallengeResultLabels(null, null);
    expect(r.myLabel).toBe('Du');
    expect(r.theirLabel).toBe('Gegner');
  });

  test('leerer String → wie null (Fallback)', () => {
    const r = formatChallengeResultLabels('', '');
    expect(r.myLabel).toBe('Du');
    expect(r.theirLabel).toBe('Gegner');
  });

  test('undefined-Parameter → Fallbacks', () => {
    const r = formatChallengeResultLabels(undefined, undefined);
    expect(r.myLabel).toBe('Du');
    expect(r.theirLabel).toBe('Gegner');
  });
});
