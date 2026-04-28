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
        // What the pet should be doing in the portrait — drives composition/scene.
        activity: v.string(), // "regal" | "playing" | "napping" | "adventuring"
        mood: v.string(),     // "calm" | "playful" | "regal" | "quirky"
        room: v.string(),     // "living" | "bedroom" | "office" | "kitchen"
      }),
    ),
    // One generation per style (always all 4).
    generations: v.optional(
      v.array(
        v.object({
          style: v.string(),
          imageUrl: v.string(),
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
    regensRemaining: v.number(),
    // Accumulating session gallery — every successful generation appends
    // its 4 portraits here so the user can revisit / buy any of them.
    galleryItems: v.optional(
      v.array(
        v.object({
          style: v.string(),
          imageUrl: v.string(),
          activity: v.optional(v.string()),
          mood: v.optional(v.string()),
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
          printFileUrl: v.string(),
          style: v.string(),
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
          style: v.string(),
          quantity: v.number(),
          unitPriceCents: v.number(),
        }),
      ),
    ),
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
