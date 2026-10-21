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

async function findClusterHover(page, box) {
  // Sweep the map for a cluster popup (Ukraine area tends to cluster).
  const points = [];
  for (let y = 0.25; y <= 0.75; y += 0.08) {
    for (let x = 0.35; x <= 0.75; x += 0.08) {
      points.push({ x: box.x + box.width * x, y: box.y + box.height * y });
    }
  }
  for (const p of points) {
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(120);
    const open = await page.locator(".wn-hover-popup").filter({
      hasText: /Incydenty w klastrze|Incidents in cluster/i,
    }).count();
    if (open > 0) return p;
  }
  return null;
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/?date=${DATE}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForSelector(".maplibregl-canvas", { timeout: 45000 });
  await page.waitForTimeout(3500);

  const box = await page.locator(".maplibregl-canvas").boundingBox();
  const clusterPt = await findClusterHover(page, box);
  ok("found cluster popup by hover", Boolean(clusterPt), JSON.stringify(clusterPt));

  if (clusterPt) {
    // Ensure open
    await page.mouse.move(clusterPt.x, clusterPt.y);
    await page.waitForTimeout(400);
    const popup = page.locator(".wn-hover-popup").filter({
      hasText: /Incydenty w klastrze|Incidents in cluster/i,
    });
    await popup.waitFor({ state: "visible", timeout: 5000 });
    const popupBox = await popup.boundingBox();
    ok("cluster popup visible", Boolean(popupBox), JSON.stringify(popupBox));

    if (popupBox) {
      // Move onto the list (grace path) — must stay open
      await page.mouse.move(
        popupBox.x + popupBox.width / 2,
        popupBox.y + Math.min(40, popupBox.height / 3),
        { steps: 8 },
      );
      await page.waitForTimeout(500);
      const still = await popup.count();
      ok("stays open on popup list", still >= 1, `count=${still}`);

      const item = popup.locator("button").first();
      const itemCount = await item.count();
      ok("list item present", itemCount >= 1, `items=${itemCount}`);
      if (itemCount) {
        // Clickability without dismissing mid-hover
        await item.hover();
        await page.waitForTimeout(200);
        ok(
          "still open while over item",
          (await popup.count()) >= 1,
          "",
        );
      }

      // Leave popup entirely
      await page.mouse.move(box.x + 20, box.y + 20, { steps: 6 });
      await page.waitForTimeout(700);
      const gone = await popup.count();
      ok("closes after leaving popup", gone === 0, `count=${gone}`);
    }

    // Touch: reopen via click on cluster, tap outside closes
    await page.mouse.click(clusterPt.x, clusterPt.y);
    await page.waitForTimeout(600);
    const reopened = await page.locator(".wn-hover-popup").filter({
      hasText: /Incydenty w klastrze|Incidents in cluster/i,
    }).count();
    ok("tap cluster opens list", reopened >= 1, `count=${reopened}`);
    await page.mouse.click(box.x + 30, box.y + 30);
    await page.waitForTimeout(400);
    const closed = await page.locator(".wn-hover-popup").filter({
      hasText: /Incydenty w klastrze|Incidents in cluster/i,
    }).count();
    ok("tap outside closes", closed === 0, `count=${closed}`);
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
