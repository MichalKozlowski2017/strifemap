import { getDb } from "@/lib/db/client";
import { getOpenAI, hasOpenAI, modelName } from "@/lib/ai/client";
import { sitrepSchema } from "@/lib/ai/schemas";
import { dayBoundsISO, todayISO } from "@/lib/dates";
import { getBriefForDate } from "@/lib/db/queries";
import { newId, nowIso } from "@/lib/utils/id";
import type { Brief } from "@/lib/types";

/** Generate (or return existing) bilingual sitrep for one theater + calendar day. */
export async function ensureSitrepForTheaterDay(
  theaterId: string,
  dateISO: string,
): Promise<{
  brief: Brief | null;
  created: boolean;
  skippedNoKey: boolean;
  skippedNoIncidents: boolean;
}> {
  const existing = await getBriefForDate(theaterId, dateISO);
  if (existing) {
    return {
      brief: existing,
      created: false,
      skippedNoKey: false,
      skippedNoIncidents: false,
    };
  }

  if (!hasOpenAI()) {
    return {
      brief: null,
      created: false,
      skippedNoKey: true,
      skippedNoIncidents: false,
    };
  }

  const bounds = dayBoundsISO(dateISO);
  if (!bounds) {
    return {
      brief: null,
      created: false,
      skippedNoKey: false,
      skippedNoIncidents: true,
    };
  }

  const db = getDb();
  const theater = await db.execute({
    sql: `SELECT id, slug, name_pl, name_en FROM theaters WHERE id = ?`,
    args: [theaterId],
  });
  if (!theater.rows.length) {
    return {
      brief: null,
      created: false,
      skippedNoKey: false,
      skippedNoIncidents: true,
    };
  }
  const t = theater.rows[0];

  const incidents = await db.execute({
    sql: `
      SELECT title, summary, title_pl, title_en, summary_pl, summary_en,
             type, confidence, occurred_at, status
      FROM incidents
      WHERE theater_id = ?
        AND status IN ('approved', 'published')
        AND occurred_at >= ? AND occurred_at <= ?
      ORDER BY occurred_at DESC
      LIMIT 30
    `,
    args: [theaterId, bounds.start, bounds.end],
  });

  if (incidents.rows.length === 0) {
    return {
      brief: null,
      created: false,
      skippedNoKey: false,
      skippedNoIncidents: true,
    };
  }

  const openai = getOpenAI()!;
  const completion = await openai.chat.completions.create({
    model: modelName(),
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You write concise daily sitreps for a conflict intelligence hub for a single calendar day.
Return JSON with headline_pl, headline_en, body_pl, body_en, key_points_pl[], key_points_en[].
Always fill BOTH languages. Analytical tone. Do not invent incidents not in the input.
The sitrep covers only the given for_date.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          for_date: dateISO,
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
  if (!parsed.success) {
    return {
      brief: null,
      created: false,
      skippedNoKey: false,
      skippedNoIncidents: false,
    };
  }

  const content = {
    ...parsed.data,
    for_date: dateISO,
    markdown_pl: `## ${parsed.data.headline_pl}\n\n${parsed.data.body_pl}\n\n${parsed.data.key_points_pl.map((p) => `- ${p}`).join("\n")}`,
    markdown_en: `## ${parsed.data.headline_en}\n\n${parsed.data.body_en}\n\n${parsed.data.key_points_en.map((p) => `- ${p}`).join("\n")}`,
  };

  const id = newId();
  const createdAt = nowIso();
  await db.execute({
    sql: `INSERT INTO briefs (id, theater_id, kind, lang, content, created_at, for_date)
          VALUES (?, ?, 'daily_sitrep', 'pl-en', ?, ?, ?)`,
    args: [id, theaterId, JSON.stringify(content), createdAt, dateISO],
  });

  return {
    brief: {
      id,
      theater_id: theaterId,
      kind: "daily_sitrep",
      lang: "pl-en",
      content: JSON.stringify(content),
      created_at: createdAt,
      for_date: dateISO,
    },
    created: true,
    skippedNoKey: false,
    skippedNoIncidents: false,
  };
}

/** Cron: ensure sitreps for today (and recent days with incidents missing briefs). */
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

  const db = getDb();
  const theaters = await db.execute(
    `SELECT id, slug FROM theaters ORDER BY sort`,
  );

  // Distinct local dates with published/approved incidents in the last 5 days
  const since = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  let created = 0;
  let skippedNoIncidents = 0;

  for (const t of theaters.rows) {
    const days = await db.execute({
      sql: `
        SELECT DISTINCT date(occurred_at, 'localtime') AS d
        FROM incidents
        WHERE theater_id = ?
          AND status IN ('approved', 'published')
          AND occurred_at >= ?
        ORDER BY d DESC
        LIMIT 5
      `,
      args: [t.id, since],
    });

    const dates = days.rows.map((r) => String(r.d)).filter(Boolean);
    if (dates.length === 0) {
      // still try today
      dates.push(todayISO());
    }

    let theaterHadAny = false;
    for (const dateISO of dates) {
      const result = await ensureSitrepForTheaterDay(String(t.id), dateISO);
      if (result.created) created += 1;
      if (result.skippedNoIncidents) continue;
      theaterHadAny = true;
    }
    if (!theaterHadAny) skippedNoIncidents += 1;
  }

  return {
    theaters: theaters.rows.length,
    created,
    skippedNoKey: false,
    skippedNoIncidents,
  };
}
