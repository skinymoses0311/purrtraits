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
// Pet-first ordering: image_urls = [...petPhotos, artworkRef]. Slots 1..N
// are pet reference photographs; slot N+1 (the last image) is the artwork.
//
// All 90 placement prompts in convex/artworksCatalog.ts use "the pet from
// the first images" / "treat the first images as likeness references only"
// to match this order. The lead built below names every slot explicitly so
// the model never has to infer which image is which.
//
// History: the original catalogue used "from the second image" with image
// order [artworkRef, petPhoto]. We flipped both together in one pass after
// observing weak likeness; pet-first matched the operator's hand-tested
// configuration that produced ship-quality output during §5 verification.

// Identity guard tuned for the artwork pipeline. Differs from the
// Nano Banana IDENTITY_GUARD in three ways:
//   • Drops "only change the style, never the pet itself" — for Tab 3 we DO
//     want the pet rendered in the artwork's medium (impasto, woodblock,
//     pointillist dots, etc.), and that line was confusing the model.
//   • References "the photograph" / "the artwork" by role rather than by
//     image slot, since the placement prompts already assert which is which.
//   • Keeps the 3:4 portrait + full-bleed + ignore-pet-environment guards.
//
// Identity language is intentionally repetitive and emphatic — Seedream
// otherwise reads the placement prompts' "treat the photograph as a likeness
// reference only — do not preserve any photographic texture from it" line as
// permission to discard breed-specific features along with the photographic
// rendering, drifting toward a breed-stereotypical pet. The repetition here
// counter-balances that.
const IDENTITY_GUARD_ARTWORK =
  "CRUCIAL — PET IDENTITY. The painted pet in the output must specifically be the individual pet shown in the photograph reference(s), NOT a breed-typical or generic example of the breed. Preserve the pet's exact breed, fur colour and pattern, distinctive markings, eye colour, ear shape and set, head shape, build, and overall proportions as visible in the photographs. If the pet's appearance differs from what is typical for the breed in any way — fur colour, markings, build, ear shape, eye colour — follow the photographs and ignore the breed stereotype. Multiple photographs may be supplied; cross-reference them to triangulate the pet's appearance, but the rendered subject must be one consistent individual matching the photographs. The pet is rendered in the visual language of the artwork (its brushwork, palette, and medium) — but rendering style is the only thing that changes. The breed, markings, and individual features remain unmistakably this specific pet, recognisable through the painted strokes. The output MUST be in 3:4 portrait orientation (taller than wide) — do not letterbox, pad, or add coloured bars. The image must be a full-bleed artwork with absolutely no border, frame, mat, passe-partout, vignette, decorative edging, painted edge, drawn rectangle, or coloured/white margin — the artwork must extend edge-to-edge to all four sides of the canvas. The pet photographs are for the pet's identity only — completely ignore and discard the room, walls, floor, ceiling, furniture, household objects, and any indoor environment visible behind or around the pet in those photographs. The setting of the output is the artwork's existing scene, not the photograph's room.";

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
  petPhotoCount: number,
): string {
  const yearPart = artwork.year ? `, ${artwork.year}` : "";
  // Lead names every image slot explicitly. Pet photos occupy slots 1..N;
  // the artwork is the last image. The catalog's placement prompts refer to
  // "the first images" for the pet, which matches this order.
  const photoSlot = petPhotoCount > 1
    ? `Images 1 through ${petPhotoCount} are reference photographs of the same pet for likeness reference only — cross-reference them to triangulate the pet's appearance.`
    : `The first image is a photograph of the pet for likeness reference only.`;
  const artworkSlot = petPhotoCount > 1
    ? `Image ${petPhotoCount + 1} (the last image) is the existing artwork "${artwork.title}" by ${artwork.artist}${yearPart}.`
    : `The second image is the existing artwork "${artwork.title}" by ${artwork.artist}${yearPart}.`;
  // Lead goes first so the framing rule is read before the placement-
  // specific instruction overrides any of the artwork's existing composition.
  const lead = `${FULL_BLEED_LEAD} ${photoSlot} ${artworkSlot}`;
  // The hand-authored placement fragment. Already contains the medium-led
  // "treat first images as likeness references only" guard, the preserved
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

// Order-of-images contract documented at the top of this file. Pet photos
// occupy slots 1..N; the artwork is the last image. Pet-first matches the
// catalog's "the pet from the first images" wording and the operator's
// hand-tested configuration.
//
// Sending all pet photos (not just the first one) is critical for likeness
// — Seedream cross-references multiple photos to triangulate the pet's
// individual appearance. With only one photo the model falls back on
// breed-typical features. Capped to leave room for the artwork in the
// final slot and stay under SEEDREAM_MAX_IMAGES.
function imagesForArtwork(referenceUrl: string, petPhotoUrls: string[]): string[] {
  if (petPhotoUrls.length === 0) {
    throw new Error("seedream.imagesForArtwork: no pet photo available");
  }
  const petPhotos = petPhotoUrls.slice(0, SEEDREAM_MAX_IMAGES - 1);
  return [...petPhotos, referenceUrl];
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

  const imageUrls = imagesForArtwork(artwork.referenceUrl, petPhotoUrls);
  // imageUrls[0..N-1] are pet photos; imageUrls[N] is the artwork.
  // petPhotoCount drives the lead's slot-by-slot description in the prompt.
  const petPhotoCount = imageUrls.length - 1;

  const tasks = artwork.placements.map(async (p) => {
    const prompt = buildArtworkPrompt(artwork, p, breeds, breed, petPhotoCount);
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
