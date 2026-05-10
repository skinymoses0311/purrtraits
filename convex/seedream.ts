"use node";

// ─── Tab 3 (Famous Art) generation pipeline ────────────────────────────────
//
// Parallel to the Nano Banana pipeline in fal.ts, but pointed at fal-ai's
// Seedream v4 edit endpoint. Same persistence + 3:4 enforcement happens via
// `enforce3by4AndStore` (re-used from fal.ts). Same regen accounting, gallery
// append, and post-purchase upscale are driven by the caller (the
// `generatePortraits` action in fal.ts), so this module only owns:
//
//   1. Prompt construction (artwork + placement, no activity/mood/feature),
//   2. The fal HTTP call to Seedream v4,
//   3. Three-placement fan-out for one artwork.
//
// The `generatePortraits` action in fal.ts branches on
// `session.selectedArtworkSlug` and calls `generateAllArtworkPlacements`
// here when set. Otherwise it stays on the existing Nano Banana path.

import { internal } from "./_generated/api";
import {
  FULL_BLEED_LEAD,
  buildBreedPrimacy,
  enforce3by4AndStore,
} from "./fal";
import type { Id } from "./_generated/dataModel";

// Confirmed-by-hand-testing slug. If fal renames the endpoint the request
// shape may also drift — re-verify before changing this URL.
const SEEDREAM_URL = "https://fal.run/fal-ai/bytedance/seedream/v4/edit";

// Seedream's reference-image cap. Tab 3 sends exactly 2 images (artwork +
// pet); the cap below is a defensive guard if the photo-list grows in
// future. Aligned with FAL_MAX_REFERENCE_IMAGES on the Nano Banana path.
const SEEDREAM_MAX_IMAGES = 10;

// ─── Image order ────────────────────────────────────────────────────────────
//
// All 90 hand-authored placement prompts were written assuming
// [artworkRef, petPhoto] — the language is consistently "the pet from the
// SECOND image" and "the FIRST image is the existing artwork". Sending in
// the same order keeps prompt tokens and image slots aligned.
//
// Note: the operator's Q6 verification answer described image order as
// "pet photo then artwork reference". That described the wire-level test;
// the prompts (which are the runtime-load-bearing part) are written for
// artwork-first. We honour the prompts. If this needs to flip, swap the
// two slots in `imagesForArtwork` AND search-replace "first image"/"second
// image" across all 90 placements in `convex/artworksCatalog.ts`.

// Identity guard tuned for the artwork pipeline. Differs from the
// Nano Banana IDENTITY_GUARD in three ways:
//   • Drops "only change the style, never the pet itself" — for Tab 3 we DO
//     want the pet rendered in the artwork's medium (impasto, woodblock,
//     pointillist dots, etc.), and that line was confusing the model.
//   • References "the photograph" / "the artwork" by role rather than by
//     image slot, since the placement prompts already assert which is which.
//   • Keeps the 3:4 portrait + full-bleed + ignore-pet-environment guards.
const IDENTITY_GUARD_ARTWORK =
  "Crucially, preserve the exact likeness of the pet shown in the photograph reference — same breed, fur colour, markings, eye colour, ear shape, and overall proportions. The pet is rendered in the visual language of the artwork (its brushwork, palette, and medium) but the pet's identity must remain unmistakable. The output MUST be in 3:4 portrait orientation (taller than wide) — do not letterbox, pad, or add coloured bars. The image must be a full-bleed artwork with absolutely no border, frame, mat, passe-partout, vignette, decorative edging, painted edge, drawn rectangle, or coloured/white margin — the artwork must extend edge-to-edge to all four sides of the canvas. The pet photograph is for the pet's identity only — completely ignore and discard the room, walls, floor, ceiling, furniture, household objects, and any indoor environment visible behind or around the pet in that photograph. The setting of the output is the artwork's existing scene, not the photograph's room.";

export type CatalogPlacement = {
  slug: string;
  label: string;
  prompt: string;
};

type ArtworkContext = {
  slug: string;
  title: string;
  artist: string;
  year?: string;
  placements: CatalogPlacement[];
  referenceUrl: string;
};

