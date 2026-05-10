import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { scoreStyles } from "./styleScoring";
import { scoreArtists } from "./artistScoring";
import { currencyValidator } from "./currency";

export const create = mutation({
  args: {},
  handler: async (ctx) => {
    // If a signed-in user starts a new quiz, stamp the new session with their
    // userId immediately so all downstream rows are tied to them.
    const userId = await getAuthUserId(ctx);
    return await ctx.db.insert("sessions", {
      userId: userId ?? undefined,
      generationStatus: "idle",
      petPhotoStorageIds: [],
      petPhotoUrls: [],
    });
  },
});

export const get = query({
  args: { id: v.id("sessions") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

// Stamps the buyer's currency on the session. Called once on first visit
// after /api/geo resolves a country, and any time the user picks a different
// currency from the footer toggle. Idempotent — no-op if already set to the
// same value.
export const setPreferredCurrency = mutation({
  args: { id: v.id("sessions"), currency: currencyValidator },
  handler: async (ctx, { id, currency }) => {
    const session = await ctx.db.get(id);
    if (!session) throw new Error("Session not found");
    if (session.preferredCurrency === currency) return;
    await ctx.db.patch(id, { preferredCurrency: currency });
  },
});

export const getInternal = internalQuery({
  args: { id: v.id("sessions") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

// Called by the React auth island after sign-up / sign-in: stamps the
// just-authenticated user onto the anonymous session that was started before
// the gate. Idempotent — safe to call repeatedly. If the session is already
// owned by a different user the call is a no-op (defensive — should not
// happen via normal flow).
export const linkSessionToUser = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userId && session.userId !== userId) return;
    if (session.userId === userId) return;
    await ctx.db.patch(sessionId, { userId });
  },
});

// Internal counterpart used by the fal action (which has already resolved
// the userId via getAuthUserId on the action ctx). Same idempotent semantics.
export const linkSessionToUserInternal = internalMutation({
  args: { sessionId: v.id("sessions"), userId: v.id("users") },
  handler: async (ctx, { sessionId, userId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return;
    if (session.userId === userId) return;
    if (session.userId && session.userId !== userId) return;
    await ctx.db.patch(sessionId, { userId });
  },
});

// Reads the calling user's regen budget. Used by the generate / regenerate
// pages to decide whether to send the request or show "out of regens".
export const getMyRegensRemaining = query({
  args: {},
  handler: async (ctx): Promise<number | null> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return user.regensRemaining ?? 3;
  },
});

// Returns the user's gallery across every session they own. Each item is
// stamped with its source session id and the per-session index so the
// "Buy this one" flow can hand both back to useFromUserGallery. Cheap for
// the expected scale (a user has at most a few sessions × ~3 items each).
export const getUserGallery = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const items = sessions.flatMap((s) =>
      (s.galleryItems ?? []).map((it, index) => ({
        ...it,
        sessionId: s._id,
        index,
      })),
    );
    items.sort((a, b) => b.createdAt - a.createdAt);
    return items;
  },
});

