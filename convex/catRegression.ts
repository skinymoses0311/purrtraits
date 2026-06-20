"use node";

// ─── Offline cat regression suite ──────────────────────────────────────────
//
// Companion action for scripts/cat-regression.ts. Mirrors the matrix
// harness shape (assertSeedToken-gated, no session / regen / gallery side
// effects) but exercises the Tab 1 fal.ts pipeline with species="cat"
// against a small set of reference cat photos.
//
// The script (scripts/cat-regression.ts) is the operator-driven surface
// — it uploads the photos, fans the calls out, and writes an HTML grid.
// This file owns the per-call action and the public read queries.
//
// One action = N (pet photo × style) renders. The action is NOT split per
// (pet × style) — that would mean 15 round trips per batch instead of 1.
// We still record one row per render so the HTML grid can address each
// cell.

import { action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { assertSeedToken } from "./artworks";
import {
  STYLE_PROMPTS,
  buildPrompt,
  callNanoBanana,
  enforce3by4AndStore,
} from "./fal";

// Public (token-gated) — runs the per-cell renders for one style across
// every supplied cat photo. The script calls this once per style; the
// action internally loops over every photo and produces one row per
// (pet × style) in catRegressionRenders.
export const runBatch = action({
  args: {
    token: v.string(),
    batchId: v.string(),
    // Each entry is (petSlug, storageId). The script pairs the upload
    // storage id with the on-disk file basename so the recorded row's
    // petSlug matches the operator's source file.
    photos: v.array(v.object({ petSlug: v.string(), storageId: v.id("_storage") })),
    styleKey: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ rendered: number; errors: string[] }> => {
    assertSeedToken(args.token);
    if (!(args.styleKey in STYLE_PROMPTS)) {
      throw new Error(
        `Unknown style key: ${args.styleKey}. Known: ${Object.keys(STYLE_PROMPTS).join(", ")}`,
      );
    }

    // Resolve storage ids → URLs. The script uploads the cat photos once
    // and passes the ids in; we resolve them server-side so the action
    // runs against the same fal-uploaded bytes the matrix harness uses.
    const petPhotos: Array<{ storageId: Id<"_storage">; url: string; slug: string }> = [];
    for (const p of args.photos) {
      const url = await ctx.storage.getUrl(p.storageId);
      if (!url) continue;
      petPhotos.push({ storageId: p.storageId, url, slug: p.petSlug });
    }
    if (petPhotos.length === 0) {
      throw new Error("runBatch: no resolvable cat photos");
    }

    // Build the prompt once — same for every cell — using the EXACT
    // buildPrompt path the live fal.ts action uses, with species="cat".
    // activity / mood / breed are intentionally undefined: the regression
    // suite is a pure likeness-by-style check, not a quiz-axis sweep.
    const prompt = buildPrompt(
      args.styleKey as keyof typeof STYLE_PROMPTS,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "cat",
    );

    const rows: Array<{
      batchId: string;
      petSlug: string;
      style: string;
      imageUrl: string;
      imageStorageId: Id<"_storage"> | null;
      prompt: string;
    }> = [];
    const errors: string[] = [];

    for (const photo of petPhotos) {
      try {
        const lowRes = await callNanoBanana(prompt, [photo.url]);
        const { url, storageId } = await enforce3by4AndStore(ctx, lowRes);
        rows.push({
          batchId: args.batchId,
          petSlug: photo.slug,
          style: args.styleKey,
          imageUrl: url,
          imageStorageId: storageId,
          prompt,
        });
      } catch (err) {
        errors.push(`${photo.slug}/${args.styleKey}: ${(err as Error).message}`);
      }
    }

    if (rows.length > 0) {
      await ctx.runMutation(internal.catRegression.recordRows, { rows });
    }
    return { rendered: rows.length, errors };
  },
});

// Internal — writes one row per (cat × style) render. Mirrors
// matrix.recordRows but the schema is a single-pet × single-style tuple
// per row instead of the matrix's artwork × placement tuple.
export const recordRows = internalMutation({
  args: {
    rows: v.array(
      v.object({
        batchId: v.string(),
        petSlug: v.string(),
        style: v.string(),
        imageUrl: v.string(),
        imageStorageId: v.union(v.id("_storage"), v.null()),
        prompt: v.string(),
      }),
    ),
  },
  handler: async (ctx, { rows }) => {
    const now = Date.now();
    for (const row of rows) {
      await ctx.db.insert("catRegressionRenders", { ...row, createdAt: now });
    }
  },
});

// Public (token-gated) — every row for a batch, for the HTML report.
export const catRegressionList = query({
  args: { token: v.string(), batchId: v.string() },
  handler: async (ctx, { token, batchId }) => {
    assertSeedToken(token);
    return await ctx.db
      .query("catRegressionRenders")
      .withIndex("by_batch", (q) => q.eq("batchId", batchId))
      .take(5000);
  },
});

// Public (token-gated) — distinct batches + counts, so the --list mode in
// the script can show what's stored.
export const catRegressionGetBatch = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    assertSeedToken(token);
    const rows = await ctx.db.query("catRegressionRenders").take(20000);
    const counts = new Map<string, { count: number; createdAt: number }>();
    for (const r of rows) {
      const cur = counts.get(r.batchId);
      if (cur) {
        cur.count += 1;
        cur.createdAt = Math.min(cur.createdAt, r.createdAt);
      } else {
        counts.set(r.batchId, { count: 1, createdAt: r.createdAt });
      }
    }
    return [...counts.entries()]
      .map(([batchId, v]) => ({ batchId, ...v }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});
