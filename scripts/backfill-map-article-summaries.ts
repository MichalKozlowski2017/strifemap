/**
 * Cap ~15 GPT article summaries for map incidents missing both PL/EN.
 * Never overwrites existing. No secrets printed.
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
  const { ensureMissingArticleSummaries } = await import(
    "../src/lib/news/ensure-article-summaries"
  );
  const limit = Number(process.env.BACKFILL_SUMMARY_LIMIT ?? 15);
  const result = await ensureMissingArticleSummaries({
    limit,
    mapEligibleOnly: true,
  });
  console.log(
    `map-article-summaries ok=${result.ok} fail=${result.fail} cap=${Math.min(limit, 15)}`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
