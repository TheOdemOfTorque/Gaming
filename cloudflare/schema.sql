CREATE TABLE IF NOT EXISTS groups (
  id           TEXT PRIMARY KEY,
  code         TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  admin_pin_hash TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id           TEXT PRIMARY KEY,
  group_id     TEXT NOT NULL REFERENCES groups(id),
  nickname     TEXT NOT NULL,
  pin_hash     TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  UNIQUE(group_id, nickname)
);

CREATE TABLE IF NOT EXISTS challenges (
  id           TEXT PRIMARY KEY,
  group_id     TEXT NOT NULL REFERENCES groups(id),
  date         TEXT NOT NULL,
  seed         INTEGER NOT NULL,
  reihen_config TEXT NOT NULL,
  UNIQUE(group_id, date)
);

CREATE TABLE IF NOT EXISTS scores (
  id           TEXT PRIMARY KEY,
  player_id    TEXT NOT NULL REFERENCES players(id),
  challenge_id TEXT NOT NULL REFERENCES challenges(id),
  score        INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  submitted_at INTEGER NOT NULL,
  offline_played INTEGER DEFAULT 0,
  UNIQUE(player_id, challenge_id)
);

CREATE TABLE IF NOT EXISTS progress_snapshots (
  id              TEXT PRIMARY KEY,
  player_id       TEXT NOT NULL REFERENCES players(id),
  snapshotted_at  INTEGER NOT NULL,
  reihe_stats     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_events (
  id           TEXT PRIMARY KEY,
  player_id    TEXT NOT NULL REFERENCES players(id),
  game_mode    TEXT NOT NULL,
  duration_s   INTEGER NOT NULL,
  played_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS direct_challenges (
  id                  TEXT PRIMARY KEY,
  group_id            TEXT NOT NULL REFERENCES groups(id),
  challenger_id       TEXT NOT NULL REFERENCES players(id),
  challenged_id       TEXT NOT NULL REFERENCES players(id),
  seed                INTEGER NOT NULL,
  seed_date           TEXT NOT NULL,
  challenger_score    INTEGER NOT NULL,
  challenger_correct  INTEGER NOT NULL,
  challenged_score    INTEGER,
  challenged_correct  INTEGER,
  status              TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'completed'
  created_at          INTEGER NOT NULL,
  responded_at        INTEGER
);