export const addPhoto = mutation({
  args: {
    id: v.id("sessions"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { id, storageId }) => {
    const session = await ctx.db.get(id);
    if (!session) throw new Error("Session not found");
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("Couldn't resolve storage URL");

    const ids = [...(session.petPhotoStorageIds ?? []), storageId];
    const urls = [...(session.petPhotoUrls ?? []), url];
    await ctx.db.patch(id, {
      petPhotoStorageIds: ids,
      petPhotoUrls: urls,
    });
    return { url, count: urls.length };
  },
});

export const removePhoto = mutation({
  args: {
    id: v.id("sessions"),
    index: v.number(),
  },
  handler: async (ctx, { id, index }) => {
    const session = await ctx.db.get(id);
    if (!session) throw new Error("Session not found");
    const ids = [...(session.petPhotoStorageIds ?? [])];
    const urls = [...(session.petPhotoUrls ?? [])];
    if (index < 0 || index >= urls.length) return;
    const [removedId] = ids.splice(index, 1);
    urls.splice(index, 1);
    await ctx.db.patch(id, { petPhotoStorageIds: ids, petPhotoUrls: urls });
    // Best-effort cleanup of the actual file in storage.
    try { await ctx.storage.delete(removedId); } catch { /* ignore */ }
  },
});

export const saveQuiz = mutation({
  args: {
    id: v.id("sessions"),
    answers: v.object({
      name: v.optional(v.string()),
      // breed is the joined display string for crossbreeds; breeds is the
      // structured array. Both omitted when the user ticks "I'm not sure".
      breed: v.optional(v.string()),
      breeds: v.optional(v.array(v.string())),
      age: v.optional(v.string()),
      // Required from the v3 quiz. Optional in the schema validator so
      // legacy sessions without these fields still validate; required here
      // so every new submission carries them.
      gender: v.string(),
      size: v.string(),
      lifestyle: v.optional(v.string()),
      activity: v.string(),
      mood: v.string(),
      favouriteFeature: v.string(),
    }),
  },
  handler: async (ctx, { id, answers }) => {
    const rankedStyles = scoreStyles(answers);
    const rankedArtists = scoreArtists(answers);
    await ctx.db.patch(id, { quizAnswers: answers, rankedStyles, rankedArtists });
  },
});

export const selectStyle = mutation({
  args: { id: v.id("sessions"), style: v.string() },
  handler: async (ctx, { id, style }) => {
    await ctx.db.patch(id, { selectedStyle: style });
  },
});

// The 3 styles the user picked on the post-quiz picker. We keep them on the
// session so the loading screen and the regenerate button can both fan out
// the same set without re-passing them through every navigation.
//
// Tab 1/2 commit also clears any Tab 3 (Famous Art) selection so the two
// modes can never both be "active" — the Seedream branch reads
// selectedArtworkSlug and would otherwise fork to the wrong pipeline.
export const setSelectedStyles = mutation({
  args: { id: v.id("sessions"), styles: v.array(v.string()) },
  handler: async (ctx, { id, styles }) => {
    if (styles.length !== 3) throw new Error("Pick exactly 3 styles");
    await ctx.db.patch(id, {
      selectedStyles: styles,
      selectedArtworkSlug: undefined,
    });
  },
});

// Tab 3 (Famous Art) single-artwork commit. Symmetric to setSelectedStyles —
// clears selectedStyles in the same patch so the generate action can branch
// purely on `selectedArtworkSlug` without having to disambiguate when both
// fields are set.
export const setSelectedArtwork = mutation({
  args: { id: v.id("sessions"), slug: v.string() },
  handler: async (ctx, { id, slug }) => {
    // Defensive — if the catalog is missing this slug something has gone
    // wrong upstream and we'd rather fail loud than store a dead reference.
    const artwork = await ctx.db
      .query("artworks")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!artwork) throw new Error(`Unknown artwork: ${slug}`);
    if (!artwork.active) throw new Error(`Artwork is disabled: ${slug}`);
    await ctx.db.patch(id, {
      selectedArtworkSlug: slug,
      selectedStyles: undefined,
    });
  },
});

// Used by the fal action to write results back.
export const setGenerationStatus = internalMutation({
  args: {
    id: v.id("sessions"),
    status: v.union(
      v.literal("idle"),
      v.literal("generating"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { id, status, error }) => {
    await ctx.db.patch(id, {
      generationStatus: status,
      generationError: error,
    });
  },
});

export const setGenerations = internalMutation({
  args: {
    id: v.id("sessions"),
    generations: v.array(
      v.object({
        style: v.string(),
        imageUrl: v.string(),
        printFileUrl: v.optional(v.string()),
        petName: v.optional(v.string()),
        breed: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { id, generations }) => {
    await ctx.db.patch(id, { generations, generationStatus: "ready" });
  },
});

// Atomic "do you have a regen, and if so deduct one". Returns the new
// remaining count. Throws if the user is out. Called from the fal action
// before incurring AI cost. If generation later fails, callers should
// `refundRegen` to give it back.
export const consumeRegen = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    const remaining = user.regensRemaining ?? 3;
    if (remaining <= 0) throw new Error("OUT_OF_REGENS");
    await ctx.db.patch(userId, { regensRemaining: remaining - 1 });
    return remaining - 1;
  },
});

export const refundRegen = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return;
    const remaining = user.regensRemaining ?? 3;
    await ctx.db.patch(userId, { regensRemaining: remaining + 1 });
  },
});

// Resets a user's regens back to 3. Called from the Stripe webhook when an
// order completes — every purchase grants 3 fresh generations.
export const resetRegens = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await ctx.db.patch(userId, { regensRemaining: 3 });
  },
});

