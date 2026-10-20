-- War News schema (Turso / libSQL / SQLite)

CREATE TABLE IF NOT EXISTS theaters (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_pl TEXT NOT NULL,
  name_en TEXT NOT NULL,
  center_lat REAL,
  center_lng REAL,
  bbox_west REAL,
  bbox_south REAL,
  bbox_east REAL,
  bbox_north REAL,
  sort INTEGER NOT NULL DEFAULT 0,
  description_pl TEXT,
  description_en TEXT
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'rss',
  theater_id TEXT REFERENCES theaters(id),
  enabled INTEGER NOT NULL DEFAULT 1,
  trust_weight REAL NOT NULL DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS raw_events (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  image_url TEXT,
  content_hash TEXT NOT NULL UNIQUE,
  fetched_at TEXT NOT NULL,
  processed_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_raw_events_status ON raw_events(status);
CREATE INDEX IF NOT EXISTS idx_raw_events_hash ON raw_events(content_hash);
CREATE INDEX IF NOT EXISTS idx_raw_events_fetched ON raw_events(fetched_at);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  theater_id TEXT NOT NULL REFERENCES theaters(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  title_pl TEXT,
  title_en TEXT,
  summary_pl TEXT,
  summary_en TEXT,
  lat REAL,
  lng REAL,
  occurred_at TEXT NOT NULL,
  confidence TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  map_eligible INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incidents_map ON incidents(status, map_eligible, occurred_at);
CREATE INDEX IF NOT EXISTS idx_incidents_theater ON incidents(theater_id, occurred_at);

CREATE TABLE IF NOT EXISTS incident_sources (
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  raw_event_id TEXT NOT NULL REFERENCES raw_events(id) ON DELETE CASCADE,
  PRIMARY KEY (incident_id, raw_event_id)
);

CREATE TABLE IF NOT EXISTS briefs (
  id TEXT PRIMARY KEY,
  theater_id TEXT NOT NULL REFERENCES theaters(id),
  kind TEXT NOT NULL,
  lang TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  for_date TEXT
);

CREATE INDEX IF NOT EXISTS idx_briefs_theater ON briefs(theater_id, kind, created_at);
CREATE INDEX IF NOT EXISTS idx_briefs_day ON briefs(theater_id, kind, for_date);

CREATE TABLE IF NOT EXISTS generation_jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  meta TEXT,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_started ON generation_jobs(started_at);
