// Storage layer for the offline example-matrix harness. The action that
// actually renders lives in convex/matrixRender.ts ("use node"); this file
// holds the queries/mutations it leans on, plus the public read/clean
// surface the script (scripts/matrix-render.ts) calls directly.
//
// None of this is part of any user-facing flow. The public functions are
// gated by ARTWORKS_SEED_TOKEN — the same shared secret the catalogue seed
// script uses — because they're invoked out-of-process and one of them
// (clearBatch) deletes data + storage.

import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { assertSeedToken } from "./artworks";

// Per-row shape written by the matrix action. `createdAt` is stamped by the
// mutation, not the caller.
const matrixRowInput = v.object({
  batchId: v.string(),
  artworkSlug: v.string(),
  artworkTitle: v.string(),
  placementSlug: v.string(),
  placementLabel: v.string(),
  activity: v.string(),
  mood: v.string(),
  favouriteFeature: v.optional(v.string()),
  imageUrl: v.string(),
  imageStorageId: v.union(v.id("_storage"), v.null()),
  prompt: v.string(),
});

// Internal — called by runMatrixJob once a job's placements have rendered.
export const recordRows = internalMutation({
  args: { rows: v.array(matrixRowInput) },
  handler: async (ctx, { rows }) => {
    const now = Date.now();
    for (const row of rows) {
      await ctx.db.insert("matrixRenders", { ...row, createdAt: now });
    }
  },
});

// Internal — resumability check. A job is (batchId, artworkSlug, activity,
// mood); if any row exists for it the action skips re-rendering. Resume is
// for crash recovery — a job that partially succeeded counts as "done", so
// to fill gaps from partial failures, start a fresh batch rather than
// resuming.
export const jobAlreadyDone = internalQuery({
  args: {
    batchId: v.string(),
    artworkSlug: v.string(),
    activity: v.string(),
    mood: v.string(),
  },
  handler: async (ctx, { batchId, artworkSlug, activity, mood }) => {
    const existing = await ctx.db
      .query("matrixRenders")
      .withIndex("by_batch_job", (q) =>
        q
          .eq("batchId", batchId)
          .eq("artworkSlug", artworkSlug)
          .eq("activity", activity)
          .eq("mood", mood),
      )
      .first();
    return existing !== null;
  },
});

// Public (token-gated) — every row for a batch, for the HTML report. The
// matrix tops out at a few hundred rows per batch, so an un-paginated read
// with a generous cap is fine.
export const listBatch = query({
  args: { token: v.string(), batchId: v.string() },
  handler: async (ctx, { token, batchId }) => {
    assertSeedToken(token);
    return await ctx.db
      .query("matrixRenders")
      .withIndex("by_batch", (q) => q.eq("batchId", batchId))
      .take(5000);
  },
});

// Public (token-gated) — list distinct batch ids with row counts, so the
// operator can see what's taking up storage.
export const listBatches = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    assertSeedToken(token);
    const rows = await ctx.db.query("matrixRenders").take(20000);
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

// Public (token-gated) — delete a batch's rows and their storage objects.
// Processes up to `limit` rows per call and reports how many remain, so the
// caller can loop without blowing the per-mutation transaction budget.
export const clearBatch = mutation({
  args: {
    token: v.string(),
    batchId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { token, batchId, limit }) => {
    assertSeedToken(token);
    const batchSize = Math.min(limit ?? 100, 100);
    const rows = await ctx.db
      .query("matrixRenders")
      .withIndex("by_batch", (q) => q.eq("batchId", batchId))
      .take(batchSize);
    for (const row of rows) {
      if (row.imageStorageId) {
        try {
          await ctx.storage.delete(row.imageStorageId);
        } catch {
          /* best-effort — row delete still proceeds */
        }
      }
      await ctx.db.delete(row._id);
    }
    // If we filled the batch there may be more; the caller loops until
    // `deleted` comes back 0.
    return { deleted: rows.length };
  },
});
