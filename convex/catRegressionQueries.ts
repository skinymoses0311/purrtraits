import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { assertSeedToken } from "./artworks";

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
