import { createClient } from "@libsql/client";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

function id() {
  return randomUUID();
}
function now() {
  return new Date().toISOString();
}
function hash(...parts: string[]) {
  return createHash("sha256")
    .update(parts.map((p) => p.trim().toLowerCase()).join("|"))
    .digest("hex");
}

const THEATERS = [
  {
    slug: "ukraine-russia",
    name_pl: "Ukraina / Rosja",
    name_en: "Ukraine / Russia",
    center_lat: 49.0,
    center_lng: 32.0,
    bbox: [22, 44, 40, 53],
    sort: 1,
    description_pl: "Front wschodni, uderzenia dalekiego zasięgu, logistyka.",
    description_en: "Eastern front, deep strikes, logistics.",
  },
  {
    slug: "middle-east",
    name_pl: "Bliski Wschód",
    name_en: "Middle East",
    center_lat: 31.5,
    center_lng: 35.0,
    bbox: [24, 12, 60, 42],
    sort: 2,
    description_pl: "Izrael/Gaza/Liban, Iran, Zatoka.",
    description_en: "Israel/Gaza/Lebanon, Iran, Gulf.",
  },
  {
    slug: "africa",
    name_pl: "Afryka",
    name_en: "Africa",
    center_lat: 8.0,
    center_lng: 20.0,
    bbox: [-20, -35, 52, 38],
    sort: 3,
    description_pl: "Sahel, Róg Afryki, konflikty regionalne.",
    description_en: "Sahel, Horn of Africa, regional conflicts.",
  },
  {
    slug: "indo-pacific",
    name_pl: "Indo-Pacyfik",
    name_en: "Indo-Pacific",
    center_lat: 20.0,
    center_lng: 120.0,
    bbox: [70, -20, 180, 50],
    sort: 4,
    description_pl: "Morze Południowochińskie, Korea, Indo-Pacyfik.",
    description_en: "South China Sea, Korea, Indo-Pacific.",
  },
  {
    slug: "europe-hybrid",
    name_pl: "Europa — hybryda / sabotaż",
    name_en: "Europe — hybrid / sabotage",
    center_lat: 52.0,
    center_lng: 15.0,
    bbox: [-10, 35, 40, 72],
    sort: 5,
    description_pl:
      "Sabotaż, cyber, infrastruktura krytyczna, działania hybrydowe poza frontem UA.",
    description_en:
      "Sabotage, cyber, critical infrastructure, hybrid ops beyond the UA front.",
  },
  {
    slug: "americas",
    name_pl: "Ameryki",
    name_en: "Americas",
    center_lat: 10.0,
    center_lng: -70.0,
    bbox: [-120, -55, -30, 55],
    sort: 6,
    description_pl: "Ameryka Łacińska, Karaiby, napięcia regionalne.",
    description_en: "Latin America, Caribbean, regional tensions.",
  },
] as const;

/** Curated real public RSS feeds mapped to theaters. */
const SOURCES: {
  name: string;
  url: string;
  theater: string | null;
  trust: number;
}[] = [
  {
    name: "Kyiv Independent",
    url: "https://kyivindependent.com/news-archive/rss/",
    theater: "ukraine-russia",
    trust: 1.2,
  },
  {
    name: "BBC Europe",
    url: "https://feeds.bbci.co.uk/news/world/europe/rss.xml",
    theater: "ukraine-russia",
    trust: 1.3,
  },
  {
    name: "Al Jazeera",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
    theater: "middle-east",
    trust: 1.1,
  },
  {
    name: "Guardian Middle East",
    url: "https://www.theguardian.com/world/middleeast/rss",
    theater: "middle-east",
    trust: 1.2,
  },
  {
    name: "BBC Africa",
    url: "https://feeds.bbci.co.uk/news/world/africa/rss.xml",
    theater: "africa",
    trust: 1.2,
  },
  {
    name: "Guardian World",
    url: "https://www.theguardian.com/world/rss",
    theater: null,
    trust: 1.2,
  },
  {
    name: "BBC Asia",
    url: "https://feeds.bbci.co.uk/news/world/asia/rss.xml",
    theater: "indo-pacific",
    trust: 1.2,
  },
  {
    name: "DW World",
    url: "https://rss.dw.com/rdf/rss-en-world",
    theater: "europe-hybrid",
    trust: 1.1,
  },
  {
    name: "Euronews",
    url: "https://www.euronews.com/rss",
    theater: "europe-hybrid",
    trust: 1.0,
  },
  {
    name: "BBC US & Canada",
    url: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml",
    theater: "americas",
    trust: 1.1,
  },
  {
    name: "France 24 EN",
    url: "https://www.france24.com/en/rss",
    theater: null,
    trust: 1.1,
  },
  {
    name: "Defense News",
    url: "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml",
    theater: null,
    trust: 1.0,
  },
];

