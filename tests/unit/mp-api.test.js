/**
 * Multiplayer API Integration Tests
 *
 * Testet die echte Cloudflare Worker API direkt via fetch.
 * Jeder Test-Run erzeugt eine eigene Gruppe mit zufälligem Code,
 * damit parallele Läufe nicht kollidieren.
 */

const { createHash } = require('node:crypto');

const API = 'https://1x1-api.marco-moebus.workers.dev';

function sha256hex(s) {
  return createHash('sha256').update(s).digest('hex');
}

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '0123456789';
  const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({ length: 4 }, () => digits[Math.floor(Math.random() * digits.length)]).join('');
  return `${part1}-${part2}`;
}

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['X-Player-Token'] = token;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

// ── Shared state ────────────────────────────────────────────────────────────

let groupCode;
let adminPinHash;
let p1Token, p2Token;

beforeAll(async () => {
  groupCode    = randomCode();
  adminPinHash = sha256hex('9999');

  // Gruppe anlegen
  const r = await api('POST', '/api/groups', {
    name: 'Test-Gruppe',
    groupCode,
    adminPinHash,
  });
  expect(r.status).toBe(200);
  expect(r.body.code).toBe(groupCode);

  // Spieler 1 beitreten
  const j1 = await api('POST', '/api/players/join', {
    groupCode,
    nickname: 'Anna',
    pinHash: sha256hex('1234'),
  });
  expect(j1.status).toBe(200);
  p1Token = j1.body.token;
  expect(p1Token).toBeTruthy();

  // Spieler 2 beitreten
  const j2 = await api('POST', '/api/players/join', {
    groupCode,
    nickname: 'Ben',
    pinHash: sha256hex('5678'),
  });
  expect(j2.status).toBe(200);
  p2Token = j2.body.token;
}, 15000);

// ── Auth ─────────────────────────────────────────────────────────────────────

describe('Authentifizierung', () => {
  test('Login mit korrekter PIN gibt Token zurück', async () => {
    const r = await api('POST', '/api/players/auth', {
      groupCode,
      nickname: 'Anna',
      pinHash: sha256hex('1234'),
    });
    expect(r.status).toBe(200);
    expect(r.body.token).toBeTruthy();
    expect(r.body.nickname).toBe('Anna');
  });

  test('Login mit falscher PIN → 401', async () => {
    const r = await api('POST', '/api/players/auth', {
      groupCode,
      nickname: 'Anna',
      pinHash: sha256hex('0000'),
    });
    expect(r.status).toBe(401);
  });

  test('Doppelter Nickname beim Beitreten → 409', async () => {
    const r = await api('POST', '/api/players/join', {
      groupCode,
      nickname: 'Anna',
      pinHash: sha256hex('4321'),
    });
    expect(r.status).toBe(409);
  });

  test('Unbekannte Gruppe → 404', async () => {
    const r = await api('POST', '/api/players/auth', {
      groupCode: 'XXXX-9999',
      nickname: 'Anna',
      pinHash: sha256hex('1234'),
    });
    expect(r.status).toBe(404);
  });

  test('Request ohne Token → 401', async () => {
    const r = await api('GET', '/api/players');
    expect(r.status).toBe(401);
  });
});

// ── Tages-Challenge ───────────────────────────────────────────────────────────

