import type { Client } from "@libsql/client";
import { getDb } from "@/lib/db/client";
import { CATALOG_SOURCES } from "@/lib/sources/catalog";
import { titleSimilarity } from "@/lib/sources/normalize";

export type QaCheck = {
  id: string;
  ok: boolean;
  detail: string;
  severity: "info" | "warn" | "fail";
};

export type QaReport = {
  ok: boolean;
  checked_at: string;
  checks: QaCheck[];
};

/** Core QA checks — usable from cron or CLI scripts. */
export async function runQaChecks(db: Client): Promise<QaReport> {
  const checks: QaCheck[] = [];

  const sources = await db.execute(
    `SELECT COUNT(*) AS c FROM sources WHERE enabled = 1`,
  );
  const sourceCount = Number(sources.rows[0].c);
  const minSources = Math.max(8, Math.floor(CATALOG_SOURCES.length * 0.6));
  checks.push({
    id: "source_count",
    ok: sourceCount >= minSources,
    detail: `enabled_sources=${sourceCount} (min ${minSources}, catalog ${CATALOG_SOURCES.length})`,
    severity: sourceCount >= minSources ? "info" : "fail",
  });

  const byType = await db.execute(
    `SELECT type, COUNT(*) AS c FROM sources WHERE enabled = 1 GROUP BY type`,
  );
  const typeMap = Object.fromEntries(
    byType.rows.map((r) => [String(r.type), Number(r.c)]),
  );
  const hasRss = (typeMap.rss ?? 0) >= 5;
  const hasGdelt = (typeMap.gdelt ?? 0) >= 1;
  checks.push({
    id: "source_types",
    ok: hasRss && hasGdelt,
    detail: `types=${JSON.stringify(typeMap)}`,
    severity: hasRss && hasGdelt ? "info" : "warn",
  });

  const pending = await db.execute(
    `SELECT COUNT(*) AS c FROM raw_events WHERE status = 'pending'`,
  );
  const pendingCount = Number(pending.rows[0].c);
  checks.push({
    id: "pending_queue",
    ok: pendingCount < 500,
    detail: `pending_raw=${pendingCount}`,
    severity:
      pendingCount < 200 ? "info" : pendingCount < 500 ? "warn" : "fail",
  });

  const recent = await db.execute({
    sql: `SELECT title FROM raw_events WHERE fetched_at >= ? ORDER BY fetched_at DESC LIMIT 120`,
    args: [new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()],
  });
  const titles = recent.rows.map((r) => String(r.title));
  let nearPairs = 0;
  let comparisons = 0;
  for (let i = 0; i < titles.length; i++) {
    for (let j = i + 1; j < Math.min(titles.length, i + 25); j++) {
      comparisons += 1;
      if (titleSimilarity(titles[i], titles[j]) >= 0.72) nearPairs += 1;
    }
  }
  const nearRate = comparisons === 0 ? 0 : nearPairs / comparisons;
  checks.push({
    id: "near_dup_rate",
    ok: nearRate < 0.08,
    detail: `near_pairs=${nearPairs}/${comparisons} rate=${nearRate.toFixed(3)}`,
    severity: nearRate < 0.05 ? "info" : nearRate < 0.08 ? "warn" : "fail",
  });

  const mapFeatures = await db.execute({
    sql: `
      SELECT COUNT(*) AS c FROM incidents
      WHERE status IN ('approved', 'published')
        AND map_eligible = 1
        AND occurred_at >= ?
    `,
    args: [new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()],
  });
  const featureCount = Number(mapFeatures.rows[0].c);
  checks.push({
    id: "geojson_features_72h",
    ok: featureCount >= 1,
    detail: `map_eligible_72h=${featureCount}`,
    severity: featureCount >= 1 ? "info" : "warn",
  });

  const failures = await db.execute({
    sql: `
      SELECT COUNT(*) AS c FROM generation_jobs
      WHERE status = 'failed' AND started_at >= ?
    `,
    args: [new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()],
  });
  const failCount = Number(failures.rows[0].c);
  checks.push({
    id: "recent_job_failures",
    ok: failCount < 5,
    detail: `failed_jobs_24h=${failCount}`,
    severity: failCount === 0 ? "info" : failCount < 5 ? "warn" : "fail",
  });

  const seedEnabled = await db.execute(
    `SELECT COUNT(*) AS c FROM sources WHERE enabled = 1 AND (name = 'War News Seed' OR url LIKE 'https://warnews.local/%')`,
  );
  const seedOn = Number(seedEnabled.rows[0].c);
  checks.push({
    id: "seed_disabled",
    ok: seedOn === 0,
    detail: `fake_seed_enabled=${seedOn}`,
    severity: seedOn === 0 ? "info" : "warn",
  });

  const ok = checks.every((c) => c.severity !== "fail");
  return { ok, checked_at: new Date().toISOString(), checks };
}

export async function runQaPipeline(): Promise<QaReport> {
  return runQaChecks(getDb());
}