const SAMPLE_INCIDENTS: {
  theater: string;
  type: string;
  title: string;
  summary: string;
  lat: number;
  lng: number;
  confidence: string;
  hoursAgo: number;
}[] = [
  {
    theater: "ukraine-russia",
    type: "air",
    title: "Uderzenie rakietowe w okolicy Zaporoża",
    summary:
      "Doniesienia o serii uderzeń na infrastrukturę energetyczną w obwodzie zaporoskim; trwają prace naprawcze.",
    lat: 47.84,
    lng: 35.14,
    confidence: "reported",
    hoursAgo: 8,
  },
  {
    theater: "ukraine-russia",
    type: "kinetic",
    title: "Walki pozycyjne na kierunku kupiańskim",
    summary:
      "Intensywne starcia piechoty i artylerii na odcinku północno-wschodnim; linie frontu bez większych zmian.",
    lat: 49.71,
    lng: 37.62,
    confidence: "confirmed",
    hoursAgo: 14,
  },
  {
    theater: "middle-east",
    type: "air",
    title: "Wymiana ognia powietrznego nad południowym Libanem",
    summary:
      "Izraelskie uderzenia i odpowiedzi rakietowe w strefie przygranicznej; ostrzeżenia cywilne.",
    lat: 33.27,
    lng: 35.42,
    confidence: "reported",
    hoursAgo: 6,
  },
  {
    theater: "europe-hybrid",
    type: "sabotage",
    title: "Podejrzenie sabotażu kabla podmorskiego na Bałtyku",
    summary:
      "Operatorzy zgłaszają awarię łącza; służby badają możliwy akt hybrydowy. Europa-hybryda: priorytet review.",
    lat: 55.2,
    lng: 14.5,
    confidence: "unverified",
    hoursAgo: 20,
  },
  {
    theater: "europe-hybrid",
    type: "cyber",
    title: "Atak DDoS na infrastrukturę kolejową w Europie Środkowej",
    summary:
      "Krótka niedostępność systemów informacyjnych; ruch pociągów utrzymany według komunikatów operatorów.",
    lat: 52.23,
    lng: 21.01,
    confidence: "reported",
    hoursAgo: 30,
  },
  {
    theater: "africa",
    type: "kinetic",
    title: "Starcia w regionie Sahelu",
    summary:
      "Lokalne starcia z grupami zbrojnymi; ewakuacje ludności cywilnej w sąsiednich miejscowościach.",
    lat: 14.5,
    lng: 1.0,
    confidence: "reported",
    hoursAgo: 18,
  },
  {
    theater: "indo-pacific",
    type: "naval",
    title: "Manewry morskie na Morzu Południowochińskim",
    summary:
      "Zwiększona obecność jednostek marynarki; ostrzeżenia dla żeglugi cywilnej w strefie ćwiczeń.",
    lat: 15.0,
    lng: 115.0,
    confidence: "confirmed",
    hoursAgo: 40,
  },
  {
    theater: "americas",
    type: "diplomatic",
    title: "Napięcia dyplomatyczne wokół sankcji regionalnych",
    summary:
      "Seria oświadczeń rządów i zapowiedź nowych środków ograniczających; bez eskalacji militarnej.",
    lat: 10.48,
    lng: -66.9,
    confidence: "reported",
    hoursAgo: 12,
  },
];

