import { getDb } from "@/lib/db/client";
import { getOpenAI, hasOpenAI, modelName } from "@/lib/ai/client";
import { sitrepSchema } from "@/lib/ai/schemas";
import { newId, nowIso } from "@/lib/utils/id";

export async function generateDailySitreps(): Promise<{
  theaters: number;
  created: number;
  skippedNoKey: boolean;
  skippedNoIncidents: number;
}> {
  if (!hasOpenAI()) {
    return {
      theaters: 0,
      created: 0,
      skippedNoKey: true,
      skippedNoIncidents: 0,
    };
  }

  const openai = getOpenAI()!;
  const db = getDb();
  const theaters = await db.execute(
    `SELECT id, slug, name_pl, name_en FROM theaters ORDER BY sort`,
  );

  const since = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
  let created = 0;
  let skippedNoIncidents = 0;

  for (const t of theaters.rows) {
    const incidents = await db.execute({
      sql: `
        SELECT title, summary, title_pl, title_en, summary_pl, summary_en,
               type, confidence, occurred_at, status
        FROM incidents
        WHERE theater_id = ?
          AND status IN ('approved', 'published')
          AND occurred_at >= ?
        ORDER BY occurred_at DESC
        LIMIT 20
      `,
      args: [t.id, since],
    });

    if (incidents.rows.length === 0) {
      skippedNoIncidents += 1;
      continue;
    }

    const completion = await openai.chat.completions.create({
      model: modelName(),
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You write concise daily sitreps for a conflict intelligence hub.
Return JSON with headline_pl, headline_en, body_pl, body_en, key_points_pl[], key_points_en[].
Always fill BOTH languages. Analytical tone. Do not invent incidents not in the input.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            theater: { slug: t.slug, name_pl: t.name_pl, name_en: t.name_en },
            incidents: incidents.rows.map((r) => ({
              title_pl: r.title_pl ?? r.title,
              title_en: r.title_en ?? r.title,
              summary_pl: r.summary_pl ?? r.summary,
              summary_en: r.summary_en ?? r.summary,
              type: r.type,
              confidence: r.confidence,
              occurred_at: r.occurred_at,
            })),
          }),
        },
      ],
    });

    const rawText = completion.choices[0]?.message?.content ?? "{}";
    const parsed = sitrepSchema.safeParse(JSON.parse(rawText));
    if (!parsed.success) continue;

    const content = {
      ...parsed.data,
      markdown_pl: `## ${parsed.data.headline_pl}\n\n${parsed.data.body_pl}\n\n${parsed.data.key_points_pl.map((p) => `- ${p}`).join("\n")}`,
      markdown_en: `## ${parsed.data.headline_en}\n\n${parsed.data.body_en}\n\n${parsed.data.key_points_en.map((p) => `- ${p}`).join("\n")}`,
    };

    await db.execute({
      sql: `INSERT INTO briefs (id, theater_id, kind, lang, content, created_at) VALUES (?, ?, 'daily_sitrep', 'pl-en', ?, ?)`,
      args: [newId(), t.id, JSON.stringify(content), nowIso()],
    });
    created += 1;
  }

  return {
    theaters: theaters.rows.length,
    created,
    skippedNoKey: false,
    skippedNoIncidents,
  };
}
