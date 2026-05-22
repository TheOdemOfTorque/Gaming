// TDD: Tests-first für defensive Helpers gegen Stale-Challenge-State.
//
// resetActiveChallengeState(state) → state mit gecleartem _activeChallengeId etc.
//   Pure: mutiert input nicht.
//
// shouldSubmitOutgoingChallenge(game) → bool.
//   true wenn die Challenge gesendet werden soll (echtes Spiel-Ergebnis vorhanden).
//   false wenn 0 richtige Antworten (= User hat nicht ernsthaft gespielt, Tab-im-Hintergrund-Fall).

const { resetActiveChallengeState, shouldSubmitOutgoingChallenge } =
  require('../../1x1-trainer/logic.js');

describe('resetActiveChallengeState', () => {
  function st(mp = {}) {
    return { mp: { enabled: true, nickname: 'Marco',
                   _activeChallengeId: '__challenge__',
                   _activeChallengeTheirScore: 100,
                   token: 'tok', ...mp } };
  }

  test('setzt _activeChallengeId auf null', () => {
    const r = resetActiveChallengeState(st());
    expect(r.mp._activeChallengeId).toBeNull();
  });

  test('setzt _activeChallengeTheirScore auf null', () => {
    const r = resetActiveChallengeState(st());
    expect(r.mp._activeChallengeTheirScore).toBeNull();
  });

  test('lässt andere mp-Felder unangetastet (nickname, token, enabled)', () => {
    const r = resetActiveChallengeState(st());
    expect(r.mp.nickname).toBe('Marco');
    expect(r.mp.token).toBe('tok');
    expect(r.mp.enabled).toBe(true);
  });

  test('Pure: input-state wird nicht mutiert', () => {
    const s = st();
    const snap = JSON.parse(JSON.stringify(s));
    resetActiveChallengeState(s);
    expect(s).toEqual(snap);
  });

  test('robust gegen fehlendes mp-Objekt (defensive)', () => {
    const r = resetActiveChallengeState({});
    expect(r.mp).toBeDefined();
    expect(r.mp._activeChallengeId).toBeNull();
  });
});

describe('shouldSubmitOutgoingChallenge', () => {
  test('correct > 0 → true (echtes Spiel-Ergebnis)', () => {
    expect(shouldSubmitOutgoingChallenge({ correct: 1, score: 10 })).toBe(true);
    expect(shouldSubmitOutgoingChallenge({ correct: 20, score: 240 })).toBe(true);
  });

  test('correct === 0 → false (verhindert Tab-im-Hintergrund-0-Punkte-Send)', () => {
    expect(shouldSubmitOutgoingChallenge({ correct: 0, score: 0 })).toBe(false);
  });

  test('fehlendes game-Objekt → false (defensive)', () => {
    expect(shouldSubmitOutgoingChallenge(null)).toBe(false);
    expect(shouldSubmitOutgoingChallenge(undefined)).toBe(false);
    expect(shouldSubmitOutgoingChallenge({})).toBe(false);
  });

  test('correct === 0 trotz hohem Score → false (Edge: Score ohne Antworten unmöglich, aber sicherer)', () => {
    expect(shouldSubmitOutgoingChallenge({ correct: 0, score: 50 })).toBe(false);
  });
});