async function main() {
  const url =
    process.env.TURSO_DATABASE_URL ??
    `file:${path.resolve(process.cwd(), "data", "warnews.db")}`;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const db = createClient({
    url,
    ...(authToken ? { authToken } : {}),
  });

  const theaterIds = new Map<string, string>();

  for (const t of THEATERS) {
    const existing = await db.execute({
      sql: `SELECT id FROM theaters WHERE slug = ?`,
      args: [t.slug],
    });
    let tid: string;
    if (existing.rows.length) {
      tid = String(existing.rows[0].id);
      await db.execute({
        sql: `UPDATE theaters SET name_pl=?, name_en=?, center_lat=?, center_lng=?,
          bbox_west=?, bbox_south=?, bbox_east=?, bbox_north=?, sort=?,
          description_pl=?, description_en=? WHERE id=?`,
        args: [
          t.name_pl,
          t.name_en,
          t.center_lat,
          t.center_lng,
          t.bbox[0],
          t.bbox[1],
          t.bbox[2],
          t.bbox[3],
          t.sort,
          t.description_pl,
          t.description_en,
          tid,
        ],
      });
    } else {
      tid = id();
      await db.execute({
        sql: `INSERT INTO theaters (
          id, slug, name_pl, name_en, center_lat, center_lng,
          bbox_west, bbox_south, bbox_east, bbox_north, sort,
          description_pl, description_en
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [
          tid,
          t.slug,
          t.name_pl,
          t.name_en,
          t.center_lat,
          t.center_lng,
          t.bbox[0],
          t.bbox[1],
          t.bbox[2],
          t.bbox[3],
          t.sort,
          t.description_pl,
          t.description_en,
        ],
      });
    }
    theaterIds.set(t.slug, tid);
  }

  for (const s of SOURCES) {
    const existing = await db.execute({
      sql: `SELECT id FROM sources WHERE url = ?`,
      args: [s.url],
    });
    const theaterId = s.theater ? theaterIds.get(s.theater)! : null;
    if (existing.rows.length) {
      await db.execute({
        sql: `UPDATE sources SET name=?, theater_id=?, enabled=1, trust_weight=? WHERE id=?`,
        args: [s.name, theaterId, s.trust, existing.rows[0].id],
      });
    } else {
      await db.execute({
        sql: `INSERT INTO sources (id, name, url, type, theater_id, enabled, trust_weight)
              VALUES (?, ?, ?, 'rss', ?, 1, ?)`,
        args: [id(), s.name, s.url, theaterId, s.trust],
      });
    }
  }

  // Demo seed incidents (approved + map_eligible) so map works without AI
  const seedSourceId = id();
  const seedSourceUrl = "https://warnews.local/seed";
  const existingSeedSrc = await db.execute({
    sql: `SELECT id FROM sources WHERE url = ?`,
    args: [seedSourceUrl],
  });
  const demoSourceId = existingSeedSrc.rows.length
    ? String(existingSeedSrc.rows[0].id)
    : seedSourceId;
  if (!existingSeedSrc.rows.length) {
    await db.execute({
      sql: `INSERT INTO sources (id, name, url, type, theater_id, enabled, trust_weight)
            VALUES (?, 'War News Seed', ?, 'rss', NULL, 0, 1.0)`,
      args: [demoSourceId, seedSourceUrl],
    });
  }

  for (const sample of SAMPLE_INCIDENTS) {
    const titleKey = `seed:${sample.title}`;
    const existing = await db.execute({
      sql: `SELECT id FROM incidents WHERE title = ?`,
      args: [sample.title],
    });
    if (existing.rows.length) continue;

    const incidentId = id();
    const rawId = id();
    const occurred = new Date(
      Date.now() - sample.hoursAgo * 60 * 60 * 1000,
    ).toISOString();
    const theaterId = theaterIds.get(sample.theater)!;
    // Sabotage sample: two sources so unverified can still be map-eligible
    const sourceCount = sample.confidence === "unverified" ? 2 : 1;
    const mapEligible =
      sample.lat != null &&
      sample.lng != null &&
      !(sample.confidence === "unverified" && sourceCount < 2)
        ? 1
        : 0;

    const rawHash = hash(titleKey, seedSourceUrl + sample.title);
    await db.execute({
      sql: `INSERT INTO raw_events (id, source_id, url, title, body, content_hash, fetched_at, processed_at, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'processed')`,
      args: [
        rawId,
        demoSourceId,
        `${seedSourceUrl}#${encodeURIComponent(sample.title)}`,
        sample.title,
        sample.summary,
        rawHash,
        now(),
        now(),
      ],
    });

    await db.execute({
      sql: `INSERT INTO incidents (
        id, theater_id, type, title, summary, lat, lng, occurred_at,
        confidence, status, map_eligible, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        incidentId,
        theaterId,
        sample.type,
        sample.title,
        sample.summary,
        sample.lat,
        sample.lng,
        occurred,
        sample.confidence,
        "published",
        mapEligible,
        now(),
        now(),
      ],
    });

    await db.execute({
      sql: `INSERT INTO incident_sources (incident_id, raw_event_id) VALUES (?, ?)`,
      args: [incidentId, rawId],
    });

    if (sample.confidence === "unverified") {
      const raw2 = id();
      await db.execute({
        sql: `INSERT INTO raw_events (id, source_id, url, title, body, content_hash, fetched_at, processed_at, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'processed')`,
        args: [
          raw2,
          demoSourceId,
          `${seedSourceUrl}#b-${encodeURIComponent(sample.title)}`,
          `${sample.title} (potwierdzenie)`,
          sample.summary,
          hash(titleKey + ":b", seedSourceUrl),
          now(),
          now(),
        ],
      });
      await db.execute({
        sql: `INSERT INTO incident_sources (incident_id, raw_event_id) VALUES (?, ?)`,
        args: [incidentId, raw2],
      });
      await db.execute({
        sql: `UPDATE incidents SET map_eligible = 1 WHERE id = ?`,
        args: [incidentId],
      });
    }
  }

  // Sample sitrep for europe-hybrid
  const euId = theaterIds.get("europe-hybrid")!;
  const existingBrief = await db.execute({
    sql: `SELECT id FROM briefs WHERE theater_id = ? AND kind = 'daily_sitrep' LIMIT 1`,
    args: [euId],
  });
  if (!existingBrief.rows.length) {
    const content = {
      headline_pl: "Europa hybrydowa: sabotaż i cyber w centrum uwagi",
      headline_en: "Europe hybrid: sabotage and cyber in focus",
      body_pl:
        "W ostatniej dobie dominują doniesienia o możliwym sabotażu infrastruktury i krótkich atakach DDoS. Brak potwierdzenia wojskowego charakteru wszystkich zdarzeń — wymagany review.",
      body_en:
        "The last day is dominated by possible infrastructure sabotage and short DDoS bursts. Military character is not confirmed for all events — review required.",
      key_points_pl: [
        "Bałtyk: awaria kabla pod obserwacją służb",
        "Europa Środkowa: DDoS na systemy kolejowe",
      ],
      key_points_en: [
        "Baltic: cable outage under investigation",
        "Central Europe: rail systems hit by DDoS",
      ],
      markdown_pl:
        "## Europa hybrydowa: sabotaż i cyber w centrum uwagi\n\nW ostatniej dobie dominują doniesienia o możliwym sabotażu infrastruktury i krótkich atakach DDoS.",
      markdown_en:
        "## Europe hybrid: sabotage and cyber in focus\n\nThe last day is dominated by possible infrastructure sabotage and short DDoS bursts.",
    };
    await db.execute({
      sql: `INSERT INTO briefs (id, theater_id, kind, lang, content, created_at) VALUES (?,?, 'daily_sitrep', 'pl-en', ?, ?)`,
      args: [id(), euId, JSON.stringify(content), now()],
    });
  }

  console.log(`Seeded OK → ${url}`);
  console.log(`Theaters: ${THEATERS.length}, sources: ${SOURCES.length}, sample incidents: ${SAMPLE_INCIDENTS.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
