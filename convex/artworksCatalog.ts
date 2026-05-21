/**
 * Tab 3 — Famous Art catalog.
 *
 * Source-of-truth for the 30 public-domain artworks shown on the third tab of
 * /style-pick. The seed script (scripts/upload-artwork-refs.ts) reads this
 * module, uploads each entry's reference JPEG from scripts/artwork-refs/ to
 * Convex storage, and upserts the row into the `artworks` table by slug. The
 * seed script also PRUNES any DB row whose slug isn't in this file, so this
 * array is the single source of truth for what's live.
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
 * Each placement prompt is pose-agnostic — it names the LOCATION, not the
 * pose (pose comes from the quiz's `activity` via ARTWORK_ACTIVITY_TONE in
 * seedream.ts). The prompt repeats the medium-led likeness guard, preserves
 * the iconic scene elements, ties the pet's rendering to the artwork's
 * brushwork/palette, and ends with the likeness-recognisability clause.
 * Where an artwork's scale was unreliable, the prompt also anchors the
 * dog's size to a specific element already in the painting.
 *
 * The seed script keys on `slug` and patches in place; `clickCount` is
 * preserved across re-runs.
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
      { slug: "hilltop", label: "On the hilltop", prompt: "Add the pet from the first images on the dark hilltop in the foreground, beneath the swirling night sky. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet must be built from the same thick post-impressionist impasto brushwork as the cypress and sky, in the same ultramarine, chrome-yellow and viridian palette. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "village", label: "By the village", prompt: "Add the pet from the first images on the path between the houses of the sleeping village. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Van Gogh impasto brushwork as the village walls and church spire. The cypress, the swirling sky and the hills behind remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "cypress_base", label: "Beneath the cypress", prompt: "Add the pet from the first images at the base of the tall dark cypress tree in the left foreground. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same swirling impasto brushwork as the cypress and the night sky, painted in the same ultramarine, chrome-yellow and viridian palette. The village, hills and stars remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
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
      { slug: "wheat", label: "In the wheat", prompt: "Add the pet from the first images waist-deep in the rippling golden wheatfield, beneath the wheeling black crows. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet must be built from the same thick Van Gogh impasto strokes as the wheat and sky, in the same chrome-yellow, ultramarine and viridian palette. The crows, the diverging paths and the turbulent blue-black sky remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "path_fork", label: "At the path fork", prompt: "Add the pet from the first images on the central dirt path where the three tracks diverge through the wheat. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same heavy post-impressionist impasto brushwork as the path and surrounding wheat, in the same chrome-yellow, red-ochre and ultramarine palette. The crows wheeling above and the turbulent low sky remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "foreground", label: "In the foreground", prompt: "Add the pet from the first images at the very front edge of the wheatfield, the crows whirling overhead. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same thick swirling impasto strokes as the wheat ears and turbulent sky, painted in the same chrome-yellow, ultramarine and viridian palette. The three diverging paths and the flock of black crows remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
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
      { slug: "terrace", label: "On the terrace", prompt: "Add the pet from the first images on the yellow-lit café terrace beside the seated figures and tables. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same thick Van Gogh impasto strokes as the terrace floor and awning, in the same chrome-yellow, cobalt-blue and warm orange palette. The cobbled street, starry night sky and distant figures remain unchanged. Render the dog no larger than the seated café patrons at the tables beside it — a real dog at the terrace's scale, in proportion to the people and tables, never dominating the foreground. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "cobbles", label: "On the cobbles", prompt: "Add the pet from the first images on the blue cobblestone street just beyond the warm glow of the terrace. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet must share the same heavy impasto brushwork as the cobbles and night-blue buildings, in the same cobalt, ultramarine and chrome-yellow palette. The seated patrons, lit awning and starry sky remain untouched. Render the dog no larger than the seated patrons under the awning — a real dog standing on the cobbles, in proportion to the figures and tables. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "alley", label: "In the alley", prompt: "Add the pet from the first images in the receding cobbled alley, the deeper blue night beyond. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Van Gogh impasto strokes as the alley walls and starry sky, in the same cobalt, chrome-yellow and viridian palette. The lit terrace, seated figures and distant pedestrians remain unchanged. Render the dog no larger than the distant pedestrians in the alley — small and in proportion to the figures, tables and buildings. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
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
      { slug: "tabletop", label: "On the tabletop", prompt: "Add the pet from the first images on the wooden tabletop beside the yellow earthenware vase of sunflowers. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same thick Van Gogh impasto strokes as the petals and vase, in the same chrome-yellow, ochre and burnt-sienna palette. The fourteen sunflowers, the signed vase and the yellow ground remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "behind_vase", label: "Behind the vase", prompt: "Add the pet from the first images behind the yellow earthenware vase of sunflowers, head visible above the rim. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same heavy impasto brushwork as the petals and vase, in the same chrome-yellow, ochre and umber palette. The bouquet of fourteen sunflowers and the warm yellow background remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "tableside", label: "Beside the table", prompt: "Add the pet from the first images at the edge of the yellow tabletop beside the sunflower bouquet. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Van Gogh impasto strokes as the tabletop and vase, in the same chrome-yellow, ochre and burnt-sienna palette. The vase, signature, sunflowers and yellow ground remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
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
      { slug: "on_bed", label: "On the bed", prompt: "Add the pet from the first images on the red blanket of the wooden bed in the centre of the room. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same thick Van Gogh impasto strokes as the blanket and bedposts, in the same yellow ochre, cobalt-blue and vermilion palette. The two chairs, framed pictures, washbasin and window remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "by_chair", label: "Beside the chair", prompt: "Add the pet from the first images on the tilted wooden floor beside the rush-seat chair in the foreground. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same heavy impasto brushwork as the floorboards and chair, in the same yellow ochre, cobalt-blue and red palette. The bed, framed pictures on the wall and shuttered window remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "doorway", label: "By the doorway", prompt: "Add the pet from the first images just inside the doorway at the back of the tilted-perspective bedroom. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Van Gogh impasto strokes as the walls and door, in the same yellow ochre, cobalt-blue and vermilion palette. The bed, two chairs, framed pictures and washbasin remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
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
      { slug: "field", label: "In the foreground field", prompt: "Add the pet from the first images in a green-ochre field of the foreground Provence landscape. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Cézanne fragmented constructive brushstrokes as the fields and houses, in the same green-ochre, terracotta, lavender and pale-blue palette. The pale-blue Mont Sainte-Victoire on the right, the patchwork plain and small houses remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "near_houses", label: "By the houses", prompt: "Add the pet from the first images on the path beside the small terracotta-roofed houses scattered across the plain. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same Cézanne planar constructive brushwork as the rooftops and fields, in the same terracotta, green-ochre, lavender and pale-blue palette. The rising Mont Sainte-Victoire, the broken patchwork landscape and the soft sky remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "ridge_path", label: "On the ridge path", prompt: "Add the pet from the first images on a ridge path in the middle distance, the mountain rising directly behind. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Cézanne faceted constructive strokes as the ridge and mountain, in the same green-ochre, lavender, terracotta and pale-blue palette. The pale-blue Mont Sainte-Victoire, the houses and patchwork fields remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
    ],
  },
  {
    slug: "card_players",
    title: "The Card Players",
    artist: "Paul Cézanne",
    year: "1894–95",
    era: "post-impressionist",
    refFilename: "card_players.jpg",
    placements: [
      { slug: "under_table", label: "Under the table", prompt: "Add the pet from the first images under the small wooden card table at the feet of the two seated players. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Cézanne faceted constructive Post-Impressionist oil brushwork as the table and players, in the same deep blue, warm umber, terracotta and ivory palette. The two seated card players, their cards and pipe, and the simple Provençal interior remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "beside_chair", label: "Beside the chair", prompt: "Add the pet from the first images on the floor beside the chair of the seated card player on the left. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same Cézanne planar Post-Impressionist oil brushwork as the chair and floor, in the same deep blue, warm umber, terracotta and ivory palette. The two seated players, their cards and the simple wooden setting remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "behind_players", label: "Behind the players", prompt: "Add the pet from the first images on the floor behind the two seated players, the simple Provençal interior beyond. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Cézanne faceted constructive brushwork as the floor and figures, in the same deep blue, warm umber, terracotta and ivory palette. The two seated card players, their cards and pipe, and the small wooden table remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
    ],
  },
  {
    slug: "sleeping_gypsy",
    title: "The Sleeping Gypsy",
    artist: "Henri Rousseau",
    year: "1897",
    era: "post-impressionist",
    refFilename: "sleeping_gypsy.jpg",
    placements: [
      { slug: "beside_lion", label: "Beside the lion", prompt: "Add the pet from the first images in the moonlit desert beside the curious lion as it sniffs the sleeping gypsy. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Rousseau flat naïve oil with simplified forms as the lion and figure, in the same moonlit blue, sandy desert ochre, deep night-violet and warm striped-cloak palette. The sleeping gypsy with their lute, the curious lion and the crescent moon overhead remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "foreground_sand", label: "On the foreground sand", prompt: "Add the pet from the first images on the smooth moonlit desert sand in the foreground, the sleeping gypsy and lion beyond. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same naïve simplified oil as the sand and figures, in the same moonlit blue, sandy ochre, night-violet and striped-cloak palette. The gypsy's lute and water-jug, the curious lion and the crescent moon remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "distant_dune", label: "On a distant dune", prompt: "Add the pet from the first images on a distant moonlit dune behind the gypsy and lion, the crescent moon overhead. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Rousseau flat naïve oil as the dunes and night air, in the same moonlit blue, sandy ochre, night-violet and warm-stripe palette. The sleeping gypsy, the lion sniffing them and the still desert remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
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
      { slug: "near_boat", label: "Near the rowboat", prompt: "Add the pet from the first images in the prow of the small rowing boat in the centre of the hazy harbour. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same loose Monet impressionist dabs as the water and dawn mist, in the same grey-blue, slate and orange palette. The orange sun, distant ship masts and rippling reflections remain unchanged. Render the dog small enough to sit naturally inside the little rowing boat — no larger than the seated rower, in proportion to the boat. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "quayside", label: "On the quayside", prompt: "Add the pet from the first images at the dim stone quayside in the lower foreground, the misty harbour beyond. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same broken impressionist brushwork as the silhouetted boats and dawn fog, in the same grey-blue, mauve and warm orange palette. The rising sun, two rowing boats and ship masts in the mist remain untouched. Render the dog no larger than the rowers in the small boats — a real dog at the quayside, in proportion to the boats and tiny against the wide hazy harbour. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "second_boat", label: "In the second boat", prompt: "Add the pet from the first images on the seat of the smaller boat further back in the harbour mist. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Monet feathery impressionist dabs as the water and haze, in the same grey-blue, slate-mauve and orange palette. The orange sun glowing on the water and the silhouetted ship masts remain unchanged. Render the dog small enough to perch in the little boat — no larger than its seated rower, in proportion to the boat. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
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
      { slug: "on_bridge", label: "On the bridge", prompt: "Add the pet from the first images on the centre of the green Japanese footbridge above the lily pond. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Monet broken impressionist dabs as the bridge planks and weeping willow, in the same emerald-green, mauve and rose palette. The arching willow foliage, lily pads and reflective pond remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "bank", label: "On the bank", prompt: "Add the pet from the first images on the grassy bank at the edge of the lily pond, just below the bridge. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same feathery impressionist brushwork as the reeds and pond, in the same emerald, viridian, mauve and pink palette. The arched green footbridge, weeping willow foliage and floating lily pads remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "bridge_end", label: "At the bridge end", prompt: "Add the pet from the first images at the right-hand foot of the arched green footbridge where it meets the bank. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Monet broken impressionist dabs as the bridge and surrounding foliage, in the same green, mauve and rose-pink palette. The drooping willow above, lily-pad-strewn pond and bridge arch remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
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
      { slug: "in_poppies", label: "In the poppies", prompt: "Add the pet from the first images waist-deep among the scattered red poppies on the sunlit hillside. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same loose Monet impressionist dabs as the meadow grass and poppies, in the same vermilion-red, fresh green and sky-blue palette. The parasolled woman with child, the upper pair of figures and the distant trees remain unchanged. Render the dog no larger than the parasolled woman and child — a real dog standing in the poppies, in proportion to the figures. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "by_parasol", label: "Beside the parasol", prompt: "Add the pet from the first images alongside the woman with the parasol and child in the lower foreground meadow. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same feathery impressionist brushwork as the grass and poppies, in the same red, green and pale-blue palette. The second pair of figures higher up the slope, the distant trees and the bright summer sky remain untouched. Render the dog no larger than the child beside the parasolled woman — a real dog at their feet, in proportion to the figures. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "hill_top", label: "On the hill", prompt: "Add the pet from the first images higher up the poppy-strewn slope near the second pair of figures. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Monet broken impressionist dabs as the meadow grass, in the same vermilion, green and sky-blue palette. The lower pair with parasol, the scattered red poppies and the distant tree line remain unchanged. Render the dog no larger than the pair of figures on the slope — a real dog among the poppies, in proportion to the people. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
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
      { slug: "by_gate", label: "By the gate", prompt: "Add the pet from the first images in the snow just below the wooden gate where the magpie is perched. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Monet feathery impressionist brushwork as the snow drifts and wattle fence, in the same cool white, lilac-grey and warm-shadow palette. The lone magpie, wattle fence and snow-covered farm beyond remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "long_shadow", label: "In the long shadow", prompt: "Add the pet from the first images in the long blue shadow stretching across the foreground snow. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same broken impressionist dabs as the snow and shadow, in the same cool whites, lavenders and pale ochres. The wooden gate, perched magpie and snow-buried farm buildings remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "fence_line", label: "Along the fence", prompt: "Add the pet from the first images along the wattle fence line, the snowy farm buildings rising behind. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Monet feathery impressionist strokes as the snow and fence, in the same cool whites, lilac-grey and ochre palette. The perched magpie, gate and long blue shadow on the snow remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
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
      { slug: "near_bank", label: "On the near bank", prompt: "Add the pet from the first images on the dim near bank of the Thames against the burning sky. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Monet hazy impressionist dabs as the river and atmospheric mist, in the same orange, mauve and indigo palette. The Westminster towers in silhouette, the rippling reflections and the hazy sunset sky remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "river_edge", label: "By the river", prompt: "Add the pet from the first images at the very edge of the rippling Thames, Parliament across the water. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same broken impressionist brushwork as the water and atmospheric haze, in the same orange-purple, mauve and slate palette. The silhouetted Houses of Parliament, the burning sky and reflected colours remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "skyline_fore", label: "Before the skyline", prompt: "Add the pet from the first images on the small foreground bank, the dark Westminster skyline rising directly behind. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Monet hazy impressionist dabs as the silhouettes and river, in the same orange-purple, indigo and rose palette. The pointed Parliament towers, sunset sky and rippling river reflections remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
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
      { slug: "lawn_shade", label: "In the shade", prompt: "Add the pet from the first images on the grass in the cool dappled shade of the foreground tree on the left. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet must be built from the same dense Seurat pointillist dots as the lawn and shade, in the same emerald-green, lavender, orange and dot-broken palette. The parasolled woman with monkey, reclining man and sailboats on the river remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "near_parasol", label: "Near the parasol", prompt: "Add the pet from the first images beside the standing woman with parasol and her small leashed monkey in the right foreground. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same fine pointillist dotting as the figures and grass, in the same emerald, ochre, lavender and rose palette. The reclining man, the sailboats on the river and the strolling Sunday figures remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "river_view", label: "By the river", prompt: "Add the pet from the first images at the river's edge on the right, the white sailboats gliding past. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same pointillist dots as the riverbank and water, in the same emerald, lavender, ochre and pale-blue palette. The Sunday strollers, the parasols, the leashed monkey and the dappled tree shade remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
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
      { slug: "wet_pavement", label: "On the wet pavement", prompt: "Add the pet from the first images on the rain-slicked pavement in the lit foreground of the boulevard. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Pissarro short impressionist strokes as the gleaming pavement and gas-lamp glow, in the same gold-orange, deep-violet and slate palette. The carriages, strolling figures and Haussmann façades flanking the boulevard remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "lamplit_curb", label: "By the lamplight", prompt: "Add the pet from the first images just under the warm pool of a gas-lamp at the curb of the night boulevard. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same flecked impressionist brushwork as the lamps and wet stone, in the same warm orange, indigo and grey-violet palette. The receding line of carriages, the small dark figures and the lit shopfronts remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "near_carriage", label: "Near a carriage", prompt: "Add the pet from the first images alongside one of the dark carriages rolling down the centre of the boulevard. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Pissarro short flickering strokes as the carriage and pavement reflections, in the same gold-orange, deep-violet and slate palette. The gas-lamp pools, distant figures and tall Haussmann buildings remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
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
      { slug: "on_path", label: "On the path", prompt: "Add the pet from the first images on the sunlit dirt path winding up between the tall summer grasses. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Renoir feathery impressionist dabs as the grass and dappled light, in the same warm green, gold and rose-poppy palette. The parasolled women climbing the slope, the scattered red poppies and the distant trees remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "in_grass", label: "In the long grass", prompt: "Add the pet from the first images in the chest-high tall grasses just off the path. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same soft feathery brushwork as the swaying grass and poppies, in the same warm green, gold-yellow and red palette. The figures climbing with parasols, the speckled poppies and the leafy trees behind remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "near_figures", label: "Near the figures", prompt: "Add the pet from the first images ahead of the parasolled figures partway up the sunlit slope. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Renoir broken impressionist dabs as the grass and parasols, in the same warm green, gold and rose palette. The winding path, scattered red poppies and distant tree line remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
    ],
  },
  {
    slug: "bathers_asnieres",
    title: "Bathers at Asnières",
    artist: "Georges Seurat",
    year: "1884",
    era: "post-impressionist",
    refFilename: "bathers_asnieres.jpg",
    placements: [
      { slug: "riverbank", label: "On the riverbank", prompt: "Add the pet from the first images on the grassy riverbank beside the reclining bathers. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Seurat fine pointillist dabs as the grass and figures, in the same warm green, ochre, cream and pale-blue dot-broken palette. The seated and reclining young men, the river with its sailboats and the hazy industrial bank remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "water_edge", label: "At the water's edge", prompt: "Add the pet from the first images at the water's edge where a boy sits at the river. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same fine Seurat pointillist dabs as the bank and shimmering water, in the same warm green, ochre, cream and pale-blue palette. The reclining bathers, the sailboats on the river and the distant factories remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "by_seated", label: "By the seated figure", prompt: "Add the pet from the first images beside the seated bather in the sunlit foreground. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Seurat dense pointillist dots as the grass and figure, in the same warm green, ochre, cream and pale-blue palette. The other reclining bathers, the calm river and the hazy far bank remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
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
      { slug: "river_bank", label: "On the river bank", prompt: "Add the pet from the first images on the grassy near bank of the shallow river just behind the existing dog. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Constable scumbled oil brushwork as the bank and rippled water, in the same earthy green, warm umber and cool sky-blue palette. Willy Lott's cottage on the left, the horse-drawn hay wagon and big English sky remain unchanged. Render the dog at the same scale as the existing dog on the bank — no larger than a wheel of the hay wagon, a real dog in proportion to the cart and horses. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "by_cottage", label: "By the cottage", prompt: "Add the pet from the first images on the worn path beside Willy Lott's brick cottage on the left bank. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same scumbled Constable brushwork as the cottage walls and trees, in the same earthy red-brown, mossy green and cool blue palette. The hay wagon mid-river, the existing dog on the bank and the rolling cloud sky remain untouched. Render the dog no larger than the existing dog on the bank — a real dog beside the cottage, small in proportion to the hay wagon and building. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "in_shallows", label: "In the shallows", prompt: "Add the pet from the first images in the shallow river just beside the slow-moving hay wagon and its horses. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Constable broken oil strokes as the rippled water and reflected sky, in the same warm umber, mossy green and cool blue palette. The wagon, cottage on the bank and clouded English sky remain unchanged. Render the dog no larger than a wheel of the hay wagon beside it — a real dog wading, in proportion to the cart and horses. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
    ],
  },
  {
    slug: "ninth_wave",
    title: "The Ninth Wave",
    artist: "Ivan Aivazovsky",
    year: "1850",
    era: "romantic",
    refFilename: "ninth_wave.jpg",
    placements: [
      { slug: "on_mast", label: "On the floating mast", prompt: "Add the pet from the first images on the floating wooden mast beside the survivors clinging to it as the cresting wave looms. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Aivazovsky luminous Romantic seascape oil as the wave and figures, in the same turquoise wave-green, dawn-gold, deep navy and foam-white palette. The cresting ninth wave, the dawn sky breaking through cloud and the survivors clinging to the floating mast remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "crest_view", label: "On wreckage", prompt: "Add the pet from the first images on a small dark piece of floating wreckage in the foreground, the towering wave and dawn light behind. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same luminous Romantic seascape oil as the wave and dawn sky, in the same turquoise, gold, navy and foam-white palette. The cresting wave, the survivors on the mast and the breaking dawn light remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "distant_water", label: "In the wave's trough", prompt: "Add the pet from the first images on another fragment of wreckage further back in the wave's trough, the survivors and mast in the middle distance. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Aivazovsky translucent seascape oil as the water and survivors, in the same turquoise, dawn-gold, deep navy and foam-white palette. The cresting wave, the floating mast with survivors and the dawn sky remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
    ],
  },
  {
    slug: "heart_of_andes",
    title: "Heart of the Andes",
    artist: "Frederic Edwin Church",
    year: "1859",
    era: "romantic",
    refFilename: "heart_of_andes.jpg",
    placements: [
      { slug: "near_figures", label: "Near the figures", prompt: "Add the pet from the first images on the foreground path beside the small figures resting near the cross. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Church luminous Hudson River School oil with detailed atmospheric depth as the figures and foliage, in the same tropical green, golden distant light, deep umber and pale mountain-blue palette. The snow-capped Andes in the distance, the cascading waterfall, the small figures on the path and the dense tropical foliage remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "by_waterfall", label: "By the waterfall", prompt: "Add the pet from the first images on the rocks beside the cascading waterfall in the middle distance. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same Church luminous Hudson River School oil as the waterfall and rocks, in the same tropical green, golden light, deep umber and mountain-blue palette. The snow-capped Andes, the small foreground figures near the cross and the lush tropical scene remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "foreground_path", label: "On the foreground path", prompt: "Add the pet from the first images on the dirt path in the lower foreground, the Andes and tropical scene rising behind. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Church luminous oil with detailed atmospheric depth as the path and foliage, in the same tropical green, golden light, umber and mountain-blue palette. The snow-capped Andes, the cascading waterfall and the small resting figures remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
    ],
  },
  {
    slug: "the_oxbow",
    title: "The Oxbow (View from Mount Holyoke)",
    artist: "Thomas Cole",
    year: "1836",
    era: "romantic",
    refFilename: "the_oxbow.jpg",
    placements: [
      { slug: "ridge", label: "On the ridge", prompt: "Add the pet from the first images on the wooded slope in the foreground overlooking the great river bend. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Romantic-era oil brushwork as the trees and rolling valley, in the same earthy green, warm ochre and storm-grey palette. The oxbow river, the sunlit cultivated fields beyond and the breaking storm clouds remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "valley_floor", label: "In the valley", prompt: "Add the pet from the first images in the sunlit clearing on the valley floor beside the winding river. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same Romantic atmospheric oil brushwork as the fields and distant hills, in the same warm green, gold and pale-blue palette. The wooded foreground slopes, the river's oxbow curve and the dramatic parting sky remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "by_tree", label: "By the storm-side tree", prompt: "Add the pet from the first images beside the gnarled wind-blasted tree on the stormy ridge in the foreground. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Romantic oil brushwork as the tree and dark slopes, in the same earthy green, umber and storm-grey palette. The oxbow river, the sunlit far fields and the clearing clouds remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
    ],
  },
  {
    slug: "wivenhoe_park",
    title: "Wivenhoe Park",
    artist: "John Constable",
    year: "1816",
    era: "romantic",
    refFilename: "wivenhoe_park.jpg",
    placements: [
      { slug: "lakeside", label: "By the lake", prompt: "Add the pet from the first images on the grassy lakeside among the swans and grazing cattle. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Constable scumbled oil brushwork as the parkland and water, in the same fresh green, warm umber and broad sky-blue palette. The white swans, the cattle, the wooden fence and the distant country house remain unchanged. Render the dog no larger than the grazing cattle and swans beside it — a real dog at the lakeside, in proportion to the animals and parkland. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "by_fence", label: "By the fence", prompt: "Add the pet from the first images beside the low wooden fence in the open parkland. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same scumbled Constable brushwork as the meadow and trees, in the same fresh green, umber and cool blue palette. The lake with its swans, the grazing cattle and the distant house beneath a wide cloud-filled sky remain untouched. Render the dog no larger than the cattle in the park — a real dog by the fence, in proportion to the animals and the distant house. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "meadow", label: "In the meadow", prompt: "Add the pet from the first images in the open foreground meadow with the country house in the distance. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Constable broken oil brushwork as the grass and clouded sky, in the same fresh green, warm umber and sky-blue palette. The lake, the swans, the cattle and the wooden fence remain unchanged. Render the dog no larger than the grazing cattle nearby — a real dog in the meadow, in proportion to the animals and parkland. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
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
      { slug: "in_boat", label: "In the lead boat", prompt: "Add the pet from the first images in the centre of the foremost slender boat as the wave looms above. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet must be built from the same flat ukiyo-e woodblock outlines and gradient fills as the boats and rowers, in the same Prussian-blue, indigo, pale beige and white-foam palette. The towering claw-foam wave, the other slender boats and distant Mount Fuji remain unchanged. Render the dog small enough to crouch among the rowers in the slender boat — no larger than a seated oarsman, in proportion to the boat. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "second_boat", label: "In the second boat", prompt: "Add the pet from the first images at the prow of the second slender rowing boat further back from the cresting wave. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same flat ukiyo-e woodblock outlines as the boats and oarsmen, in the same Prussian-blue, indigo, beige and white palette. The enormous cresting wave with claw-foam, the third boat and Mount Fuji on the horizon remain untouched. Render the dog no larger than the crouching rowers in the boat — small and in proportion to the slender vessel. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "near_fuji", label: "Near Mount Fuji", prompt: "Add the pet from the first images on a small spit of land in the middle distance just below the snow-capped Mount Fuji. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same flat ukiyo-e woodblock lines and gradient fills as the sky and Fuji, in the same Prussian-blue, indigo, beige and white palette. The huge cresting wave, the slender boats and rowers remain unchanged. Render the dog no larger than the rowers in the distant boats — tiny and in proportion to the boats and the vast wave. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
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
      { slug: "on_road", label: "On the road", prompt: "Add the pet from the first images on the windy coastal road among the travellers clutching their hats. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same flat ukiyo-e woodblock outlines and gradient fills as the figures and grass, in the same beige, pale green and Prussian-blue palette. The papers blown into the air, the snatched hat and the distant Mount Fuji remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "grass_clump", label: "By the grass", prompt: "Add the pet from the first images beside a clump of windswept grasses on the verge of the road. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same flat ukiyo-e woodblock outlines as the bowing grass and travellers, in the same pale green, beige and Prussian-blue palette. The flying papers, the figures bracing in the gust and Mount Fuji on the horizon remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "fuji_view", label: "Toward Fuji", prompt: "Add the pet from the first images on the road further back, the distant grey-blue silhouette of Mount Fuji ahead. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same flat ukiyo-e woodblock outlines and gradient fills as the road and trees, in the same beige, pale green and Prussian-blue palette. The travellers struggling in the wind and the airborne papers and hat remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
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
      { slug: "on_bridge", label: "On the bridge", prompt: "Add the pet from the first images across the wooden planks of the Shin-Ohashi bridge among the figures with hats and umbrellas. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same flat ukiyo-e woodblock outlines and rain-streaked gradient fills as the figures, in the same indigo, slate-grey and warm beige palette. The driving diagonal rain, the dark river below and the distant raft remain unchanged. Render the dog no larger than the figures crossing the bridge — a real dog on the planks, in proportion to the people and the bridge timbers. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "raft", label: "On the raft", prompt: "Add the pet from the first images on the small raft drifting through the rain on the dark river beneath the bridge. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same flat woodblock outlines as the raft and water, in the same indigo, slate-grey and beige palette. The rain-soaked Shin-Ohashi bridge above with its sheltering figures and the diagonal lines of falling rain remain untouched. Render the dog no larger than fits on the small raft — in proportion to the raft and to the figures on the bridge above. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "bridge_end", label: "At the bridge end", prompt: "Add the pet from the first images at the far end of the wooden bridge as figures hurry past in the rain. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same flat ukiyo-e woodblock outlines and gradient fills as the bridge timbers, in the same indigo, slate-grey and warm beige palette. The diagonal rain, the umbrellas and straw hats and the dark river below remain unchanged. Render the dog no larger than the hurrying figures beside it — a real dog at the bridge's end, in proportion to the people and the bridge. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
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
      { slug: "behind_branch", label: "Behind the branch", prompt: "Add the pet from the first images behind the twisted dark plum trunk in the extreme close-up foreground. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same flat ukiyo-e woodblock outlines and gradient fills as the bark and blossom, in the same dark wood-brown, white-blossom and rose-pink sky palette. The white plum blossom, the trees beyond and the small figures in the garden remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "garden_path", label: "On the garden path", prompt: "Add the pet from the first images on the garden path among the smaller plum trees in the middle distance. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same flat ukiyo-e woodblock outlines as the trees and figures, in the same dark brown, white-blossom and pink-sky palette. The dramatic foreground branch, the white plum blossom and the strolling figures remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "blossom_base", label: "By the trunk", prompt: "Add the pet from the first images at the foot of the foreground plum trunk among fallen white petals. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same flat ukiyo-e woodblock outlines and gradient fills as the trunk and ground, in the same dark wood-brown, white-blossom and rose-pink palette. The twisted trunk, the white blossom and the figures beyond remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
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
      { slug: "with_hunters", label: "With the hunters", prompt: "Add the pet from the first images alongside the existing hounds beside the three hunters descending the snowy hill. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Bruegel meticulous Northern Renaissance oil glazing as the hunters and snow, in the same cool ivory, slate, ochre and pine-green palette. The trudging hunters, the magpies in the bare trees and the valley below remain unchanged. Render the dog at the same scale as the existing hounds beside the hunters — no larger than the men, a real dog in proportion to the hunting party. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "ridge_top", label: "On the ridge", prompt: "Add the pet from the first images on the snowy ridge ahead of the hunters above the valley below. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same Bruegel precise Northern Renaissance brushwork as the snow and bare trees, in the same cool ivory, slate-blue and pine-green palette. The hunting party, the existing dogs and the magpies on bare branches remain untouched. Render the dog no larger than the existing hounds and hunters — a real dog on the ridge, small in proportion to the figures and the valley. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "by_tree", label: "By a bare tree", prompt: "Add the pet from the first images in the snow at the foot of one of the dark bare trees on the slope. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Bruegel meticulous oil glazing as the snow and trees, in the same cool ivory, slate, ochre and pine-green palette. The descending hunters, the dogs, the perched magpies and the frozen valley below remain unchanged. Render the dog at the same scale as the existing dogs with the hunters — no larger than a man, in proportion to the figures on the slope. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
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
      { slug: "foreground_pond", label: "By the foreground pond", prompt: "Add the pet from the first images at the edge of the bright foreground pond in the centre panel. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Bosch jewel-bright Northern Renaissance oil glazing as the pond and surrounding figures, in the same pastel pink, turquoise, cream and grass-green palette. The fantastical pink rock formations, the central fountain and the surreal background creatures remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "near_fountain", label: "Near the fountain", prompt: "Add the pet from the first images on the grass beside the strange pink fountain rising from the central pool. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same Bosch precise jewel-toned brushwork as the fountain and pastel landscape, in the same pink, turquoise, cream and pale-green palette. The fantastical rocks, the bright pond and the distant surreal creatures remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "clearing", label: "In a clearing", prompt: "Add the pet from the first images in a small grassy clearing in the lower foreground of the panel. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Bosch jewel-bright Northern Renaissance glazing as the grass and pastel rocks, in the same pink, turquoise, cream and grass-green palette. The bright central pond, the fantastical fountain and the surreal pink rock formations remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
    ],
  },

  // ─── Symbolist ──────────────────────────────────────────────────────────
  {
    slug: "lady_of_shalott",
    title: "The Lady of Shalott",
    artist: "John William Waterhouse",
    year: "1888",
    era: "symbolist",
    refFilename: "lady_of_shalott.jpg",
    placements: [
      { slug: "in_boat", label: "In the boat", prompt: "Add the pet from the first images in the small boat at the foot of the seated Lady. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Waterhouse lush Pre-Raphaelite oil with rich detail and romantic atmosphere as the boat and Lady, in the same deep autumn-gold, mossy green, dusky lavender-blue and dark river-water palette. The Lady seated in her flowing white robe with dark hair, the candle and tapestry, and the willow-lined river remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "river_bank", label: "On the river bank", prompt: "Add the pet from the first images on the mossy river bank beside the drifting boat. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same Waterhouse Pre-Raphaelite oil with romantic atmosphere as the bank and willow trees, in the same autumn-gold, mossy green, lavender-blue and dark water palette. The Lady in the boat with her tapestry and candle, and the willow-lined river remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "foreground_log", label: "On a foreground log", prompt: "Add the pet from the first images on a fallen log just in front of the boat in the lower foreground. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Waterhouse Pre-Raphaelite oil with rich detail as the log and surrounding bank, in the same autumn-gold, mossy green, lavender-blue and dark river-water palette. The Lady in her drifting boat, the candle and tapestry, and the willow-lined river remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
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
      { slug: "trunk_base", label: "At the trunk base", prompt: "Add the pet from the first images at the foot of one of the slim dark tree trunks on the narrow grassy strip. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is rendered in the same Klimt mosaic-like stippling and decorative pattern as the canopy and grass, in the same gold-green, deep emerald, ochre and umber palette. The dense canopy of green-gold foliage and the slender trunks rising into it remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
      { slug: "grass_strip", label: "On the grass", prompt: "Add the pet from the first images on the narrow strip of grassy ground at the very base of the canvas. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet shares the same Klimt jewel-mosaic stippling as the foliage and grass, in the same gold-green, deep emerald, ochre and umber palette. The vast dense canopy of green-gold mosaic-like leaves and the slim dark trunks remain untouched. No photographic detail, no cut-out edges. Pet's breed and markings recognisable through the painted strokes." },
      { slug: "between_trunks", label: "Between the trunks", prompt: "Add the pet from the first images between two of the slim dark tree trunks at the base of the canopy. Treat the first images as likeness references only — do not preserve any photographic texture from them. The pet is built from the same Klimt mosaic-like stippling as the leaves and trunks, in the same gold-green, deep emerald, ochre and umber palette. The dense decorative canopy filling the canvas above and the narrow grassy ground remain unchanged. No photographic detail, no cut-out edges. Pet's breed and markings recognisable." },
    ],
  },
];
