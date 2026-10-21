# Strife Map

Global conflict intelligence hub: **theaters → incidents on a map → AI briefs**.

Stack: Next.js (App Router) · Tailwind · Turso/libSQL (SQLite fallback) · MapLibre · OpenAI (`gpt-4o-mini`, optional Ollama).

## Quick start (local SQLite)

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Seed data places published, map-eligible incidents on the home map — no OpenAI key required for the demo.

## Environment

Copy `.env.example` → `.env.local`:

| Variable | Required | Notes |
|---|---|---|
| `TURSO_DATABASE_URL` | No | Unset → `file:./data/warnews.db` |
| `TURSO_AUTH_TOKEN` | With Turso | Turso auth token |
| `OPENAI_API_KEY` | No | Without it, `/api/cron/extract` and `/api/cron/sitrep` skip gracefully |
| `OPENAI_MODEL` | No | Default `gpt-4o-mini` |
| `OPENAI_BASE_URL` | No | e.g. `http://127.0.0.1:11434/v1` for Ollama |
| `CRON_SECRET` | Prod | `Authorization: Bearer …` or `?secret=` |
| `PANEL_PASSWORD` | Prod (panel) | Admin password for `/panel` (HttpOnly session cookie) |
| `RAW_BODY_RETENTION_DAYS` | No | Default `5` (strip raw bodies after process) |

## Scripts

| Script | Purpose |
|---|---|
| `npm run db:migrate` | Apply `src/lib/db/schema.sql` |
| `npm run db:seed` | 6 theaters, ~12 RSS sources, sample incidents + EU sitrep |
| `npm run dev` | Next.js dev server |
| `npm run build` / `start` | Production |
| `npm run lint` | ESLint |

## Cron API (protect with `CRON_SECRET` in production)

| Route | Job |
|---|---|
| `GET/POST /api/cron/ingest` | RSS batch ingest, dedupe by `content_hash` |
| `GET/POST /api/cron/extract` | Raw → Zod incident JSON (OpenAI) |
| `GET/POST /api/cron/sitrep` | Daily sitrep per theater |
| `GET/POST /api/cron/cleanup` | Strip old raw bodies; rotate jobs |

`vercel.json` schedules these crons optionally.

## Product surface

- `/` — full-bleed MapLibre world map (last 72h published / map-eligible)
- `/api/geojson` — cached GeoJSON (`Cache-Control` / s-maxage)
- `/t/[slug]` — theater sitrep + list + focused map (Europe-hybrid callout)
- `/panel` — toggle sources, raw queue, approve/reject (password-protected; login at `/panel/login`)

### Quality gate

Unverified without 2+ sources **or** missing lat/lng → not `map_eligible` (stays in review).

## Theaters

`ukraine-russia` · `middle-east` · `africa` · `indo-pacific` · `europe-hybrid` · `americas`
