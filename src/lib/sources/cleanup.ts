import { getDb } from "@/lib/db/client";
import { rotateJobs } from "@/lib/cron/jobs";

const BODY_RETENTION_DAYS = Number(process.env.RAW_BODY_RETENTION_DAYS ?? 5);

/**
 * Strip body from processed raw_events older than N days; keep url + hash.
 * Also rotate generation_jobs.
 */
export async function cleanupRawEvents(): Promise<{
  stripped: number;
  jobsRotated: number;
  retentionDays: number;
}> {
  const db = getDb();
  const cutoff = new Date(
    Date.now() - BODY_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const strip = await db.execute({
    sql: `
      UPDATE raw_events
      SET body = NULL
      WHERE body IS NOT NULL
        AND status = 'processed'
        AND processed_at IS NOT NULL
        AND processed_at < ?
    `,
    args: [cutoff],
  });

  const jobsRotated = await rotateJobs(200);

  return {
    stripped: strip.rowsAffected,
    jobsRotated,
    retentionDays: BODY_RETENTION_DAYS,
  };
}
