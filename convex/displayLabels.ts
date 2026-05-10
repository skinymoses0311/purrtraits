// Shared resolver for the display string of a `style` key as stored on
// `generations[].style` and `galleryItems[].style`.
//
// Three key shapes are in circulation:
//
//   1. Style slugs        — flat strings like "oil", "watercolour" (Tab 1)
//   2. Artist slugs       — flat strings like "vangogh", "monet"   (Tab 2)
//   3. Compound artwork   — "artwork:{artwork_slug}:{placement_slug}" (Tab 3)
//
// `getStyleDisplay` translates all three into human-readable strings. Tab 1/2
// keys are resolved synchronously from STYLE_LABELS / ARTIST_LABELS bundled
// at build time. Tab 3 keys need an `ArtworkLookup` from
// `api.artworks.getLookup` because the catalog lives in Convex (operator can
// edit titles / disable artworks without a redeploy). Pass `undefined` for
// the lookup on call sites that haven't loaded it yet — Tab 1/2 keys still
// resolve, Tab 3 keys fall back to the raw key as a last resort.

import { ALL_STYLES, STYLE_LABELS } from "./styleScoring";
import { ALL_ARTISTS, ARTIST_LABELS } from "./artistScoring";

export type ArtworkLookup = Record<string, {
  title: string;
  artist: string;
  placements: Record<string, string>;
}>;

export function getStyleDisplay(key: string, artworks?: ArtworkLookup): string {
  // Tab 3 — compound key. Format: `artwork:{slug}:{placement}`.
  if (key.startsWith("artwork:")) {
    const [, artworkSlug, placementSlug] = key.split(":");
    const a = artworks?.[artworkSlug];
    if (!a) {
      // Lookup wasn't passed (e.g. older code path that hasn't been
      // migrated yet) or the artwork has been disabled. Fall back to a
      // best-effort humanisation of the slug rather than ship the raw key.
      return artworkSlug
        ? humaniseArtworkSlug(artworkSlug, placementSlug)
        : key;
    }
    const placementLabel = a.placements[placementSlug] ?? humanisePlacementSlug(placementSlug);
    return `${a.title} — ${placementLabel}`;
  }
  // Tab 1 — style slug.
  if ((ALL_STYLES as readonly string[]).includes(key)) {
    return STYLE_LABELS[key as keyof typeof STYLE_LABELS];
  }
  // Tab 2 — artist slug.
  if ((ALL_ARTISTS as readonly string[]).includes(key)) {
    return ARTIST_LABELS[key as keyof typeof ARTIST_LABELS];
  }
  // Unknown shape. Don't crash — render the raw key.
  return key;
}

function humaniseArtworkSlug(artworkSlug: string, placementSlug: string | undefined): string {
  const title = artworkSlug
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
  if (!placementSlug) return title;
  return `${title} — ${humanisePlacementSlug(placementSlug)}`;
}

function humanisePlacementSlug(placementSlug: string | undefined): string {
  if (!placementSlug) return "";
  return placementSlug
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}
