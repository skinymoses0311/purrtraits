/**
 * Tab 3 — Famous Art catalog.
 *
 * Source-of-truth for the 30 public-domain artworks shown on the third tab of
 * /style-pick. The seed script (scripts/upload-artwork-refs.ts) reads this
 * module, uploads each entry's reference JPEG from scripts/artwork-refs/ to
 * Convex storage, and upserts the row into the `artworks` table by slug.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE PLACEMENTS
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Each artwork has exactly THREE placements. A placement is a distinct
 * compositional treatment ("pet on the hilltop", "pet in the village", "pet
 * at the cypress base"). The user picks the artwork; the system fans out all
 * three placements into the three generation slots.
 *
 * Each placement has three fields:
 *   - slug:   URL-safe identifier, unique within the artwork. Becomes part
 *             of the compound style key `artwork:{artwork_slug}:{placement_slug}`.
 *             Example: "hilltop", "village", "cypress_base".
 *   - label:  Human-readable display label shown on /reveal, gallery, PDP,
 *             cart, success page, emails. Keep short — fits inside a card
 *             pill. Example: "On the hilltop", "By the village".
 *   - prompt: The medium-led placement fragment passed to Seedream v4. This
 *             is concatenated into the full prompt at generation time
 *             alongside FULL_BLEED_LEAD, the breed primacy clause, and
 *             IDENTITY_GUARD.
 *
 * Each placement prompt follows a five-point template:
 *   (a) name the position concretely,
 *   (b) repeat the medium-led likeness guard,
 *   (c) preserve the iconic existing scene elements,
 *   (d) tie the pet's rendering to the artwork's specific brushwork/medium/
 *       palette,
 *   (e) end with the likeness-recognisability clause.
 *
 * Aspect ratio is forced to 3:4 by the pipeline; placements never mention it.
 * For wide landscapes (Hunters in the Snow, View of Delft, Hay Wain) the
 * placement describes a sub-region that stands as a portrait crop.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * IDEMPOTENCY
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The seed script keys on `slug`. Re-running it with edited placement
 * prompts will patch the existing row in place — it won't duplicate.
 * `clickCount` is preserved across re-runs (the script never overwrites it).
 */

export type CatalogPlacement = {
  /** URL-safe identifier, unique within the artwork. */
  slug: string;
  /** Short human-readable label shown in display strings. */
  label: string;
  /** Medium-led prompt fragment passed to Seedream v4. */
  prompt: string;
};

export type CatalogArtwork = {
  /** URL-safe identifier; locked across catalogue revisions. */
  slug: string;
  title: string;
  artist: string;
  year?: string;
  era:
    | "post-impressionist"
    | "impressionist"
    | "japanese-woodblock"
    | "romantic"
    | "northern-renaissance"
    | "symbolist"
    | "art-nouveau"
    | "dutch-golden-age"
    | "renaissance";
  /** Filename inside scripts/artwork-refs/ — see MANIFEST.md. */
  refFilename: string;
  /** Exactly three placements. The seed script validates the count. */
  placements: [CatalogPlacement, CatalogPlacement, CatalogPlacement];
};

