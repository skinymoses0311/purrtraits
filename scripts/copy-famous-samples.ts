/**
 * Copy first-placement-per-artwork images from a showcase batch into
 * public/samples/famous/<slug>.jpg, resizing each to 800px wide. One-shot
 * helper — leaves the script in scripts/ for future re-runs against new
 * batches.
 *
 *   tsx scripts/copy-famous-samples.ts <batchId>
 *
 * The batch directory is resolved under
 *   C:\Users\rjsan\claudeprojects\coworkprojects\Purrtraits\example-dogs-output\<batchId>\images
 * which is where scripts/showcase-render.ts writes its outputs.
 */

import sharp from "sharp";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { ARTWORKS_CATALOG } from "../convex/artworksCatalog.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");

const batchId = process.argv[2];
if (!batchId) {
  console.error("Usage: tsx scripts/copy-famous-samples.ts <batchId>");
  process.exit(1);
}

const BATCH_DIR = join(
  "C:\\Users\\rjsan\\claudeprojects\\coworkprojects\\Purrtraits\\example-dogs-output",
  batchId,
  "images",
);
const OUT_DIR = join(PROJECT_ROOT, "public", "samples", "famous");

if (!existsSync(BATCH_DIR)) {
  console.error(`Batch images dir missing: ${BATCH_DIR}`);
  process.exit(1);
}
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const missing: string[] = [];
const done: string[] = [];

for (const art of ARTWORKS_CATALOG) {
  const firstPlacement = art.placements[0].slug;
  const srcName = `artwork_${art.slug}__${firstPlacement}.jpg`;
  const srcPath = join(BATCH_DIR, srcName);
  const outPath = join(OUT_DIR, `${art.slug}.jpg`);
  if (!existsSync(srcPath)) {
    missing.push(srcName);
    continue;
  }
  const buf = readFileSync(srcPath);
  const out = await sharp(buf)
    .resize({ width: 800, withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
  writeFileSync(outPath, out);
  const m = await sharp(out).metadata();
  done.push(`${art.slug}.jpg ${m.width}x${m.height} (${(out.length / 1024).toFixed(0)} KB)`);
}

console.log(`Copied + resized ${done.length}:`);
for (const d of done) console.log(`  ${d}`);
if (missing.length) {
  console.log(`\nMISSING in batch (${missing.length}):`);
  for (const m of missing) console.log(`  ${m}`);
  process.exit(1);
}
