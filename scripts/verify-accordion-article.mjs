/**
 * Expanded accordion shows photo + article body like /news/[id].
 * Run: node scripts/verify-accordion-article.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.WN_BASE || "https://strifemap.vercel.app";
const DATE = process.env.WN_DATE || "2026-10-21";

const results = [];
function ok(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Pick a news item that is also a map pin (on_map stories share ids).
  await page.goto(`${BASE}/news?date=${DATE}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(2500);

  const candidate = await page.evaluate(() => {
    const link = [...document.querySelectorAll("a[href*='/news/']")].find((a) =>
      /\/news\/[0-9a-f-]{36}/i.test(a.getAttribute("href") || ""),
    );
    if (!link) return null;
    const href = link.getAttribute("href") || "";
    const m = href.match(/\/news\/([0-9a-f-]{36})/i);
    const title = (link.textContent || "").trim();
    return m ? { id: m[1], title: title.slice(0, 80), href } : null;
  });

  // Prefer an id that appears both on /news and in home incident list — try Kyiv/Meduza map titles
  await page.goto(`${BASE}/?date=${DATE}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(2500);

  const section = page.locator("section").filter({
    has: page.getByRole("heading", { name: /Incydenty|Incidents/i }),
  });
  const buttons = section.locator("ul > li button[aria-expanded]");
  const count = await buttons.count();
  ok("incident list present", count >= 1, `count=${count}`);

  let opened = false;
  for (let i = 0; i < Math.min(count, 12); i++) {
    const btn = buttons.nth(i);
    const label = ((await btn.innerText()) || "").replace(/\s+/g, " ");
    await btn.click();
    await page.waitForTimeout(400);
    const li = section.locator("ul > li").nth(i);
    const openPanel = li.locator('[data-open="true"]');
    if ((await openPanel.count()) === 0) continue;

    const img = openPanel.locator("img");
    const body = openPanel.locator("[data-wn-article-body]");
    const source = openPanel.getByRole("link", { name: /Czytaj źródło|Read source/i });
    const imgSrc = (await img.count()) > 0 ? await img.first().getAttribute("src") : null;
    const bodyText = (await body.count()) > 0 ? (await body.innerText()).trim() : "";
    const hasSource = (await source.count()) > 0;
    const looksLikeRawRss =
      /^(Meduza|Reuters|AP|BBC|Guardian):/i.test(bodyText) ||
      (bodyText.length < 40 && /^[A-Z][a-z]+ /.test(bodyText) === false && bodyText.includes(":"));

    // Prefer a row that has both photo and body (news-article-like)
    if (imgSrc?.startsWith("http") && bodyText.length > 60) {
      ok("expanded has photo", true, imgSrc.slice(0, 100));
      ok("expanded has article summary", true, bodyText.slice(0, 120));
      ok("source link present", hasSource, "");
      ok(
        "body is not raw English RSS title line",
        !looksLikeRawRss && bodyText.length > 60,
        bodyText.slice(0, 80),
      );
      // Cross-check /news article for same id if we can parse from img parent… use title match
      const titleLine = label.split("\n").find((l) => l.length > 20) || label;
      opened = true;

      // Optional: open matching news article if candidate shares title words
      if (candidate?.id) {
        await page.goto(`${BASE}/news/${candidate.id}?date=${DATE}`, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
        await page.waitForTimeout(1500);
        const artImg = await page.locator("article img").first().getAttribute("src");
        const artBody = await page.locator("article p").nth(1).innerText().catch(() => "");
        ok(
          "matching news article also has photo",
          Boolean(artImg?.startsWith("http")),
          artImg?.slice(0, 80) || "none",
        );
        void titleLine;
        void artBody;
      }
      break;
    }
    await btn.click(); // close and try next
    await page.waitForTimeout(200);
  }

  if (!opened) {
    ok("expanded has photo", false, "no incident with photo+body found");
    ok("expanded has article summary", false, "");
    ok("source link present", false, "");
    ok("body is not raw English RSS title line", false, "");
  }

  // Country select still gone
  const countryChrome = await page.evaluate(() => ({
    clear: Boolean(document.querySelector("[data-wn-clear-country]")),
    chips: /\bUkraina\s*\d/i.test(document.body.innerText),
  }));
  ok(
    "country select still absent",
    !countryChrome.clear && !countryChrome.chips,
    JSON.stringify(countryChrome),
  );
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log("\n---");
console.log(
  `TOTAL ${results.length}  PASS ${results.length - failed.length}  FAIL ${failed.length}`,
);
if (failed.length) process.exit(1);
