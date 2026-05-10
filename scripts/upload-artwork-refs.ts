/**
 * Tab 3 — Famous Art seed script.
 *
 * Reads `convex/artworksCatalog.ts`, opens each entry's reference JPEG from
 * `scripts/artwork-refs/`, generates a small ~600px thumbnail with sharp,
 * uploads both files (thumb + reference) to Convex storage, then upserts the
 * artwork row by slug. Idempotent: re-running with edited prompts patches
 * the existing row in place; `clickCount` is preserved across re-seeds
 * (`seedUpsertArtwork` doesn't overwrite it on update).
 *
 * Usage:
 *   npm run seed:artworks
 *
 * Required env vars (in `.env.local`):
 *   PUBLIC_CONVEX_URL          — same URL `npx convex dev` prints
 *   ARTWORKS_SEED_TOKEN        — must match the token set on the deployment
 *                                via `npx convex env set ARTWORKS_SEED_TOKEN`
 *
 * Authoring flow:
 *   1. Edit `convex/artworksCatalog.ts` (placement prompts).
 *   2. Drop / refresh JPEGs in `scripts/artwork-refs/` per MANIFEST.md.
 *   3. Run this script.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ConvexHttpClient } from "convex/browser";
import { config as loadEnv } from "dotenv";

import { ARTWORKS_CATALOG, type CatalogArtwork } from "../convex/artworksCatalog.js";
import { api } from "../convex/_generated/api.js";

// ─── Tunables ───────────────────────────────────────────────────────────────
const THUMB_LONG_EDGE = 600;
const THUMB_QUALITY = 70;

// Reference image — the 1600px source from MANIFEST.md is fine as-is. We
// re-encode at q85 to bring file sizes down ~30% without visible loss when
// Seedream uses it as a generation reference. No resize.
const REFERENCE_QUALITY = 85;

// ─── Setup ─────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");
const REFS_DIR = join(PROJECT_ROOT, "scripts", "artwork-refs");

loadEnv({ path: join(PROJECT_ROOT, ".env.local") });

const CONVEX_URL = process.env.PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
if (!CONVEX_URL) {
  console.error("Missing PUBLIC_CONVEX_URL / CONVEX_URL in .env.local");
  process.exit(1);
}

const SEED_TOKEN = process.env.ARTWORKS_SEED_TOKEN;
if (!SEED_TOKEN) {
  console.error(
    [
      "Missing ARTWORKS_SEED_TOKEN.",
      "  1. Generate a random token:    npx -y @anthropic/uuid 2>/dev/null || node -e \"console.log(crypto.randomUUID())\"",
      "  2. Set it on the deployment:   npx convex env set ARTWORKS_SEED_TOKEN <token>",
      "  3. Mirror it locally in:       .env.local  (ARTWORKS_SEED_TOKEN=...)",
    ].join("\n"),
  );
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

// ─── Image preparation ─────────────────────────────────────────────────────

async function prepareThumb(inputBytes: Buffer): Promise<Buffer> {
  return await sharp(inputBytes)
    .rotate() // honour EXIF orientation if present
    .resize({ width: THUMB_LONG_EDGE, height: THUMB_LONG_EDGE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: THUMB_QUALITY, mozjpeg: true })
    .toBuffer();
}

async function prepareReference(inputBytes: Buffer): Promise<Buffer> {
  // No resize — caller's MANIFEST.md downloads 1600px-on-long-edge files,
  // which are already the right size for Seedream. Re-encode for size.
  return await sharp(inputBytes)
    .rotate()
    .jpeg({ quality: REFERENCE_QUALITY, mozjpeg: true })
    .toBuffer();
}

// ─── Convex storage upload ─────────────────────────────────────────────────

type StorageUploadResponse = { storageId: string };

async function uploadBlob(bytes: Buffer, contentType: string): Promise<string> {
  const uploadUrl = await client.mutation(api.artworks.seedGenerateUploadUrl, {
    token: SEED_TOKEN!,
  });
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: new Uint8Array(bytes),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as StorageUploadResponse;
  if (!json.storageId) {
    throw new Error(`Upload returned no storageId: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json.storageId;
}

// ─── Per-artwork seeding ───────────────────────────────────────────────────

async function seedOne(entry: CatalogArtwork): Promise<"updated" | "inserted"> {
  const sourcePath = join(REFS_DIR, entry.refFilename);
  if (!existsSync(sourcePath)) {
    throw new Error(
      `Missing reference file: ${entry.refFilename}. Download per scripts/artwork-refs/MANIFEST.md and try again.`,
    );
  }

  const inputBytes = readFileSync(sourcePath);

  const [thumbBytes, referenceBytes] = await Promise.all([
    prepareThumb(inputBytes),
    prepareReference(inputBytes),
  ]);

  const [thumbStorageId, referenceStorageId] = await Promise.all([
    uploadBlob(thumbBytes, "image/jpeg"),
    uploadBlob(referenceBytes, "image/jpeg"),
  ]);

  const result = await client.mutation(api.artworks.seedUpsertArtwork, {
    token: SEED_TOKEN!,
    slug: entry.slug,
    title: entry.title,
    artist: entry.artist,
    year: entry.year,
    era: entry.era,
    thumbStorageId: thumbStorageId as any,
    referenceStorageId: referenceStorageId as any,
    placements: entry.placements,
  });

  return result.action;
}

// ─── Validation pre-flight ─────────────────────────────────────────────────

function validateCatalog(): void {
  const errors: string[] = [];
  const seenSlugs = new Set<string>();
  for (const entry of ARTWORKS_CATALOG) {
    if (seenSlugs.has(entry.slug)) {
      errors.push(`Duplicate slug: ${entry.slug}`);
    }
    seenSlugs.add(entry.slug);
    if (entry.placements.length !== 3) {
      errors.push(`${entry.slug}: expected 3 placements, got ${entry.placements.length}`);
    }
    const seenPlacementSlugs = new Set<string>();
    for (const p of entry.placements) {
      if (!p.slug || !p.label || !p.prompt) {
        errors.push(`${entry.slug}: empty placement field (slug/label/prompt)`);
      }
      if (seenPlacementSlugs.has(p.slug)) {
        errors.push(`${entry.slug}: duplicate placement slug "${p.slug}"`);
      }
      seenPlacementSlugs.add(p.slug);
    }
  }
  if (errors.length > 0) {
    console.error("Catalog validation failed:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  validateCatalog();
  console.log(`Seeding ${ARTWORKS_CATALOG.length} artworks → ${CONVEX_URL}`);

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const entry of ARTWORKS_CATALOG) {
    process.stdout.write(`  ${entry.slug.padEnd(28)} `);
    try {
      const action = await seedOne(entry);
      if (action === "inserted") inserted++;
      else updated++;
      console.log(action);
    } catch (err) {
      failed++;
      console.log(`failed: ${(err as Error).message}`);
    }
  }

  console.log("");
  console.log(`Done — ${inserted} inserted, ${updated} updated, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