function buildArtworkPrompt(
  artwork: ArtworkContext,
  placement: CatalogPlacement,
  breeds: string[] | undefined,
  breed: string | undefined,
): string {
  const yearPart = artwork.year ? `, ${artwork.year}` : "";
  // Lead establishes the two image slots and the artwork's identity. Goes
  // first so the model reads the framing rule before the placement-specific
  // instruction overrides any of the artwork's existing composition.
  const lead =
    `${FULL_BLEED_LEAD} The first image is the existing artwork "${artwork.title}" by ${artwork.artist}${yearPart}; the second image is a photograph of the pet for likeness reference only.`;
  // The hand-authored placement fragment. Already contains the medium-led
  // "treat second image as likeness reference only" guard, the preserved
  // scene elements, the artist-specific brushwork callout, and the breed-
  // recognisability clause. See convex/artworksCatalog.ts.
  const placementPart = ` ${placement.prompt}`;
  const breedPrimacy = buildBreedPrimacy(breeds, breed);
  const breedPart = breedPrimacy ? ` ${breedPrimacy}` : "";
  return `${lead}${placementPart}${breedPart} ${IDENTITY_GUARD_ARTWORK}`;
}

async function callSeedream(prompt: string, imageUrls: string[]): Promise<string> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY not configured");

  const res = await fetch(SEEDREAM_URL, {
    method: "POST",
    headers: {
      "Authorization": `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_urls: imageUrls,
      num_images: 1,
      // Belt-and-braces: forced 3:4 here AND a server-side center-crop in
      // enforce3by4AndStore. Wide-landscape source artworks (Hunters in
      // the Snow, View of Delft) get re-framed by Seedream into a portrait
      // crop that centres on the placement subject.
      image_size: { width: 1024, height: 1365 },
      output_format: "jpeg",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`seedream ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = (await res.json()) as { images?: Array<{ url: string }> };
  const url = data.images?.[0]?.url;
  if (!url) {
    throw new Error(`seedream returned no image: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return url;
}

// Order-of-images contract documented at the top of this file. First slot
// is the artwork, second slot is the pet photograph.
function imagesForArtwork(referenceUrl: string, petPhotoUrls: string[]): string[] {
  // Seedream input cap. We only ever send the most-relevant pet photo (the
  // first one in the session list) for Tab 3 — the placements are already
  // tightly scoped to one composition and extra refs hurt likeness more
  // than they help.
  const pet = petPhotoUrls[0];
  if (!pet) throw new Error("seedream.imagesForArtwork: no pet photo available");
  return [referenceUrl, pet].slice(0, SEEDREAM_MAX_IMAGES);
}

// One artwork × three placements. Mirrors generateAllStyles' partial-failure
// semantics: if 1 of 3 placements fails we still ship the rest (the user
// expects three placements of the chosen artwork, but two outputs is a
// better experience than refunding and showing nothing). Caller consumes
// one regen for the whole fan-out either way.
//
// Returns generations tagged with compound style keys
// `artwork:{artwork_slug}:{placement_slug}` so the rest of the system
// (gallery, PDP, cart, Stripe, success, emails) can route through the
// shared display label resolver to render the artwork title + placement.
export async function generateAllArtworkPlacements(
  ctx: any,
  artworkSlug: string,
  petPhotoUrls: string[],
  breeds: string[] | undefined,
  breed: string | undefined,
): Promise<{ style: string; imageUrl: string; printFileUrl: string }[]> {
  const artwork = (await ctx.runQuery(internal.artworks.getBySlugInternal, {
    slug: artworkSlug,
  })) as ArtworkContext | null;
  if (!artwork) throw new Error(`Unknown artwork: ${artworkSlug}`);
  if (artwork.placements.length === 0) {
    throw new Error(`Artwork has no placements: ${artworkSlug}`);
  }

  const tasks = artwork.placements.map(async (p) => {
    const prompt = buildArtworkPrompt(artwork, p, breeds, breed);
    const imageUrls = imagesForArtwork(artwork.referenceUrl, petPhotoUrls);
    const lowRes = await callSeedream(prompt, imageUrls);
    const display = await enforce3by4AndStore(ctx, lowRes);
    return {
      style: `artwork:${artwork.slug}:${p.slug}`,
      imageUrl: display,
      printFileUrl: display,
    };
  });

  const results = await Promise.allSettled(tasks);
  const generations: { style: string; imageUrl: string; printFileUrl: string }[] = [];
  const errors: string[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") generations.push(r.value);
    else errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
  }
  if (errors.length > 0) console.warn("Some placements failed:", errors);
  if (generations.length === 0) {
    throw new Error(errors[0] ?? "All placements failed");
  }
  return generations;
}

// Type marker — used by fal.ts to assert the shape of what gets returned.
// Suppresses the otherwise-unused Id import.
export type _ArtworkSessionId = Id<"sessions">;
