/**
 * Confirm country selection is gone and map interaction stays snappy.
 * Run: node scripts/verify-no-country-select.mjs
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

  const t0 = Date.now();
  await page.goto(`${BASE}/?date=${DATE}&country=UA`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForSelector(".maplibregl-canvas", { timeout: 45000 });
  const loadMs = Date.now() - t0;

  // Country param should be stripped
  await page.waitForTimeout(1200);
  const url = page.url();
  ok("strips ?country=", !/[?&]country=/i.test(url), url);

  // No country chrome
  const chrome = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasWyczysc: /Wyczyść|Clear country/i.test(text),
      hasUkrainaChip: /\bUkraina\s*\d/i.test(text),
      hasCountryCard: Boolean(
        document.querySelector("[data-wn-clear-country]"),
      ),
      hasCountriesSource: Boolean(
        document.querySelector(".maplibregl-map") &&
          // maplibre sources aren't in DOM; check network later
          false,
      ),
      outlineLayers: [...document.querySelectorAll("canvas")].length,
    };
  });
  ok("no Wyczyść / country card", !chrome.hasWyczysc && !chrome.hasCountryCard, JSON.stringify(chrome));
  ok("no country chip row", !chrome.hasUkrainaChip, JSON.stringify(chrome));

  // No countries geojson fetch
  const geoReqs = [];
  page.on("request", (req) => {
    if (/countries-110m|country/i.test(req.url())) geoReqs.push(req.url());
  });
  await page.reload({ waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1500);
  ok(
    "no countries-110m fetch",
    !geoReqs.some((u) => /countries-110m/i.test(u)),
    geoReqs.join(" | ") || "none",
  );

  // Map click should be fast (pin or empty) — no multi-second hang
  const box = await page.locator(".maplibregl-canvas").boundingBox();
  const clickStart = Date.now();
  await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.45);
  await page.waitForTimeout(200);
  const clickMs = Date.now() - clickStart;
  ok("map click returns quickly", clickMs < 1500, `clickMs=${clickMs}`);

  // Accordion still works
  const firstIncident = page.locator("section").filter({ has: page.getByRole("heading", { name: /Incydenty|Incidents/i }) }).locator("ul > li button").first();
  if (await firstIncident.count()) {
    const a0 = Date.now();
    await firstIncident.click();
    await page.waitForTimeout(150);
    const accordionOpen = await page.locator('[data-open="true"]').count();
    const aMs = Date.now() - a0;
    ok("accordion opens quickly", accordionOpen >= 1 && aMs < 2000, `aMs=${aMs} open=${accordionOpen}`);
  } else {
    ok("accordion opens quickly", false, "no incidents");
  }

  // Day view still present
  const hasBrief = await page.getByRole("heading", { name: /Dzień w skrócie|Day in brief/i }).count();
  const hasNews = await page.getByRole("heading", { name: /Wiadomości|News/i }).count();
  ok("day brief + news wall", hasBrief >= 1 && hasNews >= 1, `brief=${hasBrief} news=${hasNews}`);

  ok("home load under 20s", loadMs < 20000, `loadMs=${loadMs}`);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log("\n---");
console.log(
  `TOTAL ${results.length}  PASS ${results.length - failed.length}  FAIL ${failed.length}`,
);
if (failed.length) process.exit(1);
