/**
 * Verify map incidents appear in /news with real images; home incident list stays.
 * Run: node scripts/verify-incidents-in-news.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.WN_BASE || "https://warnews-eight.vercel.app";
const DATE = process.env.WN_DATE || "2026-10-21";

const results = [];
function ok(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Home: collect incident list titles / ids from accordion
  await page.goto(`${BASE}/?date=${DATE}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(2500);

  const home = await page.evaluate(() => {
    const incidentHeading = [...document.querySelectorAll("h2")].find((h) =>
      /Incydenty|Incidents/i.test(h.textContent || ""),
    );
    const section = incidentHeading?.closest("section") || incidentHeading?.parentElement;
    const titles = section
      ? [...section.querySelectorAll("button p.font-medium, button .font-medium, li button p")].map(
          (el) => (el.textContent || "").trim(),
        )
      : [];
    // fallback: all accordion buttons under Incydenty
    const lis = section ? [...section.querySelectorAll("ul > li")] : [];
    const itemTitles = lis.map((li) => {
      const ps = [...li.querySelectorAll("p")];
      return (ps[1]?.textContent || ps[0]?.textContent || "").trim();
    });
    return {
      incidentCount: lis.length || titles.length,
      titles: (itemTitles.length ? itemTitles : titles).filter(Boolean).slice(0, 12),
    };
  });
  ok("home incident list present", home.incidentCount >= 1, `count=${home.incidentCount}`);

  // /news: find at least one card whose title matches an incident, with real img
  await page.goto(`${BASE}/news?date=${DATE}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(3500);

  const news = await page.evaluate((incidentTitles) => {
    const normalize = (s) =>
      s
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const incNorm = incidentTitles.map(normalize).filter((t) => t.length > 12);

    const cards = [];
    // lead + list
    document.querySelectorAll("article, li").forEach((el) => {
      const img = el.querySelector("img");
      const h = el.querySelector("h2, h3, a span, a");
      const title = (h?.textContent || "").trim();
      if (!img || !title || title.length < 8) return;
      const src = img.getAttribute("src") || "";
      if (!src || src.startsWith("data:")) return;
      cards.push({ title, src: src.slice(0, 120) });
    });

    const match = cards.find((c) => {
      const nt = normalize(c.title);
      return incNorm.some(
        (it) =>
          nt.includes(it.slice(0, 28)) ||
          it.includes(nt.slice(0, 28)) ||
          nt.split(" ").slice(0, 5).join(" ") === it.split(" ").slice(0, 5).join(" "),
      );
    });

    return {
      cardCount: cards.length,
      match: match || null,
      sample: cards.slice(0, 5).map((c) => c.title.slice(0, 60)),
    };
  }, home.titles);

  ok("news page has items with images", news.cardCount >= 1, `cards=${news.cardCount}`);
  ok(
    "at least one incident appears on /news with image",
    Boolean(news.match),
    news.match
      ? `${news.match.title.slice(0, 70)} | ${news.match.src}`
      : `no match; samples=${JSON.stringify(news.sample)} incidents=${JSON.stringify(home.titles.slice(0, 3))}`,
  );

  // Open matched article if found — large image
  if (news.match) {
    const href = await page.evaluate((titleSlice) => {
      const links = [...document.querySelectorAll("a[href*='/news/']")];
      const hit = links.find((a) => (a.textContent || "").includes(titleSlice.slice(0, 40)));
      return hit?.getAttribute("href") || null;
    }, news.match.title);
    if (href) {
      await page.goto(new URL(href, BASE).toString(), {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(1500);
      const articleImg = await page.locator("article img").first().getAttribute("src");
      ok(
        "article view has real image",
        Boolean(articleImg && !articleImg.startsWith("data:")),
        articleImg?.slice(0, 100) || "none",
      );
    } else {
      ok("article view has real image", false, "no href");
    }
  }

  // Re-check home list still there after news
  await page.goto(`${BASE}/?date=${DATE}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(2000);
  const still = await page.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((el) =>
      /Incydenty|Incidents/i.test(el.textContent || ""),
    );
    const section = h?.closest("section");
    return section ? section.querySelectorAll("ul > li").length : 0;
  });
  ok("home incident list still listed", still >= 1, `count=${still}`);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log("\n---");
console.log(
  `TOTAL ${results.length}  PASS ${results.length - failed.length}  FAIL ${failed.length}`,
);
if (failed.length) process.exit(1);
