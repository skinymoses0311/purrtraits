import { defineCollection, reference, z, type SchemaContext } from "astro:content";
import { glob } from "astro/loaders";

// The five blog categories. Only "breeds" has a full article template for
// now (the Editorial Profile / Breed Spotlight). The others exist so the
// homepage Gallery Wall can tag plates by category and colour them.
export const BLOG_CATEGORIES = [
  "breeds",
  "photo-tips",
  "decor",
  "gifts",
  "personality",
] as const;

// A "plate" is one of the framed portraits shown in the plate-trial grid and
// elsewhere. Supply `image` to use a real (optimized) portrait; if omitted, the
// template falls back to a generated PetArt SVG where `variant` (0-6) selects a
// palette and `breed` nudges the ear silhouette. `alt` is the image's alt text.
// A factory so the schema's `image()` helper (which resolves paths relative to
// the post file and enables Astro's image optimization) is in scope.
const plateSchema = (image: SchemaContext["image"]) =>
  z.object({
    no: z.string(), // e.g. "14c"
    title: z.string(), // e.g. "Oil on Canvas"
    style: z.string(), // caption right-hand side, e.g. "heavy impasto · the recommendation"
    variant: z.number().int().min(0).max(6).default(0),
    breed: z.enum(["pointy", "floppy"]).optional(),
    image: image().optional(),
    alt: z.string().optional(),
  });

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: ({ image }) =>
    z.object({
      // ── identity / meta ──────────────────────────────────────────
      category: z.enum(BLOG_CATEGORIES),
      title: z.string(),
      subtitle: z.string(), // italic second line of the H1
      excerpt: z.string(), // used by the homepage plate plaque + SEO
      author: z.string().default("Marcus Tate"),
      publishDate: z.coerce.date(),
      readTime: z.string(), // e.g. "11 min"
      issueNo: z.string(), // e.g. "14"
      volume: z.string().default("I"),
      filedUnder: z.string().default("Breeds · Working dogs"),

      // ── hero ─────────────────────────────────────────────────────
      // Supply heroImage for a real portrait; otherwise heroVariant/heroBreed
      // drive the generated PetArt fallback.
      heroImage: image().optional(),
      heroAlt: z.string().optional(),
      heroVariant: z.number().int().min(0).max(6).default(5),
      heroBreed: z.enum(["pointy", "floppy"]).optional(),
      heroStyleCaption: z.string(), // "Painted in our Renaissance style"
      heroPlateCaption: z.string(), // "Plate 14a · Tess, six years · ..."

      // ── homepage Gallery Wall display hints ──────────────────────
      featured: z.boolean().default(false),

      // ── intro (drop-cap paragraph) ───────────────────────────────
      intro: z.string(),

      // ── §I Distinctive traits ────────────────────────────────────
      distinctive: z.object({
        kicker: z.string().default("DISTINCTIVE TRAITS"),
        title: z.string(),
        paragraphs: z.array(z.string()),
      }),

      // ── §II The plate trial ──────────────────────────────────────
      plateTrial: z.object({
        kicker: z.string().default("THE PLATE TRIAL"),
        title: z.string(),
        intro: z.string(),
        plates: z.array(plateSchema(image)),
        analysis: z.array(z.string()),
        fourthPlate: z.object({
          kicker: z.string().default("THE FOURTH PLATE"),
          title: z.string(),
          body: z.string(),
          plate: plateSchema(image),
        }),
      }),

      // ── §III Photo tips ──────────────────────────────────────────
      photoTips: z.object({
        kicker: z.string().default("PHOTOGRAPHY"),
        title: z.string(),
        plate: plateSchema(image),
        paragraphs: z.array(z.string()),
        relatedLabel: z.string(), // "Photographing a working dog →"
        relatedMeta: z.string(), // "(Photo Tips · 8 min)"
      }),

      // ── §IV Gifts ────────────────────────────────────────────────
      gifts: z.object({
        kicker: z.string().default("GIFTING"),
        title: z.string(),
        paragraphs: z.array(z.string()),
        productLabel: z.string(), // the inline pink product link text
      }),

      // ── §V Commission CTA ────────────────────────────────────────
      commission: z.object({
        title: z.string(),
        body: z.string(),
        guarantee: z.string().default("Free preview · ships in 7 days · 30-day repaint guarantee"),
        plates: z.array(z.object({ name: z.string(), price: z.string() })),
      }),

      // ── related + next ───────────────────────────────────────────
      related: z
        .array(
          z.object({
            kicker: z.string(),
            title: z.string(),
            desc: z.string(),
            readTime: z.string(),
            variant: z.number().int().min(0).max(6).default(0),
            image: image().optional(),
            alt: z.string().optional(),
            colour: z.enum(["pinkDeep", "sage", "ochre"]).default("pinkDeep"),
            href: z.string().default("#"),
          }),
        )
        .default([]),
      nextPost: reference("blog").optional(),
    }),
});

export const collections = { blog };
