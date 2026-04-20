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
  return playerId;
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

async function route(request, url, method, path, env) {
  return json({ error: 'Not Found' }, 404);
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}
