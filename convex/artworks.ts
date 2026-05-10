import { mutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";

// ─── Public types returned to the picker ───────────────────────────────────
//
// These intentionally drop `referenceStorageId` — the high-res reference is
// only ever fetched server-side at generation time (sent to Seedream as the
// second image). The frontend needs the thumb URL to render cards, plus all
// the human-readable metadata for labels and filtering.

export type PickerArtwork = {
  slug: string;
  title: string;
  artist: string;
  year?: string;
  era: Doc<"artworks">["era"];
  thumbUrl: string;
  placements: { slug: string; label: string }[];
  clickCount: number;
};

async function resolveCard(
  ctx: { storage: { getUrl: (id: Doc<"artworks">["thumbStorageId"]) => Promise<string | null> } },
  doc: Doc<"artworks">,
): Promise<PickerArtwork | null> {
  const thumbUrl = await ctx.storage.getUrl(doc.thumbStorageId);
  if (!thumbUrl) {
    // Storage has been wiped underneath us. Drop the card rather than
    // ship a broken <img>; the picker is more graceful with 29 cards
    // than with a visible 404.
    console.warn(`artworks.resolveCard: missing thumb storage for ${doc.slug}`);
    return null;
  }
  return {
    slug: doc.slug,
    title: doc.title,
    artist: doc.artist,
    year: doc.year,
    era: doc.era,
    thumbUrl,
    // Placement prompts are stripped — they're not needed for browse and
    // including them would double the wire payload.
    placements: doc.placements.map((p) => ({ slug: p.slug, label: p.label })),
    clickCount: doc.clickCount,
  };
}

// Public — full catalog data for the picker grid. Returns active artworks
// only. The frontend filters by era client-side (no extra round trip per
// chip click) since the catalog is bounded at 30 entries.
export const listForPicker = query({
  args: {},
  handler: async (ctx): Promise<PickerArtwork[]> => {
    const docs = await ctx.db
      .query("artworks")
      // Single-arg `.eq` on the (active, era) compound index gives us a
      // bounded "all active" scan without paying for a full table scan if
      // the table grows past 30. Era ordering inside the index is stable.
      .withIndex("by_active_era", (q) => q.eq("active", true))
      .collect();
    const cards = await Promise.all(docs.map((d) => resolveCard(ctx, d)));
    return cards.filter((c): c is PickerArtwork => c !== null);
  },
});

// Public — top 6 by clickCount for the "Popular" carousel above the grid.
// Returns an empty array when no artwork has been clicked yet (cold start);
// the frontend hides the carousel in that case.
export const popularForPicker = query({
  args: {},
  handler: async (ctx): Promise<PickerArtwork[]> => {
    const docs = await ctx.db
      .query("artworks")
      .withIndex("by_active_clicks", (q) => q.eq("active", true))
      .order("desc")
      .take(6);
    // If no card has been clicked yet, hide the carousel.
    if (docs.every((d) => d.clickCount === 0)) return [];
    const cards = await Promise.all(docs.map((d) => resolveCard(ctx, d)));
    return cards.filter((c): c is PickerArtwork => c !== null);
  },
});

// Public — atomic click increment. Called fire-and-forget from the picker on
// card selection. Convex mutations are serializable so the read-modify-write
// here is safe; concurrent clicks on the same artwork will OCC-retry rather
// than lose increments.
export const incrementClick = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const doc = await ctx.db
      .query("artworks")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!doc) return;
    await ctx.db.patch(doc._id, { clickCount: doc.clickCount + 1 });
  },
});

// Public — compact lookup keyed by artwork slug, used by the display label
// resolver (`convex/displayLabels.ts`) to render compound style keys like
// `artwork:starry_night:hilltop` as "The Starry Night — On the hilltop".
//
// Returned lazily so the picker / reveal / gallery / PDP can fetch once per
// page load. Skips active=false rows because those should never appear in
// any rendered string anyway (any old `selectedArtworkSlug` referencing a
// disabled artwork falls back to the raw key in the resolver).
export type ArtworkLookup = Record<string, {
  title: string;
  artist: string;
  placements: Record<string, string>;
}>;

