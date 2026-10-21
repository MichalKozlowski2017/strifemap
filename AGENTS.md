<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# War News — agent rules

Do not undo the decisions below unless Michał explicitly asks.

## App & git

- Next.js app lives at `~/Sites/warnews`.
- Live: https://warnews-eight.vercel.app
- GitHub: https://github.com/MichalKozlowski2017/warnews
- One writer. Commit and push `main` (Vercel deploys from main).

## Database

- Turso (libSQL) only. Local `data/warnews.db` only when `TURSO_*` is missing.
- Do not add Neon or Supabase.

## OpenAI

- Key stays in `.env.local` — never commit secrets, panel passwords, or API keys.
- Prefilter before any model call. Do not regenerate stored summaries.
- `gpt-4o-mini` for extract/sitrep. `gpt-4o` only for a missing stored article summary.
- Keep existing daily caps (`EXTRACT_DAILY_API_CEILING`, etc.).

## Panel

- Private: one password cookie, no accounts.
- No panel link in the public header.

## UI / i18n

- Full PL and EN via cookie; default PL.
- Polish UI must not show raw English RSS titles as body copy.

## Time & map UX (locked)

- Day stepper is the only time control. Do not add 24h / 3d / 7d ranges.
- **Country selection stays off.** No polygons, chips, country card, or `?country=` on the interaction path. Removed because select/clear were too slow. Restore only if Michał asks.
- Expanded incident = same photo + stored article summary as the news article, plus a separate source link.
- Cluster/pin popup closes when the pointer leaves (short grace only to cross from pin onto the list). Tap outside closes on touch.

## News

- Own page (`/news`). No empty image cards.
- Incidents with a real photo also appear in News, deduped by source URL. Incident list stays.

## Map quality

- Pins need location + confidence. Unverified without 2+ sources stay off the main map.

## Crons

- Run on Vercel, not on the local `npm run dev` server.
