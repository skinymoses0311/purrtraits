/**
 * Offline example-matrix renderer for Tab 3 (Famous Art).
 *
 * Runs every (artwork × activity × mood) combination through the real Tab 3
 * Seedream pipeline and writes an HTML grid you can scan in a browser. Test
 * renders go to the `matrixRenders` table — they never touch sessions, regen
 * budgets, or anyone's gallery.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SETUP
 * ─────────────────────────────────────────────────────────────────────────
 *   1. Drop a few photos of your dog into  scripts/matrix-pets/
 *      (same photos used for every render, so combos are comparable).
 *   2. .env.local must have PUBLIC_CONVEX_URL and ARTWORKS_SEED_TOKEN —
 *      same vars the catalogue seed script uses.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * USAGE
 * ─────────────────────────────────────────────────────────────────────────
 *   npm run matrix:render -- --confirm
 *       New batch, full run. Prints the plan + cost estimate; --confirm
 *       is required so you can't trigger a paid run by accident.
 *
 *   npm run matrix:render -- --confirm --batch <id>
 *       Resume an interrupted batch. Jobs already recorded are skipped
 *       (job granularity — see convex/matrix.ts jobAlreadyDone).
 *
 *   npm run matrix:render -- --report <id>
 *       Regenerate the HTML from a batch's rows without rendering anything.
 *
 *   npm run matrix:render -- --clean <id>
 *       Delete a batch's rows and their storage objects.
 *
 *   npm run matrix:render -- --list
 *       List existing batches with row counts.
 */

import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dns from "node:dns";
import { promisify } from "node:util";
import { ConvexHttpClient } from "convex/browser";
import { config as loadEnv } from "dotenv";

import { ARTWORKS_CATALOG } from "../convex/artworksCatalog.js";
import { api } from "../convex/_generated/api.js";

// ─── DNS resilience ────────────────────────────────────────────────────────
// Some networks' OS resolver intermittently times out on *.convex.cloud
// (the deployment host is IPv6-only behind Cloudflare). `dns.resolve*` uses
// Node's bundled c-ares — it talks straight to the configured servers and
// bypasses the OS resolver entirely. We point it at public resolvers and
// override `dns.lookup` (which undici, and therefore Node's fetch, uses) to
// go through it, falling back to the system resolver if that ever fails.
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
      // c-ares path failed too — fall back to the OS resolver.
      systemLookup(hostname, options, callback);
    }
  })();
};

// ─── MATRIX CONFIG — edit here ─────────────────────────────────────────────
// Which quiz axes to vary. Every artwork is rendered against the full
// Cartesian product of these.
const ACTIVITIES = ["napping", "adventuring"];
const MOODS = ["calm", "playful"];
// favouriteFeature is held fixed across the matrix so the grid isolates
// activity × mood. `undefined` = no feature fragment (the "whole-vibe"
// baseline). Set to "eyes" / "fur" / etc. to bias every render.
const FAVOURITE_FEATURE: string | undefined = undefined;
// Optional single-breed vocabulary hint. `undefined` lets the photos speak
// for themselves. Set to e.g. "Labrador Retriever" to match your dog.
const BREED: string | undefined = undefined;
// Job-actions in flight at once. Each job = 3 Seedream calls, so 3 → ~9
// concurrent fal calls. Bump cautiously; fal will rate-limit.
const CONCURRENCY = 3;
// Rough per-render cost band for the estimate print only.
const COST_LOW = 0.04;
const COST_HIGH = 0.06;
// ───────────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");
const PETS_DIR = join(PROJECT_ROOT, "scripts", "matrix-pets");
const OUTPUT_DIR = join(PROJECT_ROOT, "scripts", "matrix-output");

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
type MatrixRow = {
  batchId: string;
  artworkSlug: string;
  artworkTitle: string;
  placementSlug: string;
  placementLabel: string;
  activity: string;
  mood: string;
  favouriteFeature?: string;
  imageUrl: string;
  prompt: string;
  createdAt: number;
};

type Job = { artworkSlug: string; activity: string; mood: string };

// ─── Helpers ───────────────────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

