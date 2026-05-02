import { internalQuery } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

// Paginated read of every generated portrait across all sessions, flattened
// into one row per image and stamped with activity/mood. Used by
// scripts/download-gallery.mjs as a one-off admin export.
//
// Newer sessions store finished portraits on `galleryItems`, which already
// carries activity/mood/petName per item. Older sessions only have
// `generations`; for those we fall back to the session's `quizAnswers` so
// every row still has activity/mood when available.
export const listAll = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const result = await ctx.db.query("sessions").paginate(paginationOpts);

    type ExportItem = {
      sessionId: string;
      createdAt: number;
      style: string;
      imageUrl: string;
      printFileUrl?: string;
      activity?: string;
      mood?: string;
      petName?: string;
      source: "galleryItems" | "generations";
    };

    const items: ExportItem[] = [];
    for (const session of result.page) {
      const fallbackActivity = session.quizAnswers?.activity;
      const fallbackMood = session.quizAnswers?.mood;
      const fallbackPet = session.quizAnswers?.name;

      if (session.galleryItems && session.galleryItems.length > 0) {
        for (const g of session.galleryItems) {
          items.push({
            sessionId: session._id,
            createdAt: g.createdAt,
            style: g.style,
            imageUrl: g.imageUrl,
            printFileUrl: g.printFileUrl,
            activity: g.activity ?? fallbackActivity,
            mood: g.mood ?? fallbackMood,
            petName: g.petName ?? fallbackPet,
            source: "galleryItems",
          });
        }
      } else if (session.generations && session.generations.length > 0) {
        for (const g of session.generations) {
          items.push({
            sessionId: session._id,
            createdAt: session._creationTime,
            style: g.style,
            imageUrl: g.imageUrl,
            printFileUrl: g.printFileUrl,
            activity: fallbackActivity,
            mood: fallbackMood,
            petName: fallbackPet,
            source: "generations",
          });
        }
      }
    }

    return {
      items,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});
