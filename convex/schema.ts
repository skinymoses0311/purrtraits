import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import { currencyValidator, pricesValidator } from "./currency";

export default defineSchema({
  // Convex Auth tables (users, authAccounts, authSessions, etc.). The `users`
  // table is overridden below with app-specific fields layered on top.
  ...authTables,

  // Same shape as authTables.users + regensRemaining. Convex schemas validate
  // every document against the table validator at write time, so app-level
  // fields must be declared here rather than just patched in via callbacks.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // Generation budget — see fal.ts. Initialized to 3 by createOrUpdateUser
    // in convex/auth.ts; reset to 3 on order completion in payments.ts.
    regensRemaining: v.optional(v.number()),
    // Stamped the moment the welcome email send succeeds. Guards against
    // duplicate sends if Convex Auth retries createOrUpdateUser. Same
    // belt-and-braces pattern as confirmationEmailSentAt on orders.
    welcomeEmailSentAt: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  // Anonymous client session — created on first visit, ID kept in localStorage.
  // Tracks the customer's journey: photo upload → quiz → generations → selection.
  // Once the user signs up at the auth gate the session is stamped with their
  // userId; sessions started by an already-signed-in user get the userId at
  // creation time.
  sessions: defineTable({
    userId: v.optional(v.id("users")),
    // Buyer's selected currency. Set on first visit by /api/geo (Vercel
    // header lookup) and overridden by the footer toggle. Optional so legacy
    // sessions still validate; cart pricing falls back to USD when missing.
    preferredCurrency: v.optional(currencyValidator),
    // Multiple pet photos: more reference images = better likeness from
    // Nano Banana. Stored as parallel arrays.
    petPhotoStorageIds: v.optional(v.array(v.id("_storage"))),
    petPhotoUrls: v.optional(v.array(v.string())),
    quizAnswers: v.optional(
      v.object({
        // Pet profile (collected first).
        // Optional to keep older sessions valid; new sessions always set them.
        name: v.optional(v.string()),
        // breed is the display string used everywhere downstream (PDP copy,
        // cart lines, Stripe descriptions, gallery). For single-breed it's the
        // breed name ("Labrador Retriever"); for crossbreeds it's the joined
        // form ("Labrador Retriever / Poodle"). breeds is the structured form
        // and the source of truth for the AI prompt's crossbreed phrasing —
        // present iff the user picked crossbreed mode.
        breed: v.optional(v.string()),
        breeds: v.optional(v.array(v.string())),
        age: v.optional(v.string()),       // "under-1" | "1-3" | "4-7" | "8-plus"
        // Captured for data quality / future insurer partnerships. Not fed
        // into the prompt — kept as plain string buckets so the validator
        // doesn't churn if the bucket vocabulary expands later.
        gender: v.optional(v.string()),    // "boy" | "girl"
        size: v.optional(v.string()),      // "xs" | "s" | "m" | "l" | "xl"
        lifestyle: v.optional(v.string()), // "homebody" | "adventurer"
        // Portrait creative direction — these feed the AI prompt.
        activity: v.string(), // "regal" | "playing" | "napping" | "adventuring"
        mood: v.string(),     // "calm" | "playful" | "regal" | "quirky"
        // Q7: which feature to emphasise in the prompt.
        // "eyes" | "smile" | "fur" | "ears" | "whole-vibe"
        favouriteFeature: v.optional(v.string()),
        // Removed in Quiz v2. Kept optional in the validator so legacy rows
        // still validate until the stripRoomFromQuizAnswers migration has
        // run; the field can be deleted from this validator afterwards.
        room: v.optional(v.string()),
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
          // Pet identity is bound to the portrait, not the session: a session's
          // quizAnswers can be wiped (clearCurrentFlow) or belong to a different
          // pet (cross-session "buy this one"), but a generation always belongs
          // to one pet. PDP + Stripe copy read these directly.
          petName: v.optional(v.string()),
          breed: v.optional(v.string()),
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
    // Quiz-derived ranking of all 10 artists, highest-scoring first. Mirrors
    // rankedStyles. Computed at quiz-save time; the top 3 are surfaced first
    // on the Artist tab of the picker.
    rankedArtists: v.optional(v.array(v.string())),
    // The 3 styles the user actually picked to generate. Set on the picker
    // screen and consumed by the fal action.
    selectedStyles: v.optional(v.array(v.string())),
    // Tab 3 (Famous Art) single-artwork selection. Mutually exclusive with
    // selectedStyles — committing on Tab 3 clears selectedStyles, and
    // committing on Tab 1/2 clears this. The Seedream pipeline reads this
    // and fans out the artwork's three placement prompts. References a
    // slug in the `artworks` table.
    selectedArtworkSlug: v.optional(v.string()),
    // Legacy: regen budget used to live on the session. With auth in place
    // it lives on the user instead. Kept optional so existing rows still
    // validate; new code reads/writes from the users table.
    regensRemaining: v.optional(v.number()),
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
          breed: v.optional(v.string()),
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
          breed: v.optional(v.string()),
          quantity: v.number(),
          addedAt: v.number(),
        }),
      ),
    ),
  }).index("by_userId", ["userId"]),

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
    // Per-currency price set in minor units (cents/pence). Hand-tuned to
    // round-number endings per currency; see convex/currency.ts.
    prices: pricesValidator,
    printFileUrl: v.optional(v.string()),
    active: v.boolean(),
  })
    .index("by_format", ["format"])
    .index("by_active", ["active"]),

  // Tab 3 (Famous Art) catalog. Source-of-truth lives in
  // `convex/artworksCatalog.ts`; the seed script (scripts/upload-artwork-refs.ts)
  // mirrors that file into this table, uploading both a small thumbnail (for
  // the picker grid) and a higher-res reference image (sent to Seedream at
  // generation time) to Convex storage. Re-running the script preserves
  // `clickCount` so popularity is durable across re-seeds.
  artworks: defineTable({
    slug: v.string(),
    title: v.string(),
    artist: v.string(),
    year: v.optional(v.string()),
    era: v.union(
      v.literal("post-impressionist"),
      v.literal("impressionist"),
      v.literal("japanese-woodblock"),
      v.literal("romantic"),
      v.literal("northern-renaissance"),
      v.literal("symbolist"),
      v.literal("art-nouveau"),
      v.literal("dutch-golden-age"),
      v.literal("renaissance"),
    ),
    // Small JPEG (~600px long edge, q70) shown on every catalog card. Keeps
    // the Tab 3 panel weight under ~2MB across all 30 cards.
    thumbStorageId: v.id("_storage"),
    // Higher-res JPEG (~1600px long edge) sent to Seedream as the second
    // image at generation time. Never fetched by the browser.
    referenceStorageId: v.id("_storage"),
    // Exactly three hand-authored placement prompts per artwork. The user
    // picks the artwork; the system fans out all three. Stored inline because
    // the array is small, bounded, and always written together — no churn risk.
    placements: v.array(
      v.object({
        slug: v.string(),
        label: v.string(),
        prompt: v.string(),
      }),
    ),
    // Atomic counter incremented on every catalog card click. Drives the
    // "Popular" carousel.
    clickCount: v.number(),
    // Soft-disable flag. Toggled via the Convex dashboard if an artwork
    // needs to be hidden without re-seeding.
    active: v.boolean(),
  })
    .index("by_slug", ["slug"])
    .index("by_active_era", ["active", "era"])
    .index("by_active_clicks", ["active", "clickCount"]),

  orders: defineTable({
    userId: v.optional(v.id("users")),
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
          breed: v.optional(v.string()),
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
    // Captured from Gelato — minDeliveryDate / maxDeliveryDate on
    // shipment.minDeliveryDate / maxDeliveryDate. Stored as unix ms so
    // /orders can render an ETA range without an extra Gelato API call.
    etaMinAt: v.optional(v.number()),
    etaMaxAt: v.optional(v.number()),
    // Tracking info pulled off Gelato's order detail at in-transit time.
    // Persisted so the orders page is a pure DB read.
    tracking: v.optional(
      v.object({
        url: v.string(),
        code: v.optional(v.string()),
        carrier: v.optional(v.string()),
      }),
    ),
    // Set the first time fal.upscaleAndFulfil successfully patches the order's
    // print URLs to their high-res versions. Used to make duplicate Stripe
    // webhooks noop the upscale instead of paying for it again.
    printFileHiResUpscaledAt: v.optional(v.number()),
    // Idempotency markers — set the moment a Brevo send succeeds, so
    // duplicate webhook deliveries don't double-email the customer.
    confirmationEmailSentAt: v.optional(v.number()),
    inProductionEmailSentAt: v.optional(v.number()),
    inTransitEmailSentAt: v.optional(v.number()),
    deliveredEmailSentAt: v.optional(v.number()),
    canceledEmailSentAt: v.optional(v.number()),
  })
    .index("by_session", ["stripeSessionId"])
    .index("by_gelato", ["gelatoOrderId"])
    .index("by_userId", ["userId"]),
});
