/**
 * Cluster/pin hover popup: stay while crossing onto list; close after leave.
 * Run: node scripts/verify-popup-dismiss.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.WN_BASE || "https://warnews-eight.vercel.app";
const DATE = process.env.WN_DATE || "2026-10-21";

const results = [];
function ok(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function clusterScreenPoint(page) {
  return page.evaluate(() => {
    const map = window.__wnMap;
    if (!map) return null;
    const canvas = map.getCanvas();
    const rect = canvas.getBoundingClientRect();
    const w = canvas.width;
    const h = canvas.height;
    for (let y = 30; y < h - 30; y += 28) {
      for (let x = 30; x < w - 30; x += 28) {
        const feats = map.queryRenderedFeatures([x, y], {
          layers: ["clusters"],
        });
        if (feats.length) {
          return {
            x: rect.left + (x * rect.width) / w,
            y: rect.top + (y * rect.height) / h,
            count: feats[0].properties?.point_count,
          };
        }
      }
    }
    return null;
  });
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/?date=${DATE}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForSelector(".maplibregl-canvas", { timeout: 45000 });
  await page.waitForFunction(() => Boolean(window.__wnMap), { timeout: 20000 });
  await page.waitForTimeout(2000);

  const box = await page.locator(".maplibregl-canvas").boundingBox();
  let clusterPt = await clusterScreenPoint(page);
  // If fully zoomed with no clusters, zoom out once and retry
  if (!clusterPt) {
    await page.evaluate(() => {
      const m = window.__wnMap;
      if (m) m.easeTo({ zoom: Math.min(m.getZoom(), 3.2), duration: 0 });
    });
    await page.waitForTimeout(800);
    clusterPt = await clusterScreenPoint(page);
  }
  ok("found cluster on map", Boolean(clusterPt), JSON.stringify(clusterPt));

  if (clusterPt) {
    await page.mouse.move(clusterPt.x, clusterPt.y);
    await page.waitForTimeout(500);
    const popup = page.locator(".wn-hover-popup").filter({
      hasText: /Incydenty w klastrze|Incidents in cluster/i,
    });
    await popup.waitFor({ state: "visible", timeout: 8000 });
    const popupBox = await popup.boundingBox();
    ok("cluster popup visible", Boolean(popupBox), JSON.stringify(popupBox));

    if (popupBox) {
      await page.mouse.move(
        popupBox.x + popupBox.width / 2,
        popupBox.y + Math.min(48, popupBox.height / 3),
        { steps: 10 },
      );
      await page.waitForTimeout(550);
      ok("stays open on popup list", (await popup.count()) >= 1, "");

      const item = popup.locator("button").first();
      ok("list item present", (await item.count()) >= 1, "");
      if (await item.count()) {
        await item.hover();
        await page.waitForTimeout(250);
        ok("still open while over item", (await popup.count()) >= 1, "");
      }

      await page.mouse.move(box.x + 24, box.y + 24, { steps: 8 });
      await page.waitForTimeout(750);
      ok("closes after leaving popup", (await popup.count()) === 0, "");
    }

    await page.mouse.click(clusterPt.x, clusterPt.y);
    await page.waitForTimeout(700);
    ok(
      "tap cluster opens list",
      (await page
        .locator(".wn-hover-popup")
        .filter({ hasText: /Incydenty w klastrze|Incidents in cluster/i })
        .count()) >= 1,
      "",
    );
    await page.mouse.click(box.x + 28, box.y + 28);
    await page.waitForTimeout(450);
    ok(
      "tap outside closes",
      (await page
        .locator(".wn-hover-popup")
        .filter({ hasText: /Incydenty w klastrze|Incidents in cluster/i })
        .count()) === 0,
      "",
    );
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log("\n---");
console.log(
  `TOTAL ${results.length}  PASS ${results.length - failed.length}  FAIL ${failed.length}`,
);
if (failed.length) process.exit(1);
