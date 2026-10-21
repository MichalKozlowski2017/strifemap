/**
 * One-shot extract against Turso (.env.local). Does not print secrets.
 */
import fs from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const p = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [k, ...rest] = line.split("=");
    if (!process.env[k]) process.env[k] = rest.join("=").trim();
  }
}

async function main() {
  loadEnvLocal();
  if (!process.env.EXTRACT_DAILY_API_CEILING) {
    process.env.EXTRACT_DAILY_API_CEILING = "200";
  }
  const { extractIncidents } = await import("../src/lib/ai/extract");
  const { finishJob, startJob } = await import("../src/lib/cron/jobs");
  const job = await startJob("extract");
  try {
    const result = await extractIncidents();
    await finishJob(job.id, "completed", result);
    console.log(JSON.stringify(result));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await finishJob(job.id, "failed", undefined, message);
    console.error(message);
    process.exit(1);
  }
}

main();
