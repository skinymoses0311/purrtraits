/**
 * Offline cat regression renderer for the Tab 1 fal.ts pipeline.
 *
 * Runs every cat photo in `scripts/cat-photos/` through every target style
 * (oil, watercolour, sketch) using the EXACT buildPrompt path the live
 * fal.ts action uses, with species="cat" threaded through. Writes one row
 * per (photo × style) to the `catRegressionRenders` table and produces an
 * HTML grid the operator can scan in a browser.
 *
 * ─── ARTIFACT ONLY ──────────────────────────────────────────────────────
 * This script CANNOT be exercised without FAL_KEY + cat photos on the
 * operator's machine. The operator runs it manually on staging before
 * cutover to verify the buildSpeciesPrimacy + speciesSwap changes hold up
 * across a representative sample of cat subjects.
 *
 * ─── SETUP ───────────────────────────────────────────────────────────────
 *   1. Drop 5 reference cat photos into scripts/cat-photos/ (any common
 *      image format — the script filters on extension).
 *   2. .env.local must have PUBLIC_CONVEX_URL and ARTWORKS_SEED_TOKEN —
 *      same vars the catalogue seed + matrix scripts use.
 *   3. Re-run `npx convex dev` once so convex/catRegression.ts is
 *      deployed and reachable from api.catRegression.*.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────
 *   npm run cat:regression -- --list
 *       List existing cat-regression batches with row counts.
 *
 *   npm run cat:regression
 *       Dry run. Prints the plan + cost estimate. Spends nothing.
 *
 *   npm run cat:regression -- --confirm
 *       Real run. 5 cat photos × 3 styles = 15 renders. --confirm is
 *       required so a typo can't burn money.
 *
 *   npm run cat:regression -- --confirm --batch <id>
 *       Resume an interrupted batch. Already-recorded rows are skipped.
 *
 *   npm run cat:regression -- --report <id>
 *       Regenerate the HTML from a batch's rows without rendering.
 *
 *   npm run cat:regression -- --styles oil,watercolour
 *       Restrict the style axis. Useful when iterating on a single style.
 */

import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dns from "node:dns";
import { promisify } from "node:util";
import { ConvexHttpClient } from "convex/browser";
import { config as loadEnv } from "dotenv";

import { api } from "../convex/_generated/api.js";

// ─── DNS resilience ────────────────────────────────────────────────────────
// Same shim as matrix-render.ts — some networks' OS resolver intermittently
// times out on *.convex.cloud. Bypass it via c-ares against public resolvers
// and fall back to the system resolver if that ever fails.
dns.setServers(["1.1.1.1", "8.8.8.8", "1.0.0.1"]);
const resolve4 = promisify(dns.resolve4.bind(dns));
const resolve6 = promisify(dns.resolve6.bind(dns));
const systemLookup = dns.lookup;
// @ts-expect-error — deliberately overriding the built-in lookup.
dns.lookup = (hostname: string, options: any, callback: any): void => {
  const cb = typeof options === "function" ? options : callback;
  const opts = (typeof options === "function" ? {} : options) ?? {};
  (async () => {
    try {
      let v4: string[] = [];
      let v6: string[] = [];
      try { v4 = await resolve4(hostname); } catch { /* none */ }
      try { v6 = await resolve6(hostname); } catch { /* none */ }
      const all = [
        ...v4.map((address) => ({ address, family: 4 })),
        ...v6.map((address) => ({ address, family: 6 })),
      ];
      if (all.length === 0) throw new Error(`no DNS records for ${hostname}`);
      if (opts.all) cb(null, all);
      else cb(null, all[0].address, all[0].family);
    } catch {
      systemLookup(hostname, options, callback);
    }
  })();
};

