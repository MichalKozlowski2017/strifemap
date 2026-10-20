import { getDb } from "@/lib/db/client";
import { newId, nowIso } from "@/lib/utils/id";

export async function startJob(kind: string): Promise<{ id: string }> {
  const db = getDb();
  const id = newId();
  await db.execute({
    sql: `INSERT INTO generation_jobs (id, kind, status, started_at) VALUES (?, ?, 'running', ?)`,
    args: [id, kind, nowIso()],
  });
  return { id };
}

export async function finishJob(
  id: string,
  status: "completed" | "failed",
  meta?: Record<string, unknown>,
  error?: string,
): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `UPDATE generation_jobs SET status = ?, finished_at = ?, meta = ?, error = ? WHERE id = ?`,
    args: [
      status,
      nowIso(),
      meta ? JSON.stringify(meta) : null,
      error ?? null,
      id,
    ],
  });
}

/** Keep last 200 jobs; delete older finished ones. */
export async function rotateJobs(keep = 200): Promise<number> {
  const db = getDb();
  const result = await db.execute({
    sql: `
      DELETE FROM generation_jobs
      WHERE id IN (
        SELECT id FROM generation_jobs
        ORDER BY started_at DESC
        LIMIT -1 OFFSET ?
      )
    `,
    args: [keep],
  });
  return result.rowsAffected;
}
