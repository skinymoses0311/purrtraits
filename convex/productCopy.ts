// Personalised product description copy. Pet name + breed are captured in the
// quiz and substituted at render time, so this lives outside the products
// table (description in DB would be static across all customers). Shared
// between the PDP (src/pages/pdp.astro) and the Stripe checkout line item
// (convex/payments.ts) so both surfaces stay in lockstep.

import type { Doc } from "./_generated/dataModel";

type Product = Doc<"products">;

const DIMENSION_BY_SIZE: Record<Product["size"], string> = {
  small: '12 × 16"',
  medium: '18 × 24"',
  large: '24 × 32"',
};

// Quiz already enforces both as required to advance, so these fallbacks only
// fire on legacy sessions whose schema-optional values were never set.
const PET_FALLBACK = "your pet";
const BREED_FALLBACK = "dog";

export function formatProductDescription(
  product: Product,
  petName: string | undefined,
  breed: string | undefined,
): string {
  const name = petName?.trim() || PET_FALLBACK;
  // Breeds in DOG_BREEDS are Title Case; mid-sentence they read better
  // lowercased ("your golden retriever" not "your Golden Retriever").
  const breedLower = breed?.trim().toLowerCase() || BREED_FALLBACK;
  const dim = DIMENSION_BY_SIZE[product.size];

  switch (product.format) {
    case "digital":
      return `For the ${name} fans who travel light. The full-resolution digital file of your ${breedLower}'s portrait — yours to print at home, post on the family group chat, or set as your laptop wallpaper at the office. Heads up: every poster, frame, and canvas already includes this download for free, so if you're after something for the wall, scroll back. If you just want the pixels, this is your one.`;

    case "poster":
      return `Yes, ${name} deserves a poster on the wall. Your ${breedLower}, printed at ${dim} on heavyweight 200gsm matte stock — the kind of paper that catches the light without the glare, and looks like it came from a proper print shop because it did. Slots into the frame of your choice. The high-res digital file is included free, in case ${name} needs a presence on your phone too.`;

    case "framed":
      if (product.frame === "dark-wood") {
        return `${name}, but make it gallery. Your ${breedLower} printed at ${dim} on 80lb coated silk, framed in deep dark wood that takes the whole thing from "cute pet picture" to "I have taste, actually". Ships ready to hang — the most effort you'll need is choosing which wall ${name} dominates. The digital file comes included, gratis, so you can also send it round the family WhatsApp.`;
      }
      return `${name} has earned the natural wood treatment. Your ${breedLower}, printed at ${dim} on 80lb coated silk for that gallery sheen, then framed in warm natural wood that plays nicely with every wall colour you've ever committed to. Arrives ready to hang — no trip to the framers, no swearing at hooks. The digital file comes free, so ${name} can also live in your camera roll while you decide which wall is worthy.`;

    case "canvas":
      return `Big, textured, and a little bit Renaissance — fitting, for ${name}. Your ${breedLower} printed onto canvas at ${dim} and stretched over a slim 2cm wood frame, so it sits flush to the wall with that proper gallery presence. No glass, no glare, no extra framing required. The high-res digital file is bundled in too, free of charge — because ${name} is a body of work, not just a single piece.`;
  }
}
