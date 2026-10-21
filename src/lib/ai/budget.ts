import { getDb } from "@/lib/db/client";

/** Max OpenAI extract calls per cron run. */
export const EXTRACT_RUN_API_CAP = Number(
  process.env.EXTRACT_RUN_API_CAP ?? 20,
);

/**
 * Max OpenAI extract calls per UTC day (sum across runs).
 * Crons fire every 2h (≤12/day); 80 exhausted by morning and left
 * afternoon map candidates stuck pending — keep headroom for the full day.
 */
export const EXTRACT_DAILY_API_CEILING = Number(
  process.env.EXTRACT_DAILY_API_CEILING ?? 200,
);

/** How many pending rows to triage (cheap) before picking API candidates. */
export const EXTRACT_TRIAGE_BATCH = Number(
  process.env.EXTRACT_TRIAGE_BATCH ?? 100,
);

export function utcDayStartIso(d = new Date()): string {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  ).toISOString();
}

/** Sum apiCalls recorded in completed extract jobs since UTC midnight. */
export async function countExtractApiCallsToday(): Promise<number> {
  const db = getDb();
  const since = utcDayStartIso();
  const r = await db.execute({
    sql: `
      SELECT meta FROM generation_jobs
      WHERE kind = 'extract' AND status = 'completed' AND started_at >= ?
    `,
    args: [since],
  });
  let total = 0;
  for (const row of r.rows) {
    if (!row.meta) continue;
    try {
      const meta = JSON.parse(String(row.meta)) as { apiCalls?: number };
      if (typeof meta.apiCalls === "number") total += meta.apiCalls;
    } catch {
      /* ignore bad meta */
    }
  }
  return total;
}

export async function remainingExtractApiBudget(): Promise<{
  usedToday: number;
  remainingToday: number;
  runCap: number;
}> {
  const usedToday = await countExtractApiCallsToday();
  const remainingToday = Math.max(0, EXTRACT_DAILY_API_CEILING - usedToday);
  return {
    usedToday,
    remainingToday,
    runCap: Math.min(EXTRACT_RUN_API_CAP, remainingToday),
  };
}
