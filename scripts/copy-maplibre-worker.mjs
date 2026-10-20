import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(
  root,
  "node_modules",
  "maplibre-gl",
  "dist",
  "maplibre-gl-worker.mjs",
);
const destDir = join(root, "public");
const dest = join(destDir, "maplibre-gl-worker.mjs");

if (!existsSync(src)) {
  console.warn(
    "[copy-maplibre-worker] maplibre-gl worker not found — skip (run npm install)",
  );
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log("[copy-maplibre-worker] wrote public/maplibre-gl-worker.mjs");
