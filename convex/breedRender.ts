"use node";

// ─── Offline Breed Spotlight image renderer ────────────────────────────────
//
// Companion action for scripts/breed-render.ts. Mirrors the matrix harness
// shape (assertSeedToken-gated, no session / regen / gallery side effects).
// Two entry points:
//
//   • renderBreedStyle      — runs the breed's reference photo through the
//                             existing Tab 1 fal.ts style pipeline using a
//                             named STYLE_PROMPTS key. Identity-preserved
//                             stylised render, 3:4, full-bleed.
//
//   • renderBreedPhotoTip   — restages the same reference photo as a
//                             photoreal photograph per a per-breed brief
//                             (camera angle, light, stance). Same dog,
//                             not a breed-typical lookalike.
//
// Both persist the result to Convex storage via enforce3by4AndStore so the
// script can fetch the bytes back over a stable URL.

import { action } from "./_generated/server";
import { v } from "convex/values";
import { assertSeedToken } from "./artworks";
import {
  STYLE_PROMPTS,
  buildPrompt,
  callNanoBanana,
  enforce3by4AndStore,
  IDENTITY_GUARD,
  FULL_BLEED_LEAD,
} from "./fal";
import type { Id } from "./_generated/dataModel";

// Photo-mode prompt builder. Deliberately separate from fal.ts/STYLE_PROMPTS
// because the style pipeline actively pushes the output away from realism
// (painterly brushwork, drawn lines, halftones, woodblock outlines). Here
// we want the opposite — keep the exact dog from the reference photo and
// only restage it. We reuse fal.ts's IDENTITY_GUARD identity-preservation
// language so the dog stays the same individual, and FULL_BLEED_LEAD so
// the output stays edge-to-edge with no border. The brief itself injects
// camera angle, light direction, and stance per breed.
function buildPhotoModePrompt(brief: string): string {
  return (
    `${FULL_BLEED_LEAD} ` +
    `PHOTOREALISTIC PHOTOGRAPH — the output must read as a real photograph taken on a DSLR with natural light, realistic depth of field, and true-to-life fur and detail. ` +
    `ABSOLUTELY NO painterly, illustrated, stylised, or artistic treatment of any kind: no brushwork, no linework, no watercolour wash, no graphic flatness, no halftones, no woodblock outlines, no paper texture, no pencil shading. ` +
    `Restage the exact dog from the reference photo according to this brief: ${brief} ` +
    `This is an edit and restage of THAT specific dog — never a breed-typical lookalike, never a fresh text-to-image generation. ` +
    `${IDENTITY_GUARD}`
  );
}

type RenderResult = {
  url: string;
  storageId: Id<"_storage"> | null;
  prompt: string;
};

// Run a single styled render. Uses the SAME prompt assembly as the Tab 1
// pipeline (buildPrompt → callNanoBanana → enforce3by4AndStore) so the
// blog imagery looks identical to what the live product would produce
// from the same reference photo + style key.
export const renderBreedStyle = action({
  args: {
    token: v.string(),
    breedPhotoStorageId: v.id("_storage"),
    styleKey: v.string(),
  },
  handler: async (ctx, args): Promise<RenderResult> => {
    assertSeedToken(args.token);
    if (!(args.styleKey in STYLE_PROMPTS)) {
      throw new Error(
        `Unknown style key: ${args.styleKey}. Known: ${Object.keys(STYLE_PROMPTS).join(", ")}`,
      );
    }
    const photoUrl = await ctx.storage.getUrl(args.breedPhotoStorageId);
    if (!photoUrl) throw new Error("Could not resolve breed photo storage id");

    const prompt = buildPrompt(args.styleKey as keyof typeof STYLE_PROMPTS);
    const rawUrl = await callNanoBanana(prompt, [photoUrl]);
    const { url, storageId } = await enforce3by4AndStore(ctx, rawUrl);
    return { url, storageId, prompt };
  },
});

// Run a single photo-tip render. Same Nano Banana edit endpoint, but with
// the photo-mode prompt instead of a style prompt — the dog from the
// reference photo is restaged photographically per the breed's brief.
export const renderBreedPhotoTip = action({
  args: {
    token: v.string(),
    breedPhotoStorageId: v.id("_storage"),
    photoTipBrief: v.string(),
  },
  handler: async (ctx, args): Promise<RenderResult> => {
    assertSeedToken(args.token);
    const photoUrl = await ctx.storage.getUrl(args.breedPhotoStorageId);
    if (!photoUrl) throw new Error("Could not resolve breed photo storage id");

    const prompt = buildPhotoModePrompt(args.photoTipBrief);
    const rawUrl = await callNanoBanana(prompt, [photoUrl]);
    const { url, storageId } = await enforce3by4AndStore(ctx, rawUrl);
    return { url, storageId, prompt };
  },
});