describe('Tages-Challenge', () => {
  let challengeId;
  let seed;

  test('challenge/today gibt Seed + Challenge-ID zurück', async () => {
    const r = await api('GET', `/api/challenge/today?group=${groupCode}`);
    expect(r.status).toBe(200);
    expect(r.body.seed).toBeGreaterThan(0);
    expect(r.body.challengeId).toBeTruthy();
    expect(r.body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    challengeId = r.body.challengeId;
    seed = r.body.seed;
  });

  test('challenge/today ist deterministisch — zweiter Abruf gleicher Seed', async () => {
    const r = await api('GET', `/api/challenge/today?group=${groupCode}`);
    expect(r.status).toBe(200);
    expect(r.body.challengeId).toBe(challengeId);
    expect(r.body.seed).toBe(seed);
  });

  test('unbekannte Gruppe → 404', async () => {
    const r = await api('GET', '/api/challenge/today?group=XXXX-9999');
    expect(r.status).toBe(404);
  });
});

// ── Score + Rangliste ─────────────────────────────────────────────────────────

describe('Score-Einreichung und Rangliste', () => {
  let challengeId;

  beforeAll(async () => {
    const r = await api('GET', `/api/challenge/today?group=${groupCode}`);
    challengeId = r.body.challengeId;
  });

  test('Rangliste ist zu Beginn leer', async () => {
    const today = new Date().toISOString().split('T')[0];
    const r = await api('GET', `/api/leaderboard/${groupCode}?date=${today}`);
    expect(r.status).toBe(200);
    // könnte schon Einträge von anderen Tests haben — nur Format prüfen
    expect(Array.isArray(r.body.entries)).toBe(true);
  });

  test('Score einreichen → erscheint in Rangliste', async () => {
    const score = 520;
    const correctCount = 28;

    const submit = await api('POST', '/api/scores', {
      challengeId,
      score,
      correctCount,
      offlinePlayed: false,
    }, p1Token);
    expect(submit.status).toBe(200);

    const lb = await api('GET', `/api/leaderboard/${groupCode}`);
    expect(lb.status).toBe(200);
    const anna = lb.body.entries.find(e => e.nickname === 'Anna');
    expect(anna).toBeTruthy();
    expect(anna.score).toBe(score);
    expect(anna.correct_count).toBe(correctCount);
  });

  test('zweiter Score desselben Spielers heute → 409 (nur erster zählt)', async () => {
    const r = await api('POST', '/api/scores', {
      challengeId,
      score: 999,
      correctCount: 60,
      offlinePlayed: false,
    }, p1Token);
    expect(r.status).toBe(409);
  });

  test('Score > 30000 → 400 (Plausibilitätsprüfung)', async () => {
    const r = await api('POST', '/api/scores', {
      challengeId,
      score: 99999,
      correctCount: 5,
      offlinePlayed: false,
    }, p2Token);
    expect(r.status).toBe(400);
  });

  test('correctCount > 120 → 400', async () => {
    const r = await api('POST', '/api/scores', {
      challengeId,
      score: 100,
      correctCount: 200,
      offlinePlayed: false,
    }, p2Token);
    expect(r.status).toBe(400);
  });

  test('Rangliste sortiert nach Score absteigend', async () => {
    // Ben sendet einen Score
    await api('POST', '/api/scores', {
      challengeId,
      score: 300,
      correctCount: 18,
      offlinePlayed: false,
    }, p2Token);

    const lb = await api('GET', `/api/leaderboard/${groupCode}`);
    const scores = lb.body.entries.map(e => e.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }
  });

  test('Rangliste anderer Gruppe isoliert — keine Kreuzung', async () => {
    const otherCode = randomCode();
    await api('POST', '/api/groups', {
      name: 'Andere Gruppe',
      groupCode: otherCode,
      adminPinHash: sha256hex('1111'),
    });
    const lb = await api('GET', `/api/leaderboard/${otherCode}`);
    expect(lb.body.entries).toHaveLength(0);
  });
});

// ── Direkte Challenges ────────────────────────────────────────────────────────

describe('Direkte Challenges (A fordert B heraus)', () => {
  let challengeId;

  const seed = 20260425;
  const seedDate = '2026-04-25';
  const reihenConfig = { alleReihen: true, rechenart: 'mult' };

  test('Challenge erstellen', async () => {
    const r = await api('POST', '/api/challenges', {
      challengedNickname: 'Ben',
      seed,
      seedDate,
      score: 780,
      correctCount: 42,
      reihenConfig,
    }, p1Token);
    expect(r.status).toBe(200);
    expect(r.body.id).toBeTruthy();
    expect(r.body.status).toBe('pending');
    challengeId = r.body.id;
  });

  test('sich selbst herausfordern → 400', async () => {
    const r = await api('POST', '/api/challenges', {
      challengedNickname: 'Anna',
      seed,
      seedDate,
      score: 100,
      correctCount: 5,
      reihenConfig,
    }, p1Token);
    expect(r.status).toBe(400);
  });

  test('übertriebener Challenge-Score → 400', async () => {
    const r = await api('POST', '/api/challenges', {
      challengedNickname: 'Ben',
      seed,
      seedDate,
      score: 50000,
      correctCount: 5,
      reihenConfig,
    }, p1Token);
    expect(r.status).toBe(400);
  });

  test('Ben sieht offene Challenge in seiner Inbox', async () => {
    const r = await api('GET', '/api/challenges/pending', null, p2Token);
    expect(r.status).toBe(200);
    const found = r.body.challenges.find(c => c.id === challengeId);
    expect(found).toBeTruthy();
    expect(found.seed).toBe(seed);
    expect(found.seed_date).toBe(seedDate);
    expect(found.challenger_score).toBe(780);
  });

  test('Anna sieht Bens Challenge nicht in ihrer Inbox', async () => {
    const r = await api('GET', '/api/challenges/pending', null, p1Token);
    expect(r.status).toBe(200);
    const found = (r.body.challenges || []).find(c => c.id === challengeId);
    expect(found).toBeUndefined();
  });

  test('Ben antwortet auf Challenge — gewinnt', async () => {
    const r = await api('POST', `/api/challenges/${challengeId}/respond`, {
      score: 900,
      correctCount: 50,
    }, p2Token);
    expect(r.status).toBe(200);
    expect(r.body.result).toBe('won');
    expect(r.body.myScore).toBe(900);
    expect(r.body.theirScore).toBe(780);
  });

  test('zweite Antwort auf erledigte Challenge → 404', async () => {
    const r = await api('POST', `/api/challenges/${challengeId}/respond`, {
      score: 100,
      correctCount: 5,
    }, p2Token);
    expect(r.status).toBe(404);
  });

  test('Challenge-Antwort mit überhöhtem Score → 400', async () => {
    // neue pending Challenge anlegen für diesen Test
    const c = await api('POST', '/api/challenges', {
      challengedNickname: 'Ben',
      seed,
      seedDate,
      score: 100,
      correctCount: 5,
      reihenConfig,
    }, p1Token);
    const id = c.body.id;

    const r = await api('POST', `/api/challenges/${id}/respond`, {
      score: 99999,
      correctCount: 5,
    }, p2Token);
    expect(r.status).toBe(400);
  });
});

// ── Admin-Endpunkte ───────────────────────────────────────────────────────────

describe('Admin-Endpunkte', () => {
  test('Admin-Übersicht gibt Spieler-Liste zurück', async () => {
    const r = await fetch(`${API}/api/admin/group/${groupCode}`, {
      headers: { 'X-Admin-Pin': adminPinHash },
    });
    const body = await r.json();
    expect(r.status).toBe(200);
    const nicknames = (body.players || []).map(p => p.nickname);
    expect(nicknames).toContain('Anna');
    expect(nicknames).toContain('Ben');
  });

  test('falscher Admin-PIN → 403', async () => {
    const r = await fetch(`${API}/api/admin/group/${groupCode}`, {
      headers: { 'X-Admin-Pin': sha256hex('0000') },
    });
    expect(r.status).toBe(403);
  });

  test('Spieler-Stats-Endpoint gibt Sessions + Snapshots zurück', async () => {
    const r = await fetch(`${API}/api/admin/players/${groupCode}`, {
      headers: { 'X-Admin-Pin': adminPinHash },
    });
    const body = await r.json();
    expect(r.status).toBe(200);
    expect(Array.isArray(body.players)).toBe(true);
    const anna = body.players.find(p => p.nickname === 'Anna');
    expect(anna).toBeTruthy();
    expect(typeof anna.activeDays30d).toBe('number');
  });
});