export const ARTWORKS_CATALOG: CatalogArtwork[] = [
  // ─── Post-Impressionist ─────────────────────────────────────────────────
  {
    slug: "starry_night",
    title: "The Starry Night",
    artist: "Vincent van Gogh",
    year: "1889",
    era: "post-impressionist",
    refFilename: "starry_night.jpg",
    placements: [
      {
        slug: "hilltop",
        label: "On the hilltop",
        prompt:
          "Add the pet from the first images standing on the dark hilltop in the foreground, looking up at the swirling night sky. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet must be built from the same thick post-impressionist impasto brushwork as the cypress and sky, in the same ultramarine, chrome-yellow and viridian palette. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "village",
        label: "By the village",
        prompt:
          "Add the pet from the first images trotting along the path between the houses of the sleeping village. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Van Gogh impasto brushwork as the village walls and church spire. The cypress, the swirling sky and the hills behind remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "cypress_base",
        label: "Beneath the cypress",
        prompt:
          "Add the pet from the first images sitting at the base of the tall dark cypress tree in the left foreground. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same swirling impasto brushwork as the cypress and the night sky, painted in the same ultramarine, chrome-yellow and viridian palette. The village, hills and stars remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },
  {
    slug: "wheatfield_crows",
    title: "Wheatfield with Crows",
    artist: "Vincent van Gogh",
    year: "1890",
    era: "post-impressionist",
    refFilename: "wheatfield_crows.jpg",
    placements: [
      {
        slug: "wheat",
        label: "In the wheat",
        prompt:
          "Add the pet from the first images standing waist-deep in the rippling golden wheatfield, looking up toward the wheeling black crows. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet must be built from the same thick Van Gogh impasto strokes as the wheat and sky, in the same chrome-yellow, ultramarine and viridian palette. The crows, the diverging paths and the turbulent blue-black sky remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "path_fork",
        label: "At the path fork",
        prompt:
          "Add the pet from the first images trotting along the central dirt path where the three tracks diverge through the wheat. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same heavy post-impressionist impasto brushwork as the path and surrounding wheat, in the same chrome-yellow, red-ochre and ultramarine palette. The crows wheeling above and the turbulent low sky remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "foreground",
        label: "In the foreground",
        prompt:
          "Add the pet from the first images lying down at the very front edge of the wheatfield, the crows whirling overhead. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same thick swirling impasto strokes as the wheat ears and turbulent sky, painted in the same chrome-yellow, ultramarine and viridian palette. The three diverging paths and the flock of black crows remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },
  {
    slug: "cafe_terrace",
    title: "The Café Terrace at Night",
    artist: "Vincent van Gogh",
    year: "1888",
    era: "post-impressionist",
    refFilename: "cafe_terrace.jpg",
    placements: [
      {
        slug: "terrace",
        label: "On the terrace",
        prompt:
          "Add the pet from the first images sitting on the yellow-lit café terrace beside the seated figures and tables. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same thick Van Gogh impasto strokes as the terrace floor and awning, in the same chrome-yellow, cobalt-blue and warm orange palette. The cobbled street, starry night sky and distant figures remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "cobbles",
        label: "On the cobbles",
        prompt:
          "Add the pet from the first images standing on the blue cobblestone street just beyond the warm glow of the terrace. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet must share the same heavy impasto brushwork as the cobbles and night-blue buildings, in the same cobalt, ultramarine and chrome-yellow palette. The seated patrons, lit awning and starry sky remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "alley",
        label: "In the alley",
        prompt:
          "Add the pet from the first images trotting away down the receding cobbled alley toward the deeper blue night. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Van Gogh impasto strokes as the alley walls and starry sky, in the same cobalt, chrome-yellow and viridian palette. The lit terrace, seated figures and distant pedestrians remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
    ],
  },
  {
    slug: "sunflowers",
    title: "Sunflowers",
    artist: "Vincent van Gogh",
    year: "1888",
    era: "post-impressionist",
    refFilename: "sunflowers.jpg",
    placements: [
      {
        slug: "tabletop",
        label: "On the tabletop",
        prompt:
          "Add the pet from the first images curled up on the wooden tabletop beside the yellow earthenware vase of sunflowers. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same thick Van Gogh impasto strokes as the petals and vase, in the same chrome-yellow, ochre and burnt-sienna palette. The fourteen sunflowers, the signed vase and the yellow ground remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "behind_vase",
        label: "Behind the vase",
        prompt:
          "Add the pet from the first images peering out from behind the yellow earthenware vase of sunflowers, head visible above the rim. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same heavy impasto brushwork as the petals and vase, in the same chrome-yellow, ochre and umber palette. The bouquet of fourteen sunflowers and the warm yellow background remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "tableside",
        label: "Beside the table",
        prompt:
          "Add the pet from the first images sitting upright at the edge of the yellow tabletop, looking up at the sunflower bouquet. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Van Gogh impasto strokes as the tabletop and vase, in the same chrome-yellow, ochre and burnt-sienna palette. The vase, signature, sunflowers and yellow ground remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
    ],
  },
  {
    slug: "bedroom_arles",
    title: "Bedroom in Arles",
    artist: "Vincent van Gogh",
    year: "1888",
    era: "post-impressionist",
    refFilename: "bedroom_arles.jpg",
    placements: [
      {
        slug: "on_bed",
        label: "On the bed",
        prompt:
          "Add the pet from the first images lying curled on the red blanket of the wooden bed in the centre of the room. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same thick Van Gogh impasto strokes as the blanket and bedposts, in the same yellow ochre, cobalt-blue and vermilion palette. The two chairs, framed pictures, washbasin and window remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "by_chair",
        label: "Beside the chair",
        prompt:
          "Add the pet from the first images sitting on the tilted wooden floor beside the rush-seat chair in the foreground. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same heavy impasto brushwork as the floorboards and chair, in the same yellow ochre, cobalt-blue and red palette. The bed, framed pictures on the wall and shuttered window remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "doorway",
        label: "By the doorway",
        prompt:
          "Add the pet from the first images standing alert just inside the doorway at the back of the tilted-perspective bedroom. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Van Gogh impasto strokes as the walls and door, in the same yellow ochre, cobalt-blue and vermilion palette. The bed, two chairs, framed pictures and washbasin remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },
  {
    slug: "basket_apples",
    title: "Still Life with Basket of Apples",
    artist: "Paul Cézanne",
    year: "1895",
    era: "post-impressionist",
    refFilename: "basket_apples.jpg",
    placements: [
      {
        slug: "tabletop",
        label: "On the tabletop",
        prompt:
          "Add the pet from the first images lying on the folded white cloth of the tabletop beside the tilted basket of apples. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet must be built from the same Cézanne faceted constructive brushstrokes as the cloth and apples, in the same red-ochre, deep green, cream and umber palette. The leaning wine bottle, stacked biscuits and tilted apple basket remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "behind_bottle",
        label: "Behind the bottle",
        prompt:
          "Add the pet from the first images sitting behind the dark wine bottle, head visible against the muted backdrop. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same Cézanne planar constructive brushwork as the bottle and table, in the same deep green, red-ochre, cream and slate palette. The basket of apples, folded cloth and stacked biscuits in the foreground remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "front_apples",
        label: "Among the apples",
        prompt:
          "Add the pet from the first images curled in front of the tabletop beside the loose apples that have rolled from the basket. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Cézanne faceted constructive strokes as the apples and cloth, in the same red-ochre, deep green, cream and umber palette. The tilted basket, leaning wine bottle and biscuits remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },
  {
    slug: "mont_sainte_victoire",
    title: "Mont Sainte-Victoire",
    artist: "Paul Cézanne",
    year: "1904",
    era: "post-impressionist",
    refFilename: "mont_sainte_victoire.jpg",
    placements: [
      {
        slug: "field",
        label: "In the foreground field",
        prompt:
          "Add the pet from the first images standing in a green-ochre field of the foreground Provence landscape. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Cézanne fragmented constructive brushstrokes as the fields and houses, in the same green-ochre, terracotta, lavender and pale-blue palette. The pale-blue Mont Sainte-Victoire on the right, the patchwork plain and small houses remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "near_houses",
        label: "By the houses",
        prompt:
          "Add the pet from the first images sitting on the path beside the small terracotta-roofed houses scattered across the plain. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same Cézanne planar constructive brushwork as the rooftops and fields, in the same terracotta, green-ochre, lavender and pale-blue palette. The rising Mont Sainte-Victoire, the broken patchwork landscape and the soft sky remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "ridge_path",
        label: "On the ridge path",
        prompt:
          "Add the pet from the first images trotting along a ridge path in the middle distance, the mountain rising directly behind. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Cézanne faceted constructive strokes as the ridge and mountain, in the same green-ochre, lavender, terracotta and pale-blue palette. The pale-blue Mont Sainte-Victoire, the houses and patchwork fields remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },

  // ─── Impressionist ──────────────────────────────────────────────────────
  {
    slug: "impression_sunrise",
    title: "Impression, Sunrise",
    artist: "Claude Monet",
    year: "1872",
    era: "impressionist",
    refFilename: "impression_sunrise.jpg",
    placements: [
      {
        slug: "near_boat",
        label: "Near the rowboat",
        prompt:
          "Add the pet from the first images sitting in the prow of the small rowing boat in the centre of the hazy harbour. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same loose Monet impressionist dabs as the water and dawn mist, in the same grey-blue, slate and orange palette. The orange sun, distant ship masts and rippling reflections remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "quayside",
        label: "On the quayside",
        prompt:
          "Add the pet from the first images standing at the dim stone quayside in the lower foreground, watching the misty harbour. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same broken impressionist brushwork as the silhouetted boats and dawn fog, in the same grey-blue, mauve and warm orange palette. The rising sun, two rowing boats and ship masts in the mist remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "second_boat",
        label: "In the second boat",
        prompt:
          "Add the pet from the first images perched on the seat of the smaller boat further back in the harbour mist. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Monet feathery impressionist dabs as the water and haze, in the same grey-blue, slate-mauve and orange palette. The orange sun glowing on the water and the silhouetted ship masts remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },
  {
    slug: "water_lilies_bridge",
    title: "Bridge over a Pond of Water Lilies",
    artist: "Claude Monet",
    year: "1899",
    era: "impressionist",
    refFilename: "water_lilies_bridge.jpg",
    placements: [
      {
        slug: "on_bridge",
        label: "On the bridge",
        prompt:
          "Add the pet from the first images standing on the centre of the green Japanese footbridge, looking down at the lily pond. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Monet broken impressionist dabs as the bridge planks and weeping willow, in the same emerald-green, mauve and rose palette. The arching willow foliage, lily pads and reflective pond remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "bank",
        label: "On the bank",
        prompt:
          "Add the pet from the first images lying on the grassy bank at the edge of the lily pond, just below the bridge. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same feathery impressionist brushwork as the reeds and pond, in the same emerald, viridian, mauve and pink palette. The arched green footbridge, weeping willow foliage and floating lily pads remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "bridge_end",
        label: "At the bridge end",
        prompt:
          "Add the pet from the first images sitting at the right-hand foot of the arched green footbridge where it meets the bank. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Monet broken impressionist dabs as the bridge and surrounding foliage, in the same green, mauve and rose-pink palette. The drooping willow above, lily-pad-strewn pond and bridge arch remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },
  {
    slug: "poppies_argenteuil",
    title: "Poppies near Argenteuil",
    artist: "Claude Monet",
    year: "1873",
    era: "impressionist",
    refFilename: "poppies_argenteuil.jpg",
    placements: [
      {
        slug: "in_poppies",
        label: "In the poppies",
        prompt:
          "Add the pet from the first images standing waist-deep among the scattered red poppies on the sunlit hillside. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same loose Monet impressionist dabs as the meadow grass and poppies, in the same vermilion-red, fresh green and sky-blue palette. The parasolled woman with child, the upper pair of figures and the distant trees remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "by_parasol",
        label: "Beside the parasol",
        prompt:
          "Add the pet from the first images trotting alongside the woman with the parasol and child in the lower foreground meadow. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same feathery impressionist brushwork as the grass and poppies, in the same red, green and pale-blue palette. The second pair of figures higher up the slope, the distant trees and the bright summer sky remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "hill_top",
        label: "On the hill",
        prompt:
          "Add the pet from the first images standing higher up the poppy-strewn slope near the second pair of figures. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Monet broken impressionist dabs as the meadow grass, in the same vermilion, green and sky-blue palette. The lower pair with parasol, the scattered red poppies and the distant tree line remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },
  {
    slug: "the_magpie",
    title: "The Magpie",
    artist: "Claude Monet",
    year: "1869",
    era: "impressionist",
    refFilename: "the_magpie.jpg",
    placements: [
      {
        slug: "by_gate",
        label: "By the gate",
        prompt:
          "Add the pet from the first images standing in the snow just below the wooden gate where the magpie is perched. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Monet feathery impressionist brushwork as the snow drifts and wattle fence, in the same cool white, lilac-grey and warm-shadow palette. The lone magpie, wattle fence and snow-covered farm beyond remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "long_shadow",
        label: "In the long shadow",
        prompt:
          "Add the pet from the first images lying down in the long blue shadow stretching across the foreground snow. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same broken impressionist dabs as the snow and shadow, in the same cool whites, lavenders and pale ochres. The wooden gate, perched magpie and snow-buried farm buildings remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "fence_line",
        label: "Along the fence",
        prompt:
          "Add the pet from the first images walking along the wattle fence line, the snowy farm buildings rising behind. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Monet feathery impressionist strokes as the snow and fence, in the same cool whites, lilac-grey and ochre palette. The perched magpie, gate and long blue shadow on the snow remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },
  {
    slug: "houses_parliament_sunset",
    title: "Houses of Parliament, Sunset",
    artist: "Claude Monet",
    year: "1903",
    era: "impressionist",
    refFilename: "houses_parliament_sunset.jpg",
    placements: [
      {
        slug: "near_bank",
        label: "On the near bank",
        prompt:
          "Add the pet from the first images standing on the dim near bank of the Thames, silhouetted against the burning sky. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Monet hazy impressionist dabs as the river and atmospheric mist, in the same orange, mauve and indigo palette. The Westminster towers in silhouette, the rippling reflections and the hazy sunset sky remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "river_edge",
        label: "By the river",
        prompt:
          "Add the pet from the first images sitting at the very edge of the rippling Thames, gazing toward Parliament across the water. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same broken impressionist brushwork as the water and atmospheric haze, in the same orange-purple, mauve and slate palette. The silhouetted Houses of Parliament, the burning sky and reflected colours remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "skyline_fore",
        label: "Before the skyline",
        prompt:
          "Add the pet from the first images standing on the small foreground bank, the dark Westminster skyline rising directly behind. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Monet hazy impressionist dabs as the silhouettes and river, in the same orange-purple, indigo and rose palette. The pointed Parliament towers, sunset sky and rippling river reflections remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },
  {
    slug: "grande_jatte",
    title: "A Sunday on La Grande Jatte",
    artist: "Georges Seurat",
    year: "1884",
    era: "impressionist",
    refFilename: "grande_jatte.jpg",
    placements: [
      {
        slug: "lawn_shade",
        label: "In the shade",
        prompt:
          "Add the pet from the first images lying on the grass in the cool dappled shade of the foreground tree on the left. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet must be built from the same dense Seurat pointillist dots as the lawn and shade, in the same emerald-green, lavender, orange and dot-broken palette. The parasolled woman with monkey, reclining man and sailboats on the river remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "near_parasol",
        label: "Near the parasol",
        prompt:
          "Add the pet from the first images sitting beside the standing woman with parasol and her small leashed monkey in the right foreground. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same fine pointillist dotting as the figures and grass, in the same emerald, ochre, lavender and rose palette. The reclining man, the sailboats on the river and the strolling Sunday figures remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "river_view",
        label: "By the river",
        prompt:
          "Add the pet from the first images standing at the river's edge on the right, watching the white sailboats glide past. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same pointillist dots as the riverbank and water, in the same emerald, lavender, ochre and pale-blue palette. The Sunday strollers, the parasols, the leashed monkey and the dappled tree shade remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },
  {
    slug: "boulevard_montmartre_night",
    title: "Boulevard Montmartre at Night",
    artist: "Camille Pissarro",
    year: "1897",
    era: "impressionist",
    refFilename: "boulevard_montmartre_night.jpg",
    placements: [
      {
        slug: "wet_pavement",
        label: "On the wet pavement",
        prompt:
          "Add the pet from the first images standing on the rain-slicked pavement in the lit foreground of the boulevard. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Pissarro short impressionist strokes as the gleaming pavement and gas-lamp glow, in the same gold-orange, deep-violet and slate palette. The carriages, strolling figures and Haussmann façades flanking the boulevard remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "lamplit_curb",
        label: "By the lamplight",
        prompt:
          "Add the pet from the first images sitting just under the warm pool of a gas-lamp at the curb of the night boulevard. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same flecked impressionist brushwork as the lamps and wet stone, in the same warm orange, indigo and grey-violet palette. The receding line of carriages, the small dark figures and the lit shopfronts remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "near_carriage",
        label: "Near a carriage",
        prompt:
          "Add the pet from the first images trotting alongside one of the dark carriages rolling down the centre of the boulevard. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Pissarro short flickering strokes as the carriage and pavement reflections, in the same gold-orange, deep-violet and slate palette. The gas-lamp pools, distant figures and tall Haussmann buildings remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },
  {
    slug: "path_long_grass",
    title: "Path Climbing through Long Grass",
    artist: "Pierre-Auguste Renoir",
    year: "1876",
    era: "impressionist",
    refFilename: "path_long_grass.jpg",
    placements: [
      {
        slug: "on_path",
        label: "On the path",
        prompt:
          "Add the pet from the first images standing on the sunlit dirt path winding up between the tall summer grasses. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Renoir feathery impressionist dabs as the grass and dappled light, in the same warm green, gold and rose-poppy palette. The parasolled women climbing the slope, the scattered red poppies and the distant trees remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "in_grass",
        label: "In the long grass",
        prompt:
          "Add the pet from the first images bounding through the chest-high tall grasses just off the path. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same soft feathery brushwork as the swaying grass and poppies, in the same warm green, gold-yellow and red palette. The figures climbing with parasols, the speckled poppies and the leafy trees behind remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "near_figures",
        label: "Near the figures",
        prompt:
          "Add the pet from the first images walking ahead of the parasolled figures partway up the sunlit slope. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Renoir broken impressionist dabs as the grass and parasols, in the same warm green, gold and rose palette. The winding path, scattered red poppies and distant tree line remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },

  // ─── Romantic ───────────────────────────────────────────────────────────
  {
    slug: "hay_wain",
    title: "The Hay Wain",
    artist: "John Constable",
    year: "1821",
    era: "romantic",
    refFilename: "hay_wain.jpg",
    placements: [
      {
        slug: "river_bank",
        label: "On the river bank",
        prompt:
          "Add the pet from the first images standing on the grassy near bank of the shallow river just behind the existing dog. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Constable scumbled oil brushwork as the bank and rippled water, in the same earthy green, warm umber and cool sky-blue palette. Willy Lott's cottage on the left, the horse-drawn hay wagon and big English sky remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "by_cottage",
        label: "By the cottage",
        prompt:
          "Add the pet from the first images sitting on the worn path beside Willy Lott's brick cottage on the left bank. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same scumbled Constable brushwork as the cottage walls and trees, in the same earthy red-brown, mossy green and cool blue palette. The hay wagon mid-river, the existing dog on the bank and the rolling cloud sky remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "in_shallows",
        label: "In the shallows",
        prompt:
          "Add the pet from the first images wading in the shallow river just beside the slow-moving hay wagon and its horses. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Constable broken oil strokes as the rippled water and reflected sky, in the same warm umber, mossy green and cool blue palette. The wagon, cottage on the bank and clouded English sky remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },
  {
    slug: "fighting_temeraire",
    title: "The Fighting Temeraire",
    artist: "J.M.W. Turner",
    year: "1839",
    era: "romantic",
    refFilename: "fighting_temeraire.jpg",
    placements: [
      {
        slug: "near_water",
        label: "On the foreground water",
        prompt:
          "Add the pet from the first images standing on a small dark mooring float in the rippling foreground water of the Thames. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Turner soft atmospheric oil washes as the water and burning sky, in the same fiery orange, gold, deep slate and pale ivory palette. The ghostly white tall ship, the dark steam tug and the blazing sunset remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "tug_deck",
        label: "On the tug deck",
        prompt:
          "Add the pet from the first images sitting on the smoky deck of the small dark steam tug pulling the Temeraire. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same Turner blurred atmospheric brushwork as the tug and sky, in the same deep slate, fiery orange, gold and ivory palette. The pale tall ship being towed, the reflective Thames and the sunset sky remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "ship_prow",
        label: "On the prow",
        prompt:
          "Add the pet from the first images perched on the bowsprit of the ghostly white Temeraire as it glides across the water. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Turner dissolving washes as the pale ship and luminous sky, in the same ivory, gold, deep slate and fiery orange palette. The dark steam tug ahead, sunset reflections and burning Thames sky remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },
  {
    slug: "rain_steam_speed",
    title: "Rain, Steam and Speed",
    artist: "J.M.W. Turner",
    year: "1844",
    era: "romantic",
    refFilename: "rain_steam_speed.jpg",
    placements: [
      {
        slug: "on_track",
        label: "On the track",
        prompt:
          "Add the pet from the first images standing on the wet rails just ahead of the rushing black steam locomotive. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Turner blurred atmospheric oil washes as the rain and steam, in the same warm ochre, smoky brown, slate and pale gold palette. The dark locomotive, the railway viaduct and the driving rain sweeping across the river remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "viaduct_edge",
        label: "At the viaduct edge",
        prompt:
          "Add the pet from the first images sitting on the stone parapet of the railway viaduct as the locomotive rushes past. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same Turner dissolving brushwork as the masonry and atmospheric haze, in the same warm ochre, smoky umber, slate and gold palette. The hurtling steam train, the rain-streaked sky and the river below remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "field_below",
        label: "In the field below",
        prompt:
          "Add the pet from the first images standing alert in the misty field beneath the viaduct, watching the train rush overhead. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Turner soft atmospheric washes as the rain and haze, in the same warm ochre, smoky brown, slate and pale gold palette. The black locomotive, the arched viaduct and the small hare ahead of the engine remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },

  // ─── Japanese woodblock ─────────────────────────────────────────────────
  {
    slug: "great_wave",
    title: "The Great Wave off Kanagawa",
    artist: "Katsushika Hokusai",
    year: "1831",
    era: "japanese-woodblock",
    refFilename: "great_wave.jpg",
    placements: [
      {
        slug: "in_boat",
        label: "In the lead boat",
        prompt:
          "Add the pet from the first images crouched in the centre of the foremost slender boat as the wave looms above. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet must be built from the same flat ukiyo-e woodblock outlines and gradient fills as the boats and rowers, in the same Prussian-blue, indigo, pale beige and white-foam palette. The towering claw-foam wave, the other slender boats and distant Mount Fuji remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "second_boat",
        label: "In the second boat",
        prompt:
          "Add the pet from the first images perched at the prow of the second slender rowing boat further back from the cresting wave. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same flat ukiyo-e woodblock outlines as the boats and oarsmen, in the same Prussian-blue, indigo, beige and white palette. The enormous cresting wave with claw-foam, the third boat and Mount Fuji on the horizon remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "near_fuji",
        label: "Near Mount Fuji",
        prompt:
          "Add the pet from the first images standing on a small spit of land in the middle distance just below the snow-capped Mount Fuji. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same flat ukiyo-e woodblock lines and gradient fills as the sky and Fuji, in the same Prussian-blue, indigo, beige and white palette. The huge cresting wave, the slender boats and rowers remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },
  {
    slug: "red_fuji",
    title: "Fine Wind, Clear Morning (Red Fuji)",
    artist: "Katsushika Hokusai",
    year: "1831",
    era: "japanese-woodblock",
    refFilename: "red_fuji.jpg",
    placements: [
      {
        slug: "foot_slope",
        label: "At the foot",
        prompt:
          "Add the pet from the first images standing on the dark green forested slope at the very base of Mount Fuji. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet must be built from the same flat ukiyo-e woodblock outlines and gradient fills as the trees, in the same deep green, red-ochre and Prussian-blue palette. The red glowing Fuji, the mackerel-cloud sky and the blue summit shadow remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "ridge_line",
        label: "On the ridge",
        prompt:
          "Add the pet from the first images standing on the dark ridge line halfway up the slope just beneath the red mountain. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same flat ukiyo-e woodblock outlines as the ridges and forest, in the same deep green, red-ochre and Prussian-blue palette. The simplified red Fuji, the flat blue sky and the rows of mackerel clouds remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "forest_edge",
        label: "By the forest",
        prompt:
          "Add the pet from the first images sitting at the dark green forest edge in the lower foreground, looking up at Fuji. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same flat ukiyo-e woodblock outlines and gradient fills as the trees, in the same deep green, red-ochre and Prussian-blue palette. The glowing red Fuji, the blue sky and the patterned mackerel clouds remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },
  {
    slug: "ejiri_suruga",
    title: "Ejiri in Suruga Province",
    artist: "Katsushika Hokusai",
    year: "1832",
    era: "japanese-woodblock",
    refFilename: "ejiri_suruga.jpg",
    placements: [
      {
        slug: "on_road",
        label: "On the road",
        prompt:
          "Add the pet from the first images standing on the windy coastal road among the travellers clutching their hats. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same flat ukiyo-e woodblock outlines and gradient fills as the figures and grass, in the same beige, pale green and Prussian-blue palette. The papers blown into the air, the snatched hat and the distant Mount Fuji remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "grass_clump",
        label: "By the grass",
        prompt:
          "Add the pet from the first images crouched low beside a clump of windswept grasses on the verge of the road. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same flat ukiyo-e woodblock outlines as the bowing grass and travellers, in the same pale green, beige and Prussian-blue palette. The flying papers, the figures bracing in the gust and Mount Fuji on the horizon remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "fuji_view",
        label: "Toward Fuji",
        prompt:
          "Add the pet from the first images standing on the road further back, facing the distant grey-blue silhouette of Mount Fuji. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same flat ukiyo-e woodblock outlines and gradient fills as the road and trees, in the same beige, pale green and Prussian-blue palette. The travellers struggling in the wind and the airborne papers and hat remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },
  {
    slug: "shin_ohashi_shower",
    title: "Sudden Shower over Shin-Ōhashi Bridge",
    artist: "Utagawa Hiroshige",
    year: "1857",
    era: "japanese-woodblock",
    refFilename: "shin_ohashi_shower.jpg",
    placements: [
      {
        slug: "on_bridge",
        label: "On the bridge",
        prompt:
          "Add the pet from the first images trotting across the wooden planks of the Shin-Ohashi bridge among the figures sheltering under hats and umbrellas. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same flat ukiyo-e woodblock outlines and rain-streaked gradient fills as the figures, in the same indigo, slate-grey and warm beige palette. The driving diagonal rain, the dark river below and the distant raft remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "raft",
        label: "On the raft",
        prompt:
          "Add the pet from the first images standing on the small raft drifting through the rain on the dark river beneath the bridge. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same flat woodblock outlines as the raft and water, in the same indigo, slate-grey and beige palette. The rain-soaked Shin-Ohashi bridge above with its sheltering figures and the diagonal lines of falling rain remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "bridge_end",
        label: "At the bridge end",
        prompt:
          "Add the pet from the first images sitting at the far end of the wooden bridge as figures hurry past in the rain. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same flat ukiyo-e woodblock outlines and gradient fills as the bridge timbers, in the same indigo, slate-grey and warm beige palette. The diagonal rain, the umbrellas and straw hats and the dark river below remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },
  {
    slug: "plum_garden_kameido",
    title: "Plum Garden in Kameido",
    artist: "Utagawa Hiroshige",
    year: "1857",
    era: "japanese-woodblock",
    refFilename: "plum_garden_kameido.jpg",
    placements: [
      {
        slug: "behind_branch",
        label: "Behind the branch",
        prompt:
          "Add the pet from the first images sitting behind the twisted dark plum trunk in the extreme close-up foreground. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same flat ukiyo-e woodblock outlines and gradient fills as the bark and blossom, in the same dark wood-brown, white-blossom and rose-pink sky palette. The white plum blossom, the trees beyond and the small figures in the garden remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "garden_path",
        label: "On the garden path",
        prompt:
          "Add the pet from the first images standing on the garden path among the smaller plum trees in the middle distance. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same flat ukiyo-e woodblock outlines as the trees and figures, in the same dark brown, white-blossom and pink-sky palette. The dramatic foreground branch, the white plum blossom and the strolling figures remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "blossom_base",
        label: "By the trunk",
        prompt:
          "Add the pet from the first images curled at the foot of the foreground plum trunk among fallen white petals. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same flat ukiyo-e woodblock outlines and gradient fills as the trunk and ground, in the same dark wood-brown, white-blossom and rose-pink palette. The twisted trunk, the white blossom and the figures beyond remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },

  // ─── Northern Renaissance ───────────────────────────────────────────────
  {
    slug: "hunters_snow",
    title: "Hunters in the Snow",
    artist: "Pieter Bruegel the Elder",
    year: "1565",
    era: "northern-renaissance",
    refFilename: "hunters_snow.jpg",
    placements: [
      {
        slug: "with_hunters",
        label: "With the hunters",
        prompt:
          "Add the pet from the first images trotting alongside the existing hounds beside the three hunters descending the snowy hill. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Bruegel meticulous Northern Renaissance oil glazing as the hunters and snow, in the same cool ivory, slate, ochre and pine-green palette. The trudging hunters, the magpies in the bare trees and the valley below remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "ridge_top",
        label: "On the ridge",
        prompt:
          "Add the pet from the first images standing on the snowy ridge ahead of the hunters, looking down toward the valley. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same Bruegel precise Northern Renaissance brushwork as the snow and bare trees, in the same cool ivory, slate-blue and pine-green palette. The hunting party, the existing dogs and the magpies on bare branches remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "by_tree",
        label: "By a bare tree",
        prompt:
          "Add the pet from the first images sitting in the snow at the foot of one of the dark bare trees on the slope. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Bruegel meticulous oil glazing as the snow and trees, in the same cool ivory, slate, ochre and pine-green palette. The descending hunters, the dogs, the perched magpies and the frozen valley below remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },
  {
    slug: "tower_babel",
    title: "The Tower of Babel",
    artist: "Pieter Bruegel the Elder",
    year: "1563",
    era: "northern-renaissance",
    refFilename: "tower_babel.jpg",
    placements: [
      {
        slug: "tower_base",
        label: "At the tower base",
        prompt:
          "Add the pet from the first images standing on the masonry-strewn ground at the base of the spiralling tower. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Bruegel meticulous Northern Renaissance oil glazing as the stonework and labourers, in the same warm ochre, terracotta, slate and pine-green palette. The spiralling tower rising into the clouds, the harbour ships and the tiny labourers remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "harbour",
        label: "By the harbour",
        prompt:
          "Add the pet from the first images sitting on the dock among the small ships moored at the foot of the tower. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same Bruegel precise oil brushwork as the ships and quayside, in the same warm ochre, terracotta and pine-green palette. The colossal spiralling tower, the cranes hauling stone and the dwarfed labourers remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "ramp",
        label: "On the ramp",
        prompt:
          "Add the pet from the first images trotting up the broad spiral ramp on the lower tier of the unfinished tower. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Bruegel meticulous Northern Renaissance glazing as the masonry and figures, in the same warm ochre, terracotta, slate and pine-green palette. The spiralling tower, the cloud-piercing summit and the tiny labourers and cranes remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },
  {
    slug: "garden_earthly_delights",
    title: "The Garden of Earthly Delights (centre panel)",
    artist: "Hieronymus Bosch",
    year: "c.1500",
    era: "northern-renaissance",
    refFilename: "garden_earthly_delights.jpg",
    placements: [
      {
        slug: "foreground_pond",
        label: "By the foreground pond",
        prompt:
          "Add the pet from the first images standing at the edge of the bright foreground pond in the centre panel. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Bosch jewel-bright Northern Renaissance oil glazing as the pond and surrounding figures, in the same pastel pink, turquoise, cream and grass-green palette. The fantastical pink rock formations, the central fountain and the surreal background creatures remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "near_fountain",
        label: "Near the fountain",
        prompt:
          "Add the pet from the first images sitting on the grass beside the strange pink fountain rising from the central pool. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same Bosch precise jewel-toned brushwork as the fountain and pastel landscape, in the same pink, turquoise, cream and pale-green palette. The fantastical rocks, the bright pond and the distant surreal creatures remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "clearing",
        label: "In a clearing",
        prompt:
          "Add the pet from the first images standing alert in a small grassy clearing in the lower foreground of the panel. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Bosch jewel-bright Northern Renaissance glazing as the grass and pastel rocks, in the same pink, turquoise, cream and grass-green palette. The bright central pond, the fantastical fountain and the surreal pink rock formations remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },

  // ─── Dutch Golden Age ───────────────────────────────────────────────────
  {
    slug: "view_of_delft",
    title: "View of Delft",
    artist: "Johannes Vermeer",
    year: "1660–61",
    era: "dutch-golden-age",
    refFilename: "view_of_delft.jpg",
    placements: [
      {
        slug: "near_bank",
        label: "On the near bank",
        prompt:
          "Add the pet from the first images standing on the sandy near bank between the two pairs of small figures. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet must be rendered in the same Vermeer-precise glazing as the figures and bank, in the same dusky umber, slate, warm ochre and broken-cloud-grey palette. The Delft skyline across the canal, the sunlit church spire and the calm reflective water remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "by_figures",
        label: "Beside the figures",
        prompt:
          "Add the pet from the first images sitting just beside the standing pair of figures conversing on the foreground bank. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same Vermeer-precise glazing as the figures and gravel, in the same dusky umber, slate, warm ochre and pale-cloud palette. The shadowed Delft buildings across the canal, the sunlit spire and the broken cumulus sky remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "water_edge",
        label: "At the water's edge",
        prompt:
          "Add the pet from the first images standing at the very edge of the canal, looking across at the Delft skyline. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Vermeer-precise glazing as the bank and reflective water, in the same dusky umber, slate, warm ochre and pale-cloud palette. The sunlit church spire, the shadowed buildings and the cumulus sky above them remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },

  // ─── Symbolist ──────────────────────────────────────────────────────────
  {
    slug: "falling_rocket",
    title: "Nocturne in Black and Gold: The Falling Rocket",
    artist: "James McNeill Whistler",
    year: "1875",
    era: "symbolist",
    refFilename: "falling_rocket.jpg",
    placements: [
      {
        slug: "near_crowd",
        label: "By the crowd",
        prompt:
          "Add the pet from the first images standing among the misty silhouetted figures gathered at the foot of the nocturne. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Whistler thinned tonalist veils as the crowd and night air, in the same deep blue-black, smoky umber and gold-spark palette. The descending firework sparks, the dark Thames and the misty crowd silhouettes remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "below_sparks",
        label: "Below the sparks",
        prompt:
          "Add the pet from the first images sitting alone in the dim foreground directly beneath the cascading gold firework sparks. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same Whistler near-abstract tonalist washes as the night sky and water, in the same deep blue-black, smoky umber and luminous gold palette. The falling rocket, the misty crowd silhouettes and the dark Thames remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "river_edge",
        label: "At the river edge",
        prompt:
          "Add the pet from the first images standing at the dim edge of the Thames in the lower foreground of the nocturne. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Whistler soft tonalist veils as the dark water and night air, in the same deep blue-black, smoky umber and gold-spark palette. The descending firework, the silhouetted crowd at Cremorne and the misty atmosphere remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },
  {
    slug: "the_scream",
    title: "The Scream",
    artist: "Edvard Munch",
    year: "1893",
    era: "symbolist",
    refFilename: "the_scream.jpg",
    placements: [
      {
        slug: "bridge_plank",
        label: "On the bridge",
        prompt:
          "Add the pet from the first images standing on the wooden planks of the bridge a short distance from the screaming figure. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Munch wavering thinned oil-and-tempera strokes as the bridge and figures, in the same blood-orange, cadmium-yellow, blue-violet and ochre palette. The screaming figure, the two distant pedestrians and the swirling sky remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "near_distant",
        label: "Near the distant figures",
        prompt:
          "Add the pet from the first images trotting along the bridge just behind the two small distant figures further down the railing. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same Munch undulating brushwork as the bridge and sky, in the same blood-orange, cadmium-yellow, blue-violet and ochre palette. The screaming foreground figure, the swirling red sky and the dark blue fjord below remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "shoreline",
        label: "On the shore",
        prompt:
          "Add the pet from the first images standing on the curving blue shoreline beside the fjord beneath the bridge. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Munch wavy thinned oil strokes as the shoreline and water, in the same blood-orange, cadmium-yellow, blue-violet and ochre palette. The bridge railing, the screaming figure, the distant pedestrians and the swirling sky remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },

  // ─── Art Nouveau ────────────────────────────────────────────────────────
  {
    slug: "the_park",
    title: "The Park",
    artist: "Gustav Klimt",
    year: "1909–10",
    era: "art-nouveau",
    refFilename: "the_park.jpg",
    placements: [
      {
        slug: "trunk_base",
        label: "At the trunk base",
        prompt:
          "Add the pet from the first images sitting at the foot of one of the slim dark tree trunks on the narrow grassy strip. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Klimt mosaic-like stippling and decorative pattern as the canopy and grass, in the same gold-green, deep emerald, ochre and umber palette. The dense canopy of green-gold foliage and the slender trunks rising into it remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
      {
        slug: "grass_strip",
        label: "On the grass",
        prompt:
          "Add the pet from the first images lying down on the narrow strip of grassy ground at the very base of the canvas. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same Klimt jewel-mosaic stippling as the foliage and grass, in the same gold-green, deep emerald, ochre and umber palette. The vast dense canopy of green-gold mosaic-like leaves and the slim dark trunks remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes.",
      },
      {
        slug: "between_trunks",
        label: "Between the trunks",
        prompt:
          "Add the pet from the first images standing alert between two of the slim dark tree trunks at the base of the canopy. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Klimt mosaic-like stippling as the leaves and trunks, in the same gold-green, deep emerald, ochre and umber palette. The dense decorative canopy filling the canvas above and the narrow grassy ground remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable.",
      },
    ],
  },
];
