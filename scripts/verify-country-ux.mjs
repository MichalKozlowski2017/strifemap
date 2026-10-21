/**
 * Post-deploy check: desktop + 390px country UX fixes.
 * Run: node scripts/verify-country-ux.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.WN_BASE || "https://warnews-eight.vercel.app";
const OUT = "/tmp/wn-country-ux";
mkdirSync(OUT, { recursive: true });

const results = [];
function ok(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function mercProject(lng, lat, center, zoom, width, height) {
  const world = 512 * 2 ** zoom;
  const mercX = (L) => ((L + 180) / 360) * world;
  const mercY = (La) => {
    const s = Math.sin((La * Math.PI) / 180);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * world;
  };
  return {
    x: mercX(lng) - mercX(center.lng) + width / 2,
    y: mercY(lat) - mercY(center.lat) + height / 2,
  };
}

async function waitMap(page) {
  await page.waitForSelector(".maplibregl-canvas", { timeout: 45000 });
  await page.waitForTimeout(2800);
}

async function goLight(page) {
  const styleReqs = [];
  const onReq = (req) => {
    const u = req.url();
    if (u.includes("basemaps.cartocdn.com") || u.includes("positron") || u.includes("dark-matter")) {
      styleReqs.push(u);
    }
  };
  page.on("request", onReq);
  await page.getByRole("button", { name: /Jasny motyw|Light theme/i }).click();
  await page.waitForTimeout(3500);
  page.off("request", onReq);
  const htmlLight = await page.evaluate(
    () => document.documentElement.classList.contains("light"),
  );
  const positron = styleReqs.some((u) => /positron/i.test(u));
  return { htmlLight, positron, styleReqs: styleReqs.slice(-6) };
}

async function runDesktop(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/?date=2026-10-21`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await waitMap(page);

  await page.getByRole("button", { name: /Ukraina/i }).first().click();
  await page.waitForURL(/country=UA/, { timeout: 10000 });
  await page.waitForTimeout(900);

  const dayBrief = await page.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((el) =>
      /Dzień w skrócie|Day in brief/i.test(el.textContent || ""),
    );
    return h?.parentElement?.innerText || "";
  });
  ok(
    "desktop UA brief scoped",
    /Ukrain/i.test(dayBrief) && /7/.test(dayBrief) && !/^Dzień[\s\S]*\n10\s/m.test(dayBrief),
    dayBrief.split("\n").slice(0, 4).join(" | "),
  );

  const listItems = await page.locator("section").filter({ has: page.getByRole("heading", { name: /Incydenty|Incidents/i }) }).locator("ul > li").count();
  ok("desktop UA incident list", listItems >= 1 && listItems <= 7, `items=${listItems}`);

  const clears = await page.locator("[data-wn-clear-country]").count();
  ok("desktop one Wyczyść", clears === 1, `count=${clears}`);

  const cardText = await page.locator("aside").first().innerText();
  ok(
    "desktop display date",
    !cardText.includes("2026-10-21") && /października|October/i.test(cardText),
    cardText.match(/[^\n]*2026[^\n]*/)?.[0] ?? cardText.slice(0, 60),
  );

  const light = await goLight(page);
  ok("desktop light class", light.htmlLight, JSON.stringify(light));
  ok("desktop light positron", light.positron, JSON.stringify(light.styleReqs));

  await page.screenshot({ path: `${OUT}/desktop-ua-light.png` });
  await page.close();
}

async function runMobile(browser) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  await page.goto(`${BASE}/?date=2026-10-21`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await waitMap(page);

  const chrome = await page.evaluate(() => {
    const mapRect = document.querySelector(".maplibregl-canvas")?.getBoundingClientRect();
    if (!mapRect) return { err: "no canvas" };
    const overlapping = [...document.querySelectorAll("[data-wn-map-chrome]")].filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.height < 40 || r.width < 80) return false;
      return r.top < mapRect.bottom && r.bottom > mapRect.top;
    });
    return {
      mapH: mapRect.height,
      overlapping: overlapping.map((el) => (el.textContent || "").slice(0, 40)),
    };
  });
  ok(
    "mobile map not covered by chips/legend",
    (chrome.overlapping || []).length === 0,
    JSON.stringify(chrome),
  );

  const box = await page.locator(".maplibregl-canvas").boundingBox();
  const local = mercProject(19.1, 52.1, { lng: 25, lat: 35 }, 2.2, box.width, box.height);
  ok(
    "mobile Poland in default map frame",
    local.x >= 8 && local.x <= box.width - 8 && local.y >= 8 && local.y <= box.height - 8,
    JSON.stringify(local),
  );
  await page.touchscreen.tap(box.x + local.x, box.y + local.y);
  await page.waitForTimeout(1800);
  const url = page.url();
  ok("mobile tap Poland → country=PL", /country=PL/i.test(url), url);
  const empty = await page.getByText(/Tego dnia brak sygnałów|No signals this day/i).count();
  ok("mobile PL empty signals", empty >= 1, `empty=${empty}`);

  await page.locator("[data-wn-clear-country]").first().click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /Ukraina/i }).first().click();
  await page.waitForURL(/country=UA/, { timeout: 10000 });
  await page.waitForTimeout(900);

  const dayBrief = await page.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((el) =>
      /Dzień w skrócie|Day in brief/i.test(el.textContent || ""),
    );
    return h?.parentElement?.innerText || "";
  });
  ok(
    "mobile UA brief scoped",
    /Ukrain/i.test(dayBrief) && !/\n10\s/.test(dayBrief),
    dayBrief.split("\n").slice(0, 4).join(" | "),
  );

  const clears = await page.locator("[data-wn-clear-country]").count();
  ok("mobile one Wyczyść", clears === 1, `count=${clears}`);

  const light = await goLight(page);
  ok("mobile light class", light.htmlLight, JSON.stringify({ htmlLight: light.htmlLight }));
  ok("mobile light positron", light.positron, JSON.stringify(light.styleReqs));

  await page.screenshot({ path: `${OUT}/mobile-ua-light.png` });
  await page.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await runDesktop(browser);
  await runMobile(browser);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log("\n---");
console.log(
  `TOTAL ${results.length}  PASS ${results.length - failed.length}  FAIL ${failed.length}`,
);
if (failed.length) process.exit(1);