function makeBatchId(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `m-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
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

// Run with retries + linear backoff. Convex's HTTP client has a 10s connect
// timeout; a transient network blip shouldn't sink a 30-minute run, so we
// retry a few times before giving up (at which point the HTML shows a gap).
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
async function uploadPetPhotos(): Promise<string[]> {
  if (!existsSync(PETS_DIR)) {
    console.error(`Missing ${PETS_DIR}. Create it and drop a few dog photos in.`);
    process.exit(1);
  }
  const files = readdirSync(PETS_DIR).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  if (files.length === 0) {
    console.error(`No images in ${PETS_DIR}. Drop a few dog photos in and re-run.`);
    process.exit(1);
  }
  console.log(`Uploading ${files.length} pet photo(s)...`);
  const storageIds: string[] = [];
  for (const file of files) {
    const bytes = readFileSync(join(PETS_DIR, file));
    const contentType = /\.png$/i.test(file)
      ? "image/png"
      : /\.webp$/i.test(file)
        ? "image/webp"
        : "image/jpeg";
    // Both the upload-URL mutation and the byte POST are retried — a
    // connect timeout here would otherwise sink the whole run before it
    // started.
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
    storageIds.push(storageId);
  }
  return storageIds;
}

// ─── HTML report ───────────────────────────────────────────────────────────
function buildHtml(batchId: string, rows: MatrixRow[]): string {
  // Index rows by artwork → "activity|mood|placementSlug" → row.
  const byArtwork = new Map<string, Map<string, MatrixRow>>();
  for (const r of rows) {
    let inner = byArtwork.get(r.artworkSlug);
    if (!inner) {
      inner = new Map();
      byArtwork.set(r.artworkSlug, inner);
    }
    inner.set(`${r.activity}|${r.mood}|${r.placementSlug}`, r);
  }

  // Fixed quiz-combo order (rows of each per-artwork table).
  const quizCombos: { activity: string; mood: string }[] = [];
  for (const a of ACTIVITIES) for (const m of MOODS) quizCombos.push({ activity: a, mood: m });

  const sections: string[] = [];
  const toc: string[] = [];

  for (const art of ARTWORKS_CATALOG) {
    const inner = byArtwork.get(art.slug);
    if (!inner) continue; // nothing rendered for this artwork
    toc.push(
      `<a href="#art-${escapeHtml(art.slug)}">${escapeHtml(art.title)}</a>`,
    );

    // Columns = placements in catalogue order.
    const headerCells = art.placements
      .map((p) => `<th>${escapeHtml(p.label)}</th>`)
      .join("");

    const bodyRows = quizCombos
      .map(({ activity, mood }) => {
        const cells = art.placements
          .map((p) => {
            const row = inner.get(`${activity}|${mood}|${p.slug}`);
            if (!row) {
              return `<td class="cell cell--missing">—</td>`;
            }
            return `<td class="cell">
              <img src="${escapeHtml(row.imageUrl)}" loading="lazy"
                   alt="${escapeHtml(art.title)} / ${escapeHtml(p.label)} / ${escapeHtml(activity)} / ${escapeHtml(mood)}"
                   title="${escapeHtml(row.prompt)}" />
            </td>`;
          })
          .join("");
        return `<tr>
          <th class="rowhdr">${escapeHtml(activity)}<br><span>${escapeHtml(mood)}</span></th>
          ${cells}
        </tr>`;
      })
      .join("");

    sections.push(`
      <section class="artwork" id="art-${escapeHtml(art.slug)}">
        <h2>${escapeHtml(art.title)} <span class="artist">${escapeHtml(art.artist)}${art.year ? `, ${escapeHtml(art.year)}` : ""}</span></h2>
        <table>
          <thead><tr><th class="corner">activity / mood</th>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </section>`);
  }

  const rendered = rows.length;
  const expected = ARTWORKS_CATALOG.length * ACTIVITIES.length * MOODS.length * 3;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Matrix ${escapeHtml(batchId)} · Purrtraits</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; margin: 0; background: #faf7f2; color: #2a211c; }
  header { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #e7ddd0; padding: 14px 24px; z-index: 10; }
  header h1 { margin: 0 0 4px; font-size: 18px; }
  header .meta { font-size: 12px; color: #8a7d70; }
  .toc { padding: 12px 24px; font-size: 12px; line-height: 1.9; border-bottom: 1px solid #e7ddd0; background: #fff; }
  .toc a { color: #c0688a; margin-right: 14px; text-decoration: none; white-space: nowrap; }
  .toc a:hover { text-decoration: underline; }
  main { padding: 8px 24px 64px; }
  .artwork { margin: 32px 0; }
  .artwork h2 { font-size: 16px; margin: 0 0 8px; scroll-margin-top: 72px; }
  .artwork h2 .artist { font-weight: 400; color: #8a7d70; font-size: 13px; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #e7ddd0; }
  thead th { background: #f1ebe1; font-size: 11px; font-weight: 600; padding: 6px 10px; text-transform: capitalize; }
  th.corner { background: #ece4d6; font-size: 10px; color: #8a7d70; }
  th.rowhdr { background: #f1ebe1; font-size: 11px; padding: 6px 10px; text-transform: capitalize; white-space: nowrap; }
  th.rowhdr span { color: #8a7d70; font-weight: 400; }
  td.cell { padding: 0; width: 240px; height: 320px; vertical-align: top; }
  td.cell img { display: block; width: 240px; height: 320px; object-fit: cover; }
  td.cell--missing { color: #c4b8a8; text-align: center; font-size: 24px; width: 240px; height: 320px; }
</style>
</head>
<body>
<header>
  <h1>Famous Art matrix — ${escapeHtml(batchId)}</h1>
  <div class="meta">${rendered} / ${expected} renders · activities: ${ACTIVITIES.join(", ")} · moods: ${MOODS.join(", ")} · feature: ${FAVOURITE_FEATURE ?? "(none)"} · hover an image to see its prompt</div>
</header>
<nav class="toc">${toc.join("")}</nav>
<main>${sections.join("")}</main>
</body>
</html>`;
}

