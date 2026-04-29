import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Anonymous client session — created on first visit, ID kept in localStorage.
  // Tracks the customer's journey: photo upload → quiz → generations → selection.
  sessions: defineTable({
    // Multiple pet photos: more reference images = better likeness from
    // Nano Banana. Stored as parallel arrays.
    petPhotoStorageIds: v.optional(v.array(v.id("_storage"))),
    petPhotoUrls: v.optional(v.array(v.string())),
    quizAnswers: v.optional(
      v.object({
        // Pet profile (collected first; not used in the portrait prompt).
        // Optional to keep older sessions valid; new sessions always set them.
        name: v.optional(v.string()),
        breed: v.optional(v.string()),
        age: v.optional(v.string()),       // "under-1" | "1-3" | "4-7" | "8-plus"
        lifestyle: v.optional(v.string()), // "homebody" | "adventurer"
        // Portrait creative direction — these feed the AI prompt.
        activity: v.string(), // "regal" | "playing" | "napping" | "adventuring"
        mood: v.string(),     // "calm" | "playful" | "regal" | "quirky"
        room: v.string(),     // "living" | "bedroom" | "office" | "kitchen"
      }),
    ),
    // One generation per style (always all 4).
    // imageUrl is the small display version (~1024px, used in UI).
    // printFileUrl is the upscaled high-res version (~4096px, used for prints
    // and digital downloads). Optional during the legacy single-URL flow.
    generations: v.optional(
      v.array(
        v.object({
          style: v.string(),
          imageUrl: v.string(),
          printFileUrl: v.optional(v.string()),
        }),
      ),
    ),
    // Which generation is currently in progress (for the loading screen).
    generationStatus: v.optional(
      v.union(
        v.literal("idle"),
        v.literal("generating"),
        v.literal("ready"),
        v.literal("failed"),
      ),
    ),
    generationError: v.optional(v.string()),
    selectedStyle: v.optional(v.string()),
    // Quiz-derived ranking of all 10 styles, highest-scoring first. Computed
    // at quiz-save time; the top 3 are pre-suggested on the picker.
    rankedStyles: v.optional(v.array(v.string())),
    // The 3 styles the user actually picked to generate. Set on the picker
    // screen and consumed by the fal action.
    selectedStyles: v.optional(v.array(v.string())),
    regensRemaining: v.number(),
    // Accumulating session gallery — every successful generation appends
    // its 4 portraits here so the user can revisit / buy any of them.
    galleryItems: v.optional(
      v.array(
        v.object({
          style: v.string(),
          imageUrl: v.string(),
          printFileUrl: v.optional(v.string()),
          activity: v.optional(v.string()),
          mood: v.optional(v.string()),
          petName: v.optional(v.string()),
          createdAt: v.number(),
        }),
      ),
    ),
    // Multi-item cart, anonymous, scoped to this session. Lines are merged
    // by (productId, printFileUrl); digital lines are forced to qty 1.
    cart: v.optional(
      v.array(
        v.object({
          productId: v.id("products"),
          // printFileUrl: high-res, sent to Gelato + used for digital download.
          // displayUrl: small display version for cart thumbs (avoids loading
          // a multi-megabyte print file into a 64px tile).
          printFileUrl: v.string(),
          displayUrl: v.optional(v.string()),
          style: v.string(),
          petName: v.optional(v.string()),
          quantity: v.number(),
          addedAt: v.number(),
        }),
      ),
    ),
  }),

  products: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    format: v.union(
      v.literal("digital"),
      v.literal("poster"),
      v.literal("framed"),
      v.literal("canvas"),
    ),
    // Digital has no real "size", so we use "small" as a placeholder there.
    size: v.union(
      v.literal("small"),
      v.literal("medium"),
      v.literal("large"),
    ),
    frame: v.optional(
      v.union(v.literal("natural-wood"), v.literal("dark-wood")),
    ),
    // gelatoProductUid is optional now — digital SKUs don't have one.
    gelatoProductUid: v.optional(v.string()),
    priceCents: v.number(),
    currency: v.string(),
    printFileUrl: v.optional(v.string()),
    active: v.boolean(),
  })
    .index("by_format", ["format"])
    .index("by_active", ["active"]),

  orders: defineTable({
    // Legacy single-product fields — kept optional so old orders (pre-cart)
    // still validate. New multi-item orders use `lineItems` below.
    productId: v.optional(v.id("products")),
    sessionId: v.optional(v.id("sessions")),
    stripeSessionId: v.string(),
    amountTotal: v.number(),
    currency: v.string(),
    customerEmail: v.optional(v.string()),
    printFileUrl: v.optional(v.string()),
    selectedStyle: v.optional(v.string()),
    lineItems: v.optional(
      v.array(
        v.object({
          productId: v.id("products"),
          printFileUrl: v.string(),
          displayUrl: v.optional(v.string()),
          style: v.string(),
          petName: v.optional(v.string()),
          quantity: v.number(),
          unitPriceCents: v.number(),
        }),
      ),
    ),
    petName: v.optional(v.string()),
    shipping: v.optional(
      v.object({
        name: v.string(),
        phone: v.optional(v.string()),
        addressLine1: v.string(),
        addressLine2: v.optional(v.string()),
        city: v.string(),
        postCode: v.string(),
        state: v.optional(v.string()),
        country: v.string(),
      }),
    ),
    status: v.string(),
    gelatoOrderId: v.optional(v.string()),
  })
    .index("by_session", ["stripeSessionId"])
    .index("by_gelato", ["gelatoOrderId"]),
});
