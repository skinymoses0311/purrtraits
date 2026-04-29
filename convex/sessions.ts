import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { scoreStyles } from "./styleScoring";

export const create = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.insert("sessions", {
      regensRemaining: 2,
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

export const getInternal = internalQuery({
  args: { id: v.id("sessions") },
  handler: async (ctx, { id }) => ctx.db.get(id),
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
      breed: v.optional(v.string()),
      age: v.optional(v.string()),
      lifestyle: v.optional(v.string()),
      activity: v.string(),
      mood: v.string(),
      room: v.string(),
    }),
  },
  handler: async (ctx, { id, answers }) => {
    const rankedStyles = scoreStyles(answers);
    await ctx.db.patch(id, { quizAnswers: answers, rankedStyles });
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
export const setSelectedStyles = mutation({
  args: { id: v.id("sessions"), styles: v.array(v.string()) },
  handler: async (ctx, { id, styles }) => {
    if (styles.length !== 3) throw new Error("Pick exactly 3 styles");
    await ctx.db.patch(id, { selectedStyles: styles });
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
      }),
    ),
  },
  handler: async (ctx, { id, generations }) => {
    await ctx.db.patch(id, { generations, generationStatus: "ready" });
  },
});

export const decrementRegens = internalMutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, { id }) => {
    const s = await ctx.db.get(id);
    if (!s) return;
    await ctx.db.patch(id, { regensRemaining: Math.max(0, s.regensRemaining - 1) });
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
    await ctx.db.patch(id, {
      generations: [
        {
          style: item.style,
          imageUrl: item.imageUrl,
          printFileUrl: item.printFileUrl,
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
    await ctx.db.patch(id, {
      petPhotoStorageIds: [],
      petPhotoUrls: [],
      quizAnswers: undefined,
      generations: undefined,
      selectedStyle: undefined,
      rankedStyles: undefined,
      selectedStyles: undefined,
      generationStatus: "idle",
      generationError: undefined,
      regensRemaining: 2,
    });
  },
});