function writeReport(batchId: string, rows: MatrixRow[]): void {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  const html = buildHtml(batchId, rows);
  const path = join(OUTPUT_DIR, `matrix-${batchId}.html`);
  writeFileSync(path, html, "utf-8");
  console.log(`\nReport written: ${path}`);
}

// ─── Modes ─────────────────────────────────────────────────────────────────
async function modeList(): Promise<void> {
  const batches = (await client.query(api.matrix.listBatches, {
    token: SEED_TOKEN!,
  })) as { batchId: string; count: number; createdAt: number }[];
  if (batches.length === 0) {
    console.log("No matrix batches found.");
    return;
  }
  console.log("Matrix batches:");
  for (const b of batches) {
    console.log(`  ${b.batchId.padEnd(22)} ${String(b.count).padStart(4)} rows   ${new Date(b.createdAt).toISOString()}`);
  }
}

async function modeClean(batchId: string): Promise<void> {
  console.log(`Cleaning batch ${batchId}...`);
  let total = 0;
  for (;;) {
    const { deleted } = (await client.mutation(api.matrix.clearBatch, {
      token: SEED_TOKEN!,
      batchId,
    })) as { deleted: number };
    total += deleted;
    if (deleted === 0) break;
    process.stdout.write(`  deleted ${total}\r`);
  }
  console.log(`\nDeleted ${total} rows + their storage objects.`);
}

async function modeReport(batchId: string): Promise<void> {
  const rows = (await client.query(api.matrix.listBatch, {
    token: SEED_TOKEN!,
    batchId,
  })) as MatrixRow[];
  if (rows.length === 0) {
    console.error(`No rows for batch ${batchId}.`);
    process.exit(1);
  }
  writeReport(batchId, rows);
}

async function modeRender(batchId: string): Promise<void> {
  const jobs: Job[] = [];
  for (const art of ARTWORKS_CATALOG) {
    for (const activity of ACTIVITIES) {
      for (const mood of MOODS) {
        jobs.push({ artworkSlug: art.slug, activity, mood });
      }
    }
  }
  const renderCount = jobs.length * 3;
  const lo = (renderCount * COST_LOW).toFixed(2);
  const hi = (renderCount * COST_HIGH).toFixed(2);

  console.log("");
  console.log(`Matrix plan — batch ${batchId}`);
  console.log(`  ${ARTWORKS_CATALOG.length} artworks × ${ACTIVITIES.length} activities × ${MOODS.length} moods = ${jobs.length} jobs`);
  console.log(`  ${jobs.length} jobs × 3 placements = ${renderCount} renders`);
  console.log(`  Estimated cost: ~$${lo}–$${hi}`);
  console.log(`  Concurrency: ${CONCURRENCY} jobs at a time`);
  console.log("");

  if (!flag("confirm")) {
    console.log("Dry run. Re-run with --confirm to start rendering.");
    return;
  }

  const petPhotoStorageIds = await uploadPetPhotos();
  console.log(`Rendering ${jobs.length} jobs (concurrency ${CONCURRENCY})...\n`);

  let done = 0;
  let skipped = 0;
  let failed = 0;
  await runPool(jobs, CONCURRENCY, async (job) => {
    const label = `${job.artworkSlug} ${job.activity}/${job.mood}`;
    try {
      const result = (await withRetry(
        () =>
          client.action(api.matrixRender.runMatrixJob, {
            token: SEED_TOKEN!,
            batchId,
            petPhotoStorageIds: petPhotoStorageIds as any,
            artworkSlug: job.artworkSlug,
            activity: job.activity,
            mood: job.mood,
            favouriteFeature: FAVOURITE_FEATURE,
            breed: BREED,
          }),
        label,
      )) as { rendered: number; skipped: boolean; errors: string[] };
      done += 1;
      if (result.skipped) skipped += 1;
      const tag = result.skipped
        ? "skip"
        : `${result.rendered}/3${result.errors.length ? ` (${result.errors.length} err)` : ""}`;
      console.log(`  [${done}/${jobs.length}] ${label.padEnd(40)} ${tag}`);
    } catch (err) {
      failed += 1;
      done += 1;
      console.log(`  [${done}/${jobs.length}] ${label.padEnd(40)} FAILED: ${(err as Error).message}`);
    }
  });

  console.log(`\nRendering finished — ${jobs.length - failed - skipped} rendered, ${skipped} skipped, ${failed} failed.`);

  const rows = (await client.query(api.matrix.listBatch, {
    token: SEED_TOKEN!,
    batchId,
  })) as MatrixRow[];
  writeReport(batchId, rows);
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  if (flag("list")) {
    await modeList();
    return;
  }
  const cleanId = flagValue("clean");
  if (cleanId) {
    await modeClean(cleanId);
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