export const getLookup = query({
  args: {},
  handler: async (ctx): Promise<ArtworkLookup> => {
    const docs = await ctx.db
      .query("artworks")
      .withIndex("by_active_era", (q) => q.eq("active", true))
      .collect();
    const lookup: ArtworkLookup = {};
    for (const d of docs) {
      const placements: Record<string, string> = {};
      for (const p of d.placements) placements[p.slug] = p.label;
      lookup[d.slug] = { title: d.title, artist: d.artist, placements };
    }
    return lookup;
  },
});

// ─── Seed-only mutations (called by scripts/upload-artwork-refs.ts) ────────
//
// These are public functions because the seed script runs out-of-process and
// the Convex JS client doesn't have a built-in admin-auth path for hitting
// internal mutations from a Node script. They're gated by a shared-secret
// token (`ARTWORKS_SEED_TOKEN` set on both the deployment and the script's
// environment) so a leaked client URL can't be used to overwrite the
// catalogue. For a fresh deployment, generate a random token and run:
//
//   npx convex env set ARTWORKS_SEED_TOKEN <token>
//
// then mirror it into your local .env.local.

function assertSeedToken(token: string): void {
  const expected = process.env.ARTWORKS_SEED_TOKEN;
  if (!expected) {
    throw new Error(
      "ARTWORKS_SEED_TOKEN not set on the Convex deployment. Run `npx convex env set ARTWORKS_SEED_TOKEN <random>` first.",
    );
  }
  if (token !== expected) throw new Error("Invalid seed token");
}

// Hands the seed script a one-time URL it can POST raw image bytes to. The
// resulting storage id comes back in the upload response and is then passed
// into `seedUpsertArtwork` below.
export const seedGenerateUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }): Promise<string> => {
    assertSeedToken(token);
    return await ctx.storage.generateUploadUrl();
  },
});

// Upsert one artwork row by slug. Preserves `clickCount` on re-seed so
// popularity is durable. Replaces both storage ids on every run, deleting
// the previous files (the upserter holds the bytes locally; we don't want
// orphaned blobs from prior seeds piling up).
export const seedUpsertArtwork = mutation({
  args: {
    token: v.string(),
    slug: v.string(),
    title: v.string(),
    artist: v.string(),
    year: v.optional(v.string()),
    era: v.union(
      v.literal("post-impressionist"),
      v.literal("impressionist"),
      v.literal("japanese-woodblock"),
      v.literal("romantic"),
      v.literal("northern-renaissance"),
      v.literal("symbolist"),
      v.literal("art-nouveau"),
      v.literal("dutch-golden-age"),
      v.literal("renaissance"),
    ),
    thumbStorageId: v.id("_storage"),
    referenceStorageId: v.id("_storage"),
    placements: v.array(
      v.object({
        slug: v.string(),
        label: v.string(),
        prompt: v.string(),
      }),
    ),
  },
  handler: async (ctx, { token, slug, ...fields }) => {
    assertSeedToken(token);
    if (fields.placements.length !== 3) {
      throw new Error(`Artwork ${slug} must have exactly 3 placements; got ${fields.placements.length}`);
    }
    for (const p of fields.placements) {
      if (!p.slug || !p.label || !p.prompt) {
        throw new Error(`Artwork ${slug} has an empty placement field`);
      }
    }
    const existing = await ctx.db
      .query("artworks")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) {
      // Delete the previous storage objects before overwriting the row so
      // we don't leak storage. Best-effort — if deletion fails the row is
      // still patched correctly.
      try { await ctx.storage.delete(existing.thumbStorageId); } catch { /* noop */ }
      try { await ctx.storage.delete(existing.referenceStorageId); } catch { /* noop */ }
      await ctx.db.patch(existing._id, fields);
      return { action: "updated" as const, _id: existing._id };
    }
    const _id = await ctx.db.insert("artworks", {
      slug,
      ...fields,
      clickCount: 0,
      active: true,
    });
    return { action: "inserted" as const, _id };
  },
});

// Internal — used by the Seedream pipeline at generation time to resolve a
// session's selectedArtworkSlug into the data needed to build prompts and
// fetch the high-res reference image.
export const getBySlugInternal = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const doc = await ctx.db
      .query("artworks")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!doc) return null;
    const referenceUrl = await ctx.storage.getUrl(doc.referenceStorageId);
    if (!referenceUrl) {
      throw new Error(`artworks.getBySlugInternal: missing reference storage for ${slug}`);
    }
    return {
      slug: doc.slug,
      title: doc.title,
      artist: doc.artist,
      year: doc.year,
      placements: doc.placements,
      referenceUrl,
    };
  },
});