// Called by fal action after every successful generation. We accept the
// generations + the quiz context so each item knows what activity/mood/petName
// it was made for — useful both for display and (later) for re-prompting.
export const appendGalleryItems = internalMutation({
  args: {
    id: v.id("sessions"),
    items: v.array(
      v.object({
        style: v.string(),
        imageUrl: v.string(),
        printFileUrl: v.optional(v.string()),
        activity: v.optional(v.string()),
        mood: v.optional(v.string()),
        petName: v.optional(v.string()),
        breed: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { id, items }) => {
    const session = await ctx.db.get(id);
    if (!session) return;
    const existing = session.galleryItems ?? [];
    const now = Date.now();
    const next = [
      ...existing,
      ...items.map((it) => ({ ...it, createdAt: now })),
    ];
    await ctx.db.patch(id, { galleryItems: next });
  },
});

// Pick a single item from the gallery to "make current" — sets generations
// to that one image so the existing PDP/checkout flow keeps working without
// special-casing gallery purchases.
export const useFromGallery = mutation({
  args: { id: v.id("sessions"), index: v.number() },
  handler: async (ctx, { id, index }) => {
    const session = await ctx.db.get(id);
    if (!session) throw new Error("Session not found");
    const items = session.galleryItems ?? [];
    const item = items[index];
    if (!item) throw new Error("Gallery item not found");
    // Legacy gallery items may be missing breed (and occasionally petName).
    // Fall back to the session's own quizAnswers so the resulting generation
    // entry is fully personalised — the PDP shouldn't have to rely on a
    // runtime fallback chain.
    await ctx.db.patch(id, {
      generations: [
        {
          style: item.style,
          imageUrl: item.imageUrl,
          printFileUrl: item.printFileUrl,
          petName: item.petName ?? session.quizAnswers?.name,
          breed: item.breed ?? session.quizAnswers?.breed,
        },
      ],
      selectedStyle: item.style,
    });
  },
});

// Cross-browser variant of useFromGallery. The /gallery page now shows items
// from every session the user owns (see getUserGallery), which means the
// item the user wants to buy may live on a different session than their
// current local one — typical when they sign in fresh on a new device.
//
// The caller passes their *current* session id (the one in localStorage) and
// a reference to the source: { sourceSessionId, index }. We verify the user
// owns both, then copy the chosen generation onto the target session so the
// rest of the PDP/checkout flow stays unchanged.
export const useFromUserGallery = mutation({
  args: {
    targetSessionId: v.id("sessions"),
    sourceSessionId: v.id("sessions"),
    index: v.number(),
  },
  handler: async (ctx, { targetSessionId, sourceSessionId, index }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const source = await ctx.db.get(sourceSessionId);
    if (!source) throw new Error("Source session not found");
    if (source.userId !== userId) throw new Error("Not your gallery");

    const item = (source.galleryItems ?? [])[index];
    if (!item) throw new Error("Gallery item not found");

    const target = await ctx.db.get(targetSessionId);
    if (!target) throw new Error("Target session not found");
    // If the target was created anonymously, claim it for this user so the
    // resulting order links back to the account too.
    if (!target.userId) {
      await ctx.db.patch(targetSessionId, { userId });
    } else if (target.userId !== userId) {
      throw new Error("Not your session");
    }

    // Legacy gallery items may be missing breed (and occasionally petName).
    // Fall back to the source session's quizAnswers so the resulting
    // generation entry is fully personalised — the PDP shouldn't have to
    // rely on a runtime fallback chain.
    await ctx.db.patch(targetSessionId, {
      generations: [
        {
          style: item.style,
          imageUrl: item.imageUrl,
          printFileUrl: item.printFileUrl,
          petName: item.petName ?? source.quizAnswers?.name,
          breed: item.breed ?? source.quizAnswers?.breed,
        },
      ],
      selectedStyle: item.style,
    });
  },
});

// Resets the active "in-progress" flow (photos, quiz, current generations)
// without touching the gallery. Used when a user clicks "Create another
// portrait" so they can start fresh while keeping their saved work.
export const clearCurrentFlow = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, { id }) => {
    const session = await ctx.db.get(id);
    if (!session) return;
    for (const storageId of session.petPhotoStorageIds ?? []) {
      try { await ctx.storage.delete(storageId); } catch { /* ignore */ }
    }
    await ctx.db.patch(id, {
      petPhotoStorageIds: [],
      petPhotoUrls: [],
      quizAnswers: undefined,
      generations: undefined,
      selectedStyle: undefined,
      rankedStyles: undefined,
      rankedArtists: undefined,
      selectedStyles: undefined,
      selectedArtworkSlug: undefined,
      generationStatus: "idle",
      generationError: undefined,
    });
  },
});

// Deletes the user-uploaded pet photos for a session. Called from the fal
// action once the user has exhausted their regen budget — at that point the
// originals can't be used again, so freeing the storage saves bytes.
export const deletePetPhotos = internalMutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, { id }) => {
    const session = await ctx.db.get(id);
    if (!session) return;
    for (const storageId of session.petPhotoStorageIds ?? []) {
      try { await ctx.storage.delete(storageId); } catch { /* ignore */ }
    }
    await ctx.db.patch(id, { petPhotoStorageIds: [], petPhotoUrls: [] });
  },
});
