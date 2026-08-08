"use node";

// ─── Offline cat regression suite (Node.js actions) ────────────────────────
//
// Companion action for scripts/cat-regression.ts. Mirrors the matrix
// harness shape (assertSeedToken-gated, no session / regen / gallery side
// effects) but exercises the Tab 1 fal.ts pipeline with species="cat"
// against a small set of reference cat photos.
//
// The script (scripts/cat-regression.ts) is the operator-driven surface
// — it uploads the photos, fans the calls out, and writes an HTML grid.
// This file owns the per-call action and the internal mutation.
//
// One action = N (pet photo × style) renders. The action is NOT split per
// (pet × style) — that would mean 15 round trips per batch instead of 1.
// We still record one row per render so the HTML grid can address each
// cell.

import { action } from "./_generated/server";
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
      await ctx.runMutation(internal.catRegressionQueries.recordRows, { rows });
    }
    return { rendered: rows.length, errors };
  },
});
