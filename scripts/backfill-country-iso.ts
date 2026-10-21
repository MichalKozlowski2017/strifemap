/**
 * 1) Set country_iso from lat/lng for map incidents (point-in-polygon).
 * 2) Heuristic place-name ISO for news (map_eligible=0) missing country.
 * 3) Optional GPT for up to COUNTRY_GPT_CAP (~15) remaining news with body.
 * Never prints secrets.
 */
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { isoFromLatLng } from "../src/lib/geo/countries";
import { guessIsoFromText } from "../src/lib/geo/country-names";

const GPT_CAP = Number(process.env.COUNTRY_GPT_CAP ?? 15);

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
  const url =
    process.env.TURSO_DATABASE_URL ??
    `file:${path.resolve(process.cwd(), "data", "strifemap.db")}`;
  const db = createClient({
    url,
    ...(process.env.TURSO_AUTH_TOKEN
      ? { authToken: process.env.TURSO_AUTH_TOKEN }
      : {}),
  });

  // —— Coords → ISO ——
  const needCoords = await db.execute(`
    SELECT id, lat, lng FROM incidents
    WHERE lat IS NOT NULL AND lng IS NOT NULL
      AND (country_iso IS NULL OR trim(country_iso) = '')
  `);
  let fromCoords = 0;
  let missCoords = 0;
  for (const row of needCoords.rows) {
    const iso = isoFromLatLng(Number(row.lat), Number(row.lng));
    if (!iso) {
      missCoords += 1;
      continue;
    }
    await db.execute({
      sql: `UPDATE incidents SET country_iso = ?, updated_at = ? WHERE id = ?`,
      args: [iso, new Date().toISOString(), row.id],
    });
    fromCoords += 1;
  }
  console.log(`coords: set=${fromCoords} miss=${missCoords}`);

  // —— News heuristic place names ——
  const needNews = await db.execute(`
    SELECT id, title, title_pl, title_en, summary, summary_pl, summary_en
    FROM incidents
    WHERE map_eligible = 0
      AND (country_iso IS NULL OR trim(country_iso) = '')
  `);
  let fromPlace = 0;
  for (const row of needNews.rows) {
    const iso = guessIsoFromText(
      String(row.title_en || ""),
      String(row.title_pl || ""),
      String(row.title || ""),
      String(row.summary_en || ""),
      String(row.summary_pl || ""),
      String(row.summary || ""),
    );
    if (!iso) continue;
    await db.execute({
      sql: `UPDATE incidents SET country_iso = ?, updated_at = ? WHERE id = ?`,
      args: [iso, new Date().toISOString(), row.id],
    });
    fromPlace += 1;
  }
  console.log(`news_place: set=${fromPlace}`);

  // —— Optional GPT cap for leftover news with article summary or body ——
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key || GPT_CAP <= 0) {
    console.log("gpt: skipped");
    return;
  }

  const leftover = await db.execute({
    sql: `
      SELECT i.id, i.title, i.title_en, i.title_pl, i.summary, i.summary_en, i.summary_pl,
             i.article_summary_en, i.article_summary_pl
      FROM incidents i
      WHERE i.map_eligible = 0
        AND (i.country_iso IS NULL OR trim(i.country_iso) = '')
        AND (
          (i.article_summary_en IS NOT NULL AND trim(i.article_summary_en) != '')
          OR (i.article_summary_pl IS NOT NULL AND trim(i.article_summary_pl) != '')
        )
      ORDER BY i.occurred_at DESC
      LIMIT ?
    `,
    args: [GPT_CAP],
  });

  const openai = new OpenAI({ apiKey: key });
  let gptOk = 0;
  let gptFail = 0;
  for (const row of leftover.rows) {
    try {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Return JSON {"iso":"XX"} with ISO 3166-1 alpha-2 for the primary country this news is about, or {"iso":null} if unclear/multi.',
          },
          {
            role: "user",
            content: JSON.stringify({
              title: row.title_en || row.title_pl || row.title,
              summary:
                row.article_summary_en ||
                row.article_summary_pl ||
                row.summary_en ||
                row.summary_pl ||
                row.summary,
            }),
          },
        ],
      });
      const raw = completion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as { iso?: string | null };
      const iso = parsed.iso?.trim()?.toUpperCase();
      if (!iso || !/^[A-Z]{2}$/.test(iso)) {
        gptFail += 1;
        continue;
      }
      await db.execute({
        sql: `UPDATE incidents SET country_iso = ?, updated_at = ? WHERE id = ?`,
        args: [iso, new Date().toISOString(), row.id],
      });
      gptOk += 1;
    } catch {
      gptFail += 1;
    }
  }
  console.log(`gpt: ok=${gptOk} fail=${gptFail} cap=${GPT_CAP}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
