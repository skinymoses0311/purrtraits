/**
 * Offline Breed Spotlight image renderer.
 *
 * Produces the six blog images for each of ten Breed Spotlight posts:
 *   - 5 styled art renders   (hero, plate-b, plate-c, plate-d, plate-e)
 *   - 1 photoreal restage    (photo-tips.jpg)
 *
 * Each render is an EDIT of the breed's own reference photo
 * (scripts/breed-photos/<slug>.jpg) — the dog stays the same individual
 * throughout. Styled plates run through the Tab 1 fal.ts pipeline; the
 * photo-tip uses a separate photo-mode prompt that keeps the result
 * photographically realistic.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SETUP
 * ─────────────────────────────────────────────────────────────────────────
 *   1. Drop reference photos into scripts/breed-photos/, named <slug>.jpg
 *      (labrador-retriever.jpg, french-bulldog.jpg, etc.).
 *   2. .env.local must have PUBLIC_CONVEX_URL and ARTWORKS_SEED_TOKEN.
 *   3. Re-run `npx convex dev` once so convex/breedRender.ts is deployed
 *      and reachable from api.breedRender.*.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * USAGE
 * ─────────────────────────────────────────────────────────────────────────
 *   npm run breed:render -- --list
 *       List the breed slugs the script knows about (config table).
 *
 *   npm run breed:render
 *       Dry run. Prints the plan + cost estimate. Spends nothing.
 *
 *   npm run breed:render -- --confirm
 *       Real run. All ten breeds, six images each, resume-safe — any
 *       output JPG that already exists on disk is skipped.
 *
 *   npm run breed:render -- --confirm --breed labrador-retriever
 *       Render a single breed.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
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

// ─── BREED CONFIG ──────────────────────────────────────────────────────────
// Style keys must exist in fal.ts STYLE_PROMPTS. `hero` always equals
// trial-1 (plate-b) — the hero is its own render, but uses the same style.
type BreedConfig = {
  slug: string;
  styles: {
    heroAndB: string;
    c: string;
    d: string;
    e: string; // memorial plate
  };
  photoTipBrief: string;
};

const BREEDS: BreedConfig[] = [
  {
    slug: "labrador-retriever",
    styles: { heroAndB: "oil", c: "watercolour", d: "impressionist", e: "sketch" },
    photoTipBrief:
      "Yellow Labrador, eye-level three-quarter stance, soft raking overcast light, dog settled and calm after exercise.",
  },
  {
    slug: "french-bulldog",
    styles: { heroAndB: "pop", c: "comic", d: "geometric", e: "sketch" },
    photoTipBrief:
      "Fawn French Bulldog, slight three-quarter (a few degrees off square), eye level, soft even frontal light filling the face folds, calm expression.",
  },
  {
    slug: "cocker-spaniel",
    styles: { heroAndB: "watercolour", c: "oil", d: "renaissance", e: "sketch" },
    photoTipBrief:
      "Golden Cocker Spaniel, eye-level three-quarter, ears forward and visible, soft directional overcast light keeping the feathering's colour and fall.",
  },
  {
    slug: "english-bulldog",
    styles: { heroAndB: "pop", c: "comic", d: "oil", e: "sketch" },
    photoTipBrief:
      "Red-and-white English Bulldog, slight three-quarter, eye level, soft even frontal light filling the brow and jowl folds, calm patient expression.",
  },
  {
    slug: "dachshund",
    styles: { heroAndB: "geometric", c: "pop", d: "ukiyo", e: "sketch" },
    photoTipBrief:
      "Smooth chocolate-and-tan Dachshund in true side-on profile, low eye-level angle, photographed from a slight distance so the long body holds even proportions, soft daylight.",
  },
  {
    slug: "golden-retriever",
    styles: { heroAndB: "watercolour", c: "impressionist", d: "oil", e: "sketch" },
    photoTipBrief:
      "Golden Retriever outdoors, eye-level three-quarter, warm low side-light grading the coat from lit gold to amber shadow, settled friendly expression.",
  },
  {
    slug: "german-shepherd",
    styles: { heroAndB: "oil", c: "sketch", d: "ukiyo", e: "renaissance" },
    photoTipBrief:
      "Black-and-tan German Shepherd standing three-quarter, ears up and alert, eye level, soft directional light raking across the black saddle to reveal its contour.",
  },
  {
    slug: "springer-spaniel",
    styles: { heroAndB: "watercolour", c: "oil", d: "impressionist", e: "sketch" },
    photoTipBrief:
      "Liver-and-white Springer Spaniel outdoors, paused three-quarter with weight forward and ears up, eye level, soft directional light, the look of a dog about to move off again.",
  },
  {
    slug: "pug",
    styles: { heroAndB: "pop", c: "comic", d: "renaissance", e: "sketch" },
    photoTipBrief:
      "Fawn Pug at eye level, a few degrees off square, soft even frontal light filling the brow and muzzle wrinkles, large dark eyes the brightest point.",
  },
  {
    slug: "border-collie",
    styles: { heroAndB: "oil", c: "botanical", d: "sketch", e: "renaissance" },
    photoTipBrief:
      "Black-and-white Border Collie in a three-quarter working stance, weight low and forward, eye level, soft even overcast light holding detail in both the white and the black, the dog visibly engaged.",
  },
];

// Cost band reused from matrix-render.ts — Nano Banana edit calls land in
// roughly the same range as the Seedream placements, so the same per-render
// figures give a useful ballpark.
const COST_LOW = 0.04;
const COST_HIGH = 0.06;

// 6 renders per breed = 5 styled + 1 photo-tip. The output filenames are
// fixed because the Breed Spotlight matrix / converter (see Purrtraits docs)
// expects exactly these names.
type JobKind = "style" | "photoTip";
type Job =
  | { kind: "style"; filename: string; styleKey: string }
  | { kind: "photoTip"; filename: string };

function planForBreed(b: BreedConfig): Job[] {
  return [
    { kind: "style", filename: "hero.jpg", styleKey: b.styles.heroAndB },
    { kind: "style", filename: "plate-b.jpg", styleKey: b.styles.heroAndB },
    { kind: "style", filename: "plate-c.jpg", styleKey: b.styles.c },
    { kind: "style", filename: "plate-d.jpg", styleKey: b.styles.d },
    { kind: "style", filename: "plate-e.jpg", styleKey: b.styles.e },
    { kind: "photoTip", filename: "photo-tips.jpg" },
  ];
}

// ─── Paths / env ───────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");
const PHOTOS_DIR = join(PROJECT_ROOT, "scripts", "breed-photos");
const OUTPUT_BASE = join(PROJECT_ROOT, "src", "assets", "blog");

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

// ─── Helpers ───────────────────────────────────────────────────────────────
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

// Upload a single local JPG to Convex storage and return its storage id.
// Mirrors the upload step in matrix-render.ts; uses the existing
// seedGenerateUploadUrl mutation so we don't need to add a second uploader.
async function uploadBreedPhoto(slug: string): Promise<string> {
  const path = join(PHOTOS_DIR, `${slug}.jpg`);
  if (!existsSync(path)) {
    throw new Error(`Missing reference photo: ${path}`);
  }
  const bytes = readFileSync(path);
  return await withRetry(async () => {
    const uploadUrl: string = await client.mutation(
      api.artworks.seedGenerateUploadUrl,
      { token: SEED_TOKEN! },
    );
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: new Uint8Array(bytes),
    });
    if (!res.ok) throw new Error(`Upload failed for ${slug} (${res.status})`);
    const json = (await res.json()) as { storageId: string };
    return json.storageId;
  }, `upload ${slug}`);
}

// Fetch the rendered image from a Convex storage URL and write it to disk.
async function downloadTo(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
}

function outputDirFor(slug: string): string {
  return join(OUTPUT_BASE, slug);
}

function isJobDone(slug: string, job: Job): boolean {
  return existsSync(join(outputDirFor(slug), job.filename));
}

// ─── Modes ─────────────────────────────────────────────────────────────────
function modeList(): void {
  console.log("Configured breeds:");
  for (const b of BREEDS) {
    console.log(
      `  ${b.slug.padEnd(20)} hero=${b.styles.heroAndB}, c=${b.styles.c}, d=${b.styles.d}, e=${b.styles.e}`,
    );
  }
}

async function modeRender(): Promise<void> {
  const breedFilter = flagValue("breed");
  const breedsToRun = breedFilter
    ? BREEDS.filter((b) => b.slug === breedFilter)
    : BREEDS;
  if (breedFilter && breedsToRun.length === 0) {
    console.error(`Unknown breed slug: ${breedFilter}`);
    console.error(`Known: ${BREEDS.map((b) => b.slug).join(", ")}`);
    process.exit(1);
  }

  // Build the plan, skipping anything already on disk.
  type Planned = { breed: BreedConfig; job: Job };
  const planned: Planned[] = [];
  let alreadyDone = 0;
  for (const breed of breedsToRun) {
    for (const job of planForBreed(breed)) {
      if (isJobDone(breed.slug, job)) {
        alreadyDone += 1;
        continue;
      }
      planned.push({ breed, job });
    }
  }

  const renderCount = planned.length;
  const lo = (renderCount * COST_LOW).toFixed(2);
  const hi = (renderCount * COST_HIGH).toFixed(2);

  console.log("");
  console.log("Breed Spotlight render plan");
  if (breedFilter) console.log(`  Breed filter: ${breedFilter}`);
  console.log(`  ${breedsToRun.length} breed${breedsToRun.length === 1 ? "" : "s"} × 6 images = ${breedsToRun.length * 6} target files`);
  console.log(`  ${alreadyDone} already on disk (skip), ${renderCount} to render`);
  console.log(`  Estimated cost: ~$${lo}–$${hi}`);
  console.log("");

  if (renderCount === 0) {
    console.log("Nothing to do — all target files already exist.");
    return;
  }

  if (!flag("confirm")) {
    console.log("Dry run. Re-run with --confirm to start rendering.");
    return;
  }

  // Upload each breed's reference photo once, then run all of its jobs
  // against that storage id. Uploading per-breed (rather than per-job)
  // keeps the script honest about resume semantics: a re-run with --confirm
  // only re-uploads photos for breeds that still have work outstanding.
  const failures: { slug: string; filename: string; error: string }[] = [];
  let doneCount = 0;

  for (const breed of breedsToRun) {
    const breedJobs = planned.filter((p) => p.breed.slug === breed.slug);
    if (breedJobs.length === 0) continue;

    if (!existsSync(outputDirFor(breed.slug))) {
      mkdirSync(outputDirFor(breed.slug), { recursive: true });
    }

    let storageId: string;
    try {
      storageId = await uploadBreedPhoto(breed.slug);
    } catch (err) {
      const msg = (err as Error).message;
      console.error(`✗ ${breed.slug}: upload failed — ${msg}`);
      for (const p of breedJobs) {
        failures.push({ slug: breed.slug, filename: p.job.filename, error: `upload failed: ${msg}` });
      }
      continue;
    }

    for (const { job } of breedJobs) {
      const label = `${breed.slug}/${job.filename}`;
      try {
        const result = await withRetry(async () => {
          if (job.kind === "style") {
            return (await client.action(api.breedRender.renderBreedStyle, {
              token: SEED_TOKEN!,
              breedPhotoStorageId: storageId as any,
              styleKey: job.styleKey,
            })) as { url: string };
          }
          return (await client.action(api.breedRender.renderBreedPhotoTip, {
            token: SEED_TOKEN!,
            breedPhotoStorageId: storageId as any,
            photoTipBrief: breed.photoTipBrief,
          })) as { url: string };
        }, label);
        const dest = join(outputDirFor(breed.slug), job.filename);
        await downloadTo(result.url, dest);
        doneCount += 1;
        console.log(`  [${doneCount}/${renderCount}] ${label.padEnd(40)} ok`);
      } catch (err) {
        const msg = (err as Error).message;
        doneCount += 1;
        failures.push({ slug: breed.slug, filename: job.filename, error: msg });
        console.log(`  [${doneCount}/${renderCount}] ${label.padEnd(40)} FAILED: ${msg}`);
      }
    }
  }

  console.log("");
  console.log(`Rendering finished — ${renderCount - failures.length} succeeded, ${failures.length} failed.`);
  if (failures.length > 0) {
    console.log("Failures:");
    for (const f of failures) {
      console.log(`  ${f.slug}/${f.filename} — ${f.error}`);
    }
    process.exit(1);
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  if (flag("list")) {
    modeList();
    return;
  }
  await modeRender();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