// ─── CONFIG — edit here ────────────────────────────────────────────────────
// Which styles to render. Must be a subset of STYLE_PROMPTS keys in
// convex/fal.ts. The default is the same 3 the cutover QA pass exercises.
const STYLES = ["oil", "watercolour", "sketch"];
// Rough per-render cost band for the estimate print only.
const COST_LOW = 0.03;
const COST_HIGH = 0.05;
// ───────────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");
const PHOTOS_DIR = join(PROJECT_ROOT, "scripts", "cat-photos");
const OUTPUT_DIR = join(PROJECT_ROOT, "scripts", "cat-output");

loadEnv({ path: join(PROJECT_ROOT, ".env.local") });

const CONVEX_URL = process.env.PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
const SEED_TOKEN = process.env.ARTWORKS_SEED_TOKEN;
if (!CONVEX_URL) {
  console.error("Missing PUBLIC_CONVEX_URL / CONVEX_URL in .env.local");
  process.exit(1);
}
if (!SEED_TOKEN) {
  console.error("Missing ARTWORKS_SEED_TOKEN in .env.local (must match the deployment).");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

// ─── CLI parsing ───────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function flag(name: string): boolean {
  return argv.includes(`--${name}`);
}
function flagValue(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

// ─── Types ─────────────────────────────────────────────────────────────────
type CatRow = {
  batchId: string;
  petSlug: string;
  style: string;
  imageUrl: string;
  prompt: string;
  createdAt: number;
};

type Job = { petSlug: string; style: string };

// ─── Helpers ───────────────────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

function makeBatchId(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `cat-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// Concurrency-limited worker pool.
async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, idx: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  async function next(): Promise<void> {
    const idx = cursor++;
    if (idx >= items.length) return;
    await worker(items[idx], idx);
    await next();
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => next()),
  );
}

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  attempts = 4,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        const delay = 4000 * (i + 1);
        console.warn(
          `  ↻ retry ${label} (${i + 1}/${attempts - 1}) in ${delay / 1000}s: ${(err as Error).message}`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// ─── Pet photo upload ──────────────────────────────────────────────────────
// Returns a parallel array of (slug, storageId) so we can attach the slug
// to every row in the per-batch action below.
async function uploadCatPhotos(): Promise<Array<{ slug: string; storageId: string }>> {
  if (!existsSync(PHOTOS_DIR)) {
    console.error(`Missing ${PHOTOS_DIR}. Create it and drop cat photos in.`);
    process.exit(1);
  }
  const files = readdirSync(PHOTOS_DIR).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  if (files.length === 0) {
    console.error(`No images in ${PHOTOS_DIR}. Drop cat photos in and re-run.`);
    process.exit(1);
  }
  console.log(`Uploading ${files.length} cat photo(s)...`);
  const out: Array<{ slug: string; storageId: string }> = [];
  for (const file of files) {
    const bytes = readFileSync(join(PHOTOS_DIR, file));
    const contentType = /\.png$/i.test(file)
      ? "image/png"
      : /\.webp$/i.test(file)
        ? "image/webp"
        : "image/jpeg";
    const slug = file.replace(/\.(jpe?g|png|webp)$/i, "");
    const storageId = await withRetry(async () => {
      const uploadUrl: string = await client.mutation(
        api.artworks.seedGenerateUploadUrl,
        { token: SEED_TOKEN! },
      );
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": contentType },
        body: new Uint8Array(bytes),
      });
      if (!res.ok) {
        throw new Error(`Upload failed for ${file} (${res.status})`);
      }
      const json = (await res.json()) as { storageId: string };
      return json.storageId;
    }, `upload ${file}`);
    out.push({ slug, storageId });
  }
  return out;
}

// ─── HTML report ───────────────────────────────────────────────────────────
function buildHtml(batchId: string, photos: Array<{ slug: string }>, styles: string[], rows: CatRow[]): string {
  // Index rows by pet → style → row.
  const byPet = new Map<string, Map<string, CatRow>>();
  for (const r of rows) {
    let inner = byPet.get(r.petSlug);
    if (!inner) {
      inner = new Map();
      byPet.set(r.petSlug, inner);
    }
    inner.set(r.style, r);
  }

  const sections: string[] = [];
  const toc: string[] = [];

  for (const photo of photos) {
    const inner = byPet.get(photo.slug);
    if (!inner) continue;
    toc.push(`<a href="#pet-${escapeHtml(photo.slug)}">${escapeHtml(photo.slug)}</a>`);

    const cells = styles.map((s) => {
      const row = inner.get(s);
      if (!row) {
        return `<td class="cell cell--missing">—</td>`;
      }
      return `<td class="cell">
        <img src="${escapeHtml(row.imageUrl)}" loading="lazy"
             alt="${escapeHtml(photo.slug)} / ${escapeHtml(s)}"
             title="${escapeHtml(row.prompt)}" />
      </td>`;
    }).join("");

    sections.push(`
      <section class="pet" id="pet-${escapeHtml(photo.slug)}">
        <h2>${escapeHtml(photo.slug)}</h2>
        <table>
          <thead><tr><th class="corner">cat</th>${styles.map((s) => `<th>${escapeHtml(s)}</th>`).join("")}</tr></thead>
          <tbody><tr><th class="rowhdr">photo × style</th>${cells}</tr></tbody>
        </table>
      </section>`);
  }

  const rendered = rows.length;
  const expected = photos.length * styles.length;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Cat regression ${escapeHtml(batchId)} · Purrtraits</title>
<style>
  body { font-family: system-ui, -apple-apple, sans-serif; margin: 0; background: #faf7f2; color: #2a211c; }
  header { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #e7ddd0; padding: 14px 24px; z-index: 10; }
  header h1 { margin: 0 0 4px; font-size: 18px; }
  header .meta { font-size: 12px; color: #8a7d70; }
  .toc { padding: 12px 24px; font-size: 12px; line-height: 1.9; border-bottom: 1px solid #e7ddd0; background: #fff; }
  .toc a { color: #c0688a; margin-right: 14px; text-decoration: none; white-space: nowrap; }
  .toc a:hover { text-decoration: underline; }
  main { padding: 8px 24px 64px; }
  .pet { margin: 32px 0; }
  .pet h2 { font-size: 16px; margin: 0 0 8px; scroll-margin-top: 72px; font-family: var(--font-display); }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #e7ddd0; }
  thead th { background: #f1ebe1; font-size: 11px; font-weight: 600; padding: 6px 10px; text-transform: capitalize; }
  th.corner { background: #ece4d6; font-size: 10px; color: #8a7d70; }
  th.rowhdr { background: #f1ebe1; font-size: 11px; padding: 6px 10px; white-space: nowrap; }
  td.cell { padding: 0; width: 240px; height: 320px; vertical-align: top; }
  td.cell img { display: block; width: 240px; height: 320px; object-fit: cover; }
  td.cell--missing { color: #c4b8a8; text-align: center; font-size: 24px; width: 240px; height: 320px; }
</style>
</head>
<body>
<header>
  <h1>Cat regression — ${escapeHtml(batchId)}</h1>
  <div class="meta">${rendered} / ${expected} renders · ${photos.length} cat photos × ${styles.length} styles · species: cat · hover an image to see its prompt</div>
</header>
<nav class="toc">${toc.join("")}</nav>
<main>${sections.join("")}</main>
</body>
</html>`;
}

function writeReport(batchId: string, photos: Array<{ slug: string }>, styles: string[], rows: CatRow[]): void {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  const html = buildHtml(batchId, photos, styles, rows);
  const path = join(OUTPUT_DIR, `cat-${batchId}.html`);
  writeFileSync(path, html, "utf-8");
  console.log(`\nReport written: ${path}`);
}

// ─── Modes ─────────────────────────────────────────────────────────────────
async function modeList(): Promise<void> {
  const batches = (await client.query(api.catRegression.catRegressionGetBatch, {
    token: SEED_TOKEN!,
  })) as { batchId: string; count: number; createdAt: number }[];
  if (batches.length === 0) {
    console.log("No cat regression batches found.");
    return;
  }
  console.log("Cat regression batches:");
  for (const b of batches) {
    console.log(`  ${b.batchId.padEnd(22)} ${String(b.count).padStart(4)} rows   ${new Date(b.createdAt).toISOString()}`);
  }
}

async function modeReport(batchId: string): Promise<void> {
  const rows = (await client.query(api.catRegression.catRegressionList, {
    token: SEED_TOKEN!,
    batchId,
  })) as CatRow[];
  if (rows.length === 0) {
    console.error(`No rows for batch ${batchId}.`);
    process.exit(1);
  }
  // Recover the photo slugs from the rows. The script doesn't have the
  // original photo list at report time, but the rows carry the slugs.
  const slugs = Array.from(new Set(rows.map((r) => r.petSlug))).sort();
  const styles = Array.from(new Set(rows.map((r) => r.style))).sort();
  writeReport(
    batchId,
    slugs.map((slug) => ({ slug })),
    styles,
    rows,
  );
}

async function modeRender(batchId: string): Promise<void> {
  // Optional style filter — pass --styles oil,watercolour to restrict.
  const stylesRaw = flagValue("styles");
  const stylesToRun = stylesRaw
    ? stylesRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : STYLES;
  for (const s of stylesToRun) {
    if (!STYLES.includes(s)) {
      console.error(`Unknown style: ${s}. Known: ${STYLES.join(", ")}`);
      process.exit(1);
    }
  }

  const photos = await uploadCatPhotos();
  const jobs: Job[] = [];
  for (const photo of photos) {
    for (const style of stylesToRun) {
      jobs.push({ petSlug: photo.slug, style });
    }
  }
  const lo = (jobs.length * COST_LOW).toFixed(2);
  const hi = (jobs.length * COST_HIGH).toFixed(2);

  console.log("");
  console.log(`Cat regression plan — batch ${batchId}`);
  console.log(`  ${photos.length} cat photo${photos.length === 1 ? "" : "s"} × ${stylesToRun.length} styles = ${jobs.length} renders`);
  console.log(`  Estimated cost: ~$${lo}–$${hi}`);
  console.log("");

  if (!flag("confirm")) {
    console.log("Dry run. Re-run with --confirm to start rendering.");
    return;
  }

  console.log(`Rendering ${jobs.length} cells...`);
  let done = 0;
  let failed = 0;
  // One styleKey at a time (the action is per-style), so we group jobs by
  // style. For each style, the action internally loops over every photo.
  for (const style of stylesToRun) {
    const label = `style=${style} (${photos.length} photos)`;
    try {
      const result = (await withRetry(
        () =>
          client.action(api.catRegression.runBatch, {
            token: SEED_TOKEN!,
            batchId,
            photos: photos.map((p) => ({ petSlug: p.slug, storageId: p.storageId as any })),
            styleKey: style,
          }),
        label,
      )) as { rendered: number; errors: string[] };
      done += result.rendered;
      console.log(`  [${style}] ${result.rendered} rendered${result.errors.length ? `, ${result.errors.length} err` : ""}`);
    } catch (err) {
      failed += photos.length;
      console.log(`  [${style}] FAILED: ${(err as Error).message}`);
    }
  }

  console.log(`\nRendering finished — ${done} rendered, ${failed} failed.`);

  const rows = (await client.query(api.catRegression.catRegressionList, {
    token: SEED_TOKEN!,
    batchId,
  })) as CatRow[];
  writeReport(batchId, photos, stylesToRun, rows);
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  if (flag("list")) {
    await modeList();
    return;
  }
  const reportId = flagValue("report");
  if (reportId) {
    await modeReport(reportId);
    return;
  }
  const batchId = flagValue("batch") ?? makeBatchId();
  await modeRender(batchId);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});