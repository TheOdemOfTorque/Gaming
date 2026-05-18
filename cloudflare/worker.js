export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Player-Token, X-Admin-Pin',
    };

    if (method === 'OPTIONS') return new Response(null, { headers: cors });

    try {
      const res = await route(request, url, method, path, env);
      const headers = new Headers(res.headers);
      for (const [k, v] of Object.entries(cors)) headers.set(k, v);
      return new Response(res.body, { status: res.status, headers });
    } catch (err) {
      return json({ error: err.message }, err.status || 500, cors);
    }
  }
};

// ── Utilities ─────────────────────────────────────────────────────────────

function uuid() {
  return crypto.randomUUID();
}

function now() {
  return Math.floor(Date.now() / 1000);
}

async function createToken(playerId, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const ts = Date.now();
  const msg = `${playerId}:${ts}`;
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  const hmac = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${msg}:${hmac}`;
}

async function verifyToken(token, secret) {
  if (!token) return null;
  const parts = token.split(':');
  if (parts.length !== 3) return null;
  const [playerId, ts, sig] = parts;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const expected = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${playerId}:${ts}`));
  const expectedSig = btoa(String.fromCharCode(...new Uint8Array(expected)));
  if (sig !== expectedSig) return null;
  return playerId;
}

async function getBody(request) {
  return request.json().catch(() => ({}));
}

function todayUTC() {
  return new Date().toISOString().split('T')[0];
}

// ── Auth middleware ────────────────────────────────────────────────────────

async function requirePlayer(request, env) {
  const token = request.headers.get('X-Player-Token');
  const playerId = await verifyToken(token, env.TOKEN_SECRET);
  if (!playerId) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  const player = await env.DB.prepare('SELECT id, group_id FROM players WHERE id = ?').bind(playerId).first();
  if (!player) throw Object.assign(new Error('Player not found'), { status: 404 });
  return player;
}

async function requireAdmin(request, env, groupCode) {
  const adminPinHash = request.headers.get('X-Admin-Pin');
  if (!adminPinHash) throw Object.assign(new Error('Admin PIN required'), { status: 401 });
  const group = await env.DB.prepare('SELECT id, admin_pin_hash, name FROM groups WHERE code = ?')
    .bind(groupCode.toUpperCase()).first();
  if (!group) throw Object.assign(new Error('Group not found'), { status: 404 });
  if (group.admin_pin_hash !== adminPinHash) {
    throw Object.assign(new Error('Invalid admin PIN'), { status: 403 });
  }
  return group;
}

// ── Handlers ──────────────────────────────────────────────────────────────

