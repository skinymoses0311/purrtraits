"use node";

// ─── Offline example-matrix render action ──────────────────────────────────
//
// The "use node" half of the matrix harness. scripts/matrix-render.ts calls
// `runMatrixJob` once per (artwork × activity × mood) combination; each call
// fans out the artwork's three placements through the EXACT production Tab 3
// pipeline (generateArtworkPlacementsForMatrix → renderOnePlacement) and
// records the results in the `matrixRenders` table.
//
// This bypasses sessions, regen accounting, and the gallery entirely — it's
// a test tool, not a user flow. It's a public action gated by
// ARTWORKS_SEED_TOKEN because it's invoked out-of-process and spends fal
// credits.

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { assertSeedToken } from "./artworks";
import { generateArtworkPlacementsForMatrix } from "./seedream";

export const runMatrixJob = action({
  args: {
    token: v.string(),
    batchId: v.string(),
    petPhotoStorageIds: v.array(v.id("_storage")),
    artworkSlug: v.string(),
    activity: v.string(),
    mood: v.string(),
    favouriteFeature: v.optional(v.string()),
    // Optional single-breed vocabulary hint, mirroring quizAnswers.breed.
    // The matrix doesn't exercise crossbreed arrays.
    breed: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ rendered: number; skipped: boolean; errors: string[] }> => {
    assertSeedToken(args.token);

    // Resumability — if this job already has rows for the batch, skip it so
    // a re-run after a crash doesn't re-pay for completed work.
    const done = await ctx.runQuery(internal.matrix.jobAlreadyDone, {
      batchId: args.batchId,
      artworkSlug: args.artworkSlug,
      activity: args.activity,
      mood: args.mood,
    });
    if (done) return { rendered: 0, skipped: true, errors: [] };

    // Resolve pet photo storage ids → URLs. The script uploads the photos
    // once and passes the ids to every job.
    const petPhotoUrls: string[] = [];
    for (const id of args.petPhotoStorageIds) {
      const url = await ctx.storage.getUrl(id);
      if (url) petPhotoUrls.push(url);
    }
    if (petPhotoUrls.length === 0) {
      throw new Error("runMatrixJob: no resolvable pet photos");
    }

    const { results, errors } = await generateArtworkPlacementsForMatrix(
      ctx,
      args.artworkSlug,
      petPhotoUrls,
      undefined, // breeds (crossbreed array) — matrix uses the single breed only
      args.breed,
      args.activity,
      args.mood,
      args.favouriteFeature,
    );

    if (results.length > 0) {
      await ctx.runMutation(internal.matrix.recordRows, {
        rows: results.map((r) => ({
          batchId: args.batchId,
          artworkSlug: args.artworkSlug,
          artworkTitle: r.artworkTitle,
          placementSlug: r.placementSlug,
          placementLabel: r.placementLabel,
          activity: args.activity,
          mood: args.mood,
          favouriteFeature: args.favouriteFeature,
          imageUrl: r.imageUrl,
          imageStorageId: r.storageId,
          prompt: r.prompt,
        })),
      });
    }

    return { rendered: results.length, skipped: false, errors };
  },
});