async function handleCreateGroup(request, env) {
  const { name, groupCode, adminPinHash } = await getBody(request);
  if (!name || !groupCode || !adminPinHash) {
    return json({ error: 'name, groupCode, adminPinHash required' }, 400);
  }
  const code = groupCode.toUpperCase();
  const existing = await env.DB.prepare('SELECT id FROM groups WHERE code = ?').bind(code).first();
  if (existing) return json({ error: 'Group code already taken' }, 409);

  const id = uuid();
  await env.DB.prepare(
    'INSERT INTO groups (id, code, name, admin_pin_hash, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, code, name, adminPinHash, now()).run();

  return json({ id, code, name });
}

async function handlePlayerJoin(request, env) {
  const { groupCode, nickname, pinHash } = await getBody(request);
  if (!groupCode || !nickname || !pinHash) {
    return json({ error: 'groupCode, nickname, pinHash required' }, 400);
  }
  const group = await env.DB.prepare('SELECT id FROM groups WHERE code = ?')
    .bind(groupCode.toUpperCase()).first();
  if (!group) return json({ error: 'Group not found' }, 404);

  const existing = await env.DB.prepare(
    'SELECT id FROM players WHERE group_id = ? AND nickname = ?'
  ).bind(group.id, nickname).first();
  if (existing) return json({ error: 'Nickname already taken in this group' }, 409);

  const id = uuid();
  await env.DB.prepare(
    'INSERT INTO players (id, group_id, nickname, pin_hash, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, group.id, nickname, pinHash, now()).run();

  const token = await createToken(id, env.TOKEN_SECRET);
  return json({ id, nickname, groupCode: groupCode.toUpperCase(), token });
}

async function handlePlayerAuth(request, env) {
  const { groupCode, nickname, pinHash } = await getBody(request);
  if (!groupCode || !nickname || !pinHash) {
    return json({ error: 'groupCode, nickname, pinHash required' }, 400);
  }
  const group = await env.DB.prepare('SELECT id FROM groups WHERE code = ?')
    .bind(groupCode.toUpperCase()).first();
  if (!group) return json({ error: 'Group not found' }, 404);

  const player = await env.DB.prepare(
    'SELECT id, pin_hash FROM players WHERE group_id = ? AND nickname = ?'
  ).bind(group.id, nickname).first();
  if (!player || player.pin_hash !== pinHash) {
    return json({ error: 'Invalid nickname or PIN' }, 401);
  }

  const token = await createToken(player.id, env.TOKEN_SECRET);
  return json({ id: player.id, nickname, groupCode: groupCode.toUpperCase(), token });
}

async function handleGetChallenge(url, env) {
  const groupCode = url.searchParams.get('group');
  if (!groupCode) return json({ error: 'group param required' }, 400);

  const group = await env.DB.prepare('SELECT id FROM groups WHERE code = ?')
    .bind(groupCode.toUpperCase()).first();
  if (!group) return json({ error: 'Group not found' }, 404);

  const date = todayUTC();
  let challenge = await env.DB.prepare(
    'SELECT id, seed, reihen_config FROM challenges WHERE group_id = ? AND date = ?'
  ).bind(group.id, date).first();

  if (!challenge) {
    const seed = parseInt(date.replace(/-/g, ''), 10);
    const reihenConfig = JSON.stringify({ alleReihen: true, rechenart: 'mult' });
    const id = uuid();
    await env.DB.prepare(
      'INSERT INTO challenges (id, group_id, date, seed, reihen_config) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, group.id, date, seed, reihenConfig).run();
    challenge = { id, seed, reihen_config: reihenConfig };
  }

  return json({
    challengeId: challenge.id,
    date,
    seed: challenge.seed,
    reihenConfig: JSON.parse(challenge.reihen_config),
  });
}

async function handlePostScore(request, env) {
  const { id: playerId } = await requirePlayer(request, env);
  const { challengeId, score, correctCount, offlinePlayed } = await getBody(request);
  if (!challengeId || score == null || correctCount == null) {
    return json({ error: 'challengeId, score, correctCount required' }, 400);
  }
  if (correctCount > 120 || score > 30000) {
    return json({ error: 'Score implausible' }, 400);
  }

  const id = uuid();
  try {
    await env.DB.prepare(
      `INSERT INTO scores (id, player_id, challenge_id, score, correct_count, submitted_at, offline_played)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, playerId, challengeId, score, correctCount, now(), offlinePlayed ? 1 : 0).run();
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return json({ error: 'Score already submitted for today' }, 409);
    }
    throw e;
  }

  return json({ id, score, correctCount });
}

async function handleLeaderboard(url, path, env) {
  const groupCode = path.split('/api/leaderboard/')[1]?.toUpperCase();
  if (!groupCode) return json({ error: 'groupCode required' }, 400);

  const group = await env.DB.prepare('SELECT id FROM groups WHERE code = ?').bind(groupCode).first();
  if (!group) return json({ error: 'Group not found' }, 404);

  const date = url.searchParams.get('date') || todayUTC();

  const rows = await env.DB.prepare(`
    SELECT p.nickname, s.score, s.correct_count, s.offline_played, s.submitted_at
    FROM scores s
    JOIN players p ON p.id = s.player_id
    JOIN challenges c ON c.id = s.challenge_id
    WHERE c.group_id = ? AND c.date = ?
    ORDER BY s.score DESC
  `).bind(group.id, date).all();

  return json({ date, groupCode, entries: rows.results });
}

async function handlePostProgress(request, env) {
  const { id: playerId } = await requirePlayer(request, env);
  const { reiheStats } = await getBody(request);
  if (!reiheStats || typeof reiheStats !== 'object') {
    return json({ error: 'reiheStats object required' }, 400);
  }

  const id = uuid();
  await env.DB.prepare(
    'INSERT INTO progress_snapshots (id, player_id, snapshotted_at, reihe_stats) VALUES (?, ?, ?, ?)'
  ).bind(id, playerId, now(), JSON.stringify(reiheStats)).run();

  return json({ id });
}

async function handlePostSession(request, env) {
  const { id: playerId } = await requirePlayer(request, env);
  const { gameMode, durationS } = await getBody(request);
  if (!gameMode || durationS == null) {
    return json({ error: 'gameMode, durationS required' }, 400);
  }
  if (!['blitz', 'turnier', 'training'].includes(gameMode)) {
    return json({ error: 'gameMode must be blitz, turnier, or training' }, 400);
  }

  const id = uuid();
  await env.DB.prepare(
    'INSERT INTO session_events (id, player_id, game_mode, duration_s, played_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, playerId, gameMode, durationS, now()).run();

  return json({ id });
}

async function handleAdmin(request, url, path, method, env) {
  if (method === 'GET' && path.startsWith('/api/admin/group/')) {
    const code = path.split('/api/admin/group/')[1];
    const group = await requireAdmin(request, env, code);
    const players = await env.DB.prepare(
      'SELECT id, nickname, created_at FROM players WHERE group_id = ? ORDER BY created_at'
    ).bind(group.id).all();
    return json({ code: code.toUpperCase(), name: group.name, players: players.results });
  }

  if (method === 'GET' && path.startsWith('/api/admin/players/')) {
    const code = path.split('/api/admin/players/')[1];
    const group = await requireAdmin(request, env, code);
    const sevenDaysAgo = now() - 7 * 24 * 3600;

    const players = await env.DB.prepare(
      'SELECT id, nickname FROM players WHERE group_id = ? ORDER BY nickname'
    ).bind(group.id).all();

    const result = [];
    for (const p of players.results) {
      const snap = await env.DB.prepare(
        'SELECT reihe_stats FROM progress_snapshots WHERE player_id = ? ORDER BY snapshotted_at DESC LIMIT 1'
      ).bind(p.id).first();

      const sessions = await env.DB.prepare(
        `SELECT game_mode, SUM(duration_s) as total_s, COUNT(*) as count
         FROM session_events WHERE player_id = ? AND played_at > ?
         GROUP BY game_mode`
      ).bind(p.id, sevenDaysAgo).all();

      const thirtyDaysAgo = now() - 30 * 24 * 3600;
      const streakData = await env.DB.prepare(
        `SELECT COUNT(DISTINCT date(played_at, 'unixepoch')) as days
         FROM session_events WHERE player_id = ? AND played_at > ?`
      ).bind(p.id, thirtyDaysAgo).first();

      result.push({
        id: p.id,
        nickname: p.nickname,
        reiheStats: snap ? JSON.parse(snap.reihe_stats) : null,
        sessions7d: sessions.results,
        activeDays30d: streakData?.days ?? 0,
      });
    }
    return json({ players: result });
  }

  if (method === 'DELETE' && path.startsWith('/api/admin/group/')) {
    const code = path.split('/api/admin/group/')[1];
    if (!code) return json({ error: 'group code required' }, 400);
    return handleDeleteGroup(request, env, code);
  }

  if (method === 'DELETE' && path.startsWith('/api/admin/players/')) {
    const playerId = path.split('/api/admin/players/')[1];
    const code = url.searchParams.get('group');
    if (!code) return json({ error: 'group query param required for auth' }, 400);
    await requireAdmin(request, env, code);
    await env.DB.prepare('DELETE FROM session_events WHERE player_id = ?').bind(playerId).run();
    await env.DB.prepare('DELETE FROM progress_snapshots WHERE player_id = ?').bind(playerId).run();
    await env.DB.prepare('DELETE FROM scores WHERE player_id = ?').bind(playerId).run();
    await env.DB.prepare('DELETE FROM players WHERE id = ?').bind(playerId).run();
    return json({ deleted: playerId });
  }

  if (method === 'DELETE' && path.startsWith('/api/admin/scores/')) {
    const code = path.split('/api/admin/scores/')[1];
    const group = await requireAdmin(request, env, code);
    const date = url.searchParams.get('date') || todayUTC();
    const challenge = await env.DB.prepare(
      'SELECT id FROM challenges WHERE group_id = ? AND date = ?'
    ).bind(group.id, date).first();
    if (!challenge) return json({ deleted: 0 });
    const result = await env.DB.prepare(
      'DELETE FROM scores WHERE challenge_id = ?'
    ).bind(challenge.id).run();
    return json({ deleted: result.meta.changes, date });
  }

  return json({ error: 'Not Found' }, 404);
}

// ── Direct Challenges ─────────────────────────────────────────────────────

async function handleGetGroupPlayers(request, env) {
  const player = await requirePlayer(request, env);
  const rows = await env.DB.prepare(
    'SELECT nickname FROM players WHERE group_id = ? AND id != ? ORDER BY nickname'
  ).bind(player.group_id, player.id).all();
  return json({ players: rows.results });
}

async function handleCreateDirectChallenge(request, env) {
  const player = await requirePlayer(request, env);
  const { challengedNickname, seed, seedDate, score, correctCount, reihenConfig } = await getBody(request);
  if (!challengedNickname || seed == null || !seedDate || score == null || correctCount == null) {
    return json({ error: 'challengedNickname, seed, seedDate, score, correctCount required' }, 400);
  }
  if (correctCount > 120 || score > 30000) {
    return json({ error: 'Score implausible' }, 400);
  }
  const challenged = await env.DB.prepare(
    'SELECT id FROM players WHERE group_id = ? AND nickname = ?'
  ).bind(player.group_id, challengedNickname).first();
  if (!challenged) return json({ error: 'Player not found in group' }, 404);
  if (challenged.id === player.id) return json({ error: 'Cannot challenge yourself' }, 400);

  const id = uuid();
  const configJson = JSON.stringify(reihenConfig || { alleReihen: true, rechenart: 'mult' });
  await env.DB.prepare(
    `INSERT INTO direct_challenges
     (id, group_id, challenger_id, challenged_id, seed, seed_date, reihen_config, challenger_score, challenger_correct, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, player.group_id, player.id, challenged.id, seed, seedDate, configJson, score, correctCount, now()).run();
  return json({ id, status: 'pending' });
}

async function handleGetPendingChallenges(request, env) {
  const player = await requirePlayer(request, env);
  const rows = await env.DB.prepare(
    `SELECT dc.id, dc.seed, dc.seed_date, dc.reihen_config, dc.challenger_score, dc.challenger_correct, dc.created_at,
            p.nickname AS challenger_nickname
     FROM direct_challenges dc
     JOIN players p ON p.id = dc.challenger_id
     WHERE dc.challenged_id = ? AND dc.status = 'pending'
     ORDER BY dc.created_at DESC`
  ).bind(player.id).all();
  // reihen_config ist JSON-String — parsen für den Client
  const challenges = (rows.results || []).map(c => ({
    ...c,
    reihen_config: JSON.parse(c.reihen_config || '{"alleReihen":true,"rechenart":"mult"}'),
  }));
  return json({ challenges });
}

async function handleRespondToChallenge(request, path, env) {
  const player = await requirePlayer(request, env);
  const id = path.split('/api/challenges/')[1].replace('/respond', '');
  const { score, correctCount } = await getBody(request);
  if (score == null || correctCount == null) return json({ error: 'score, correctCount required' }, 400);
  if (correctCount > 120 || score > 30000) return json({ error: 'Score implausible' }, 400);

  const challenge = await env.DB.prepare(
    'SELECT * FROM direct_challenges WHERE id = ? AND challenged_id = ? AND status = ?'
  ).bind(id, player.id, 'pending').first();
  if (!challenge) return json({ error: 'Challenge not found or already completed' }, 404);

  await env.DB.prepare(
    `UPDATE direct_challenges
     SET challenged_score = ?, challenged_correct = ?, status = 'completed', responded_at = ?
     WHERE id = ?`
  ).bind(score, correctCount, now(), id).run();

  const won = score > challenge.challenger_score;
  const tied = score === challenge.challenger_score;
  return json({
    result: won ? 'won' : tied ? 'tied' : 'lost',
    myScore: score,
    theirScore: challenge.challenger_score,
    myCorrect: correctCount,
    theirCorrect: challenge.challenger_correct,
  });
}

async function route(request, url, method, path, env) {
  if (method === 'POST' && path === '/api/groups')               return handleCreateGroup(request, env);
  if (method === 'POST' && path === '/api/players/join')         return handlePlayerJoin(request, env);
  if (method === 'POST' && path === '/api/players/auth')         return handlePlayerAuth(request, env);
  if (method === 'GET'  && path === '/api/challenge/today')      return handleGetChallenge(url, env);
  if (method === 'POST' && path === '/api/scores')               return handlePostScore(request, env);
  if (method === 'GET'  && path.startsWith('/api/leaderboard/')) return handleLeaderboard(url, path, env);
  if (method === 'POST' && path === '/api/progress')                          return handlePostProgress(request, env);
  if (method === 'POST' && path === '/api/sessions')                          return handlePostSession(request, env);
  if (method === 'GET'  && path === '/api/players')                           return handleGetGroupPlayers(request, env);
  if (method === 'POST' && path === '/api/challenges')                        return handleCreateDirectChallenge(request, env);
  if (method === 'GET'  && path === '/api/challenges/pending')                return handleGetPendingChallenges(request, env);
  if (method === 'POST' && path.startsWith('/api/challenges/') && path.endsWith('/respond')) return handleRespondToChallenge(request, path, env);
  if (path.startsWith('/api/admin/'))                                         return handleAdmin(request, url, path, method, env);
  return json({ error: 'Not Found' }, 404);
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}
