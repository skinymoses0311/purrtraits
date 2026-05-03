// One-off backfills. Run via `npx convex run migrations:<name>`.
//
// Paginated to stay under the per-mutation read/write limits on larger
// deployments. Each call processes one page and returns the next cursor;
// the wrapping action loops until done.

import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// Walk every session, and for each gallery item that's missing petName or
// breed, fill them in from the session's own quizAnswers. Run once after
// shipping the gallery-item breed field; safe to re-run (no-ops on items
// already populated).
export const backfillGalleryPetIdentity = internalAction({
  args: {},
  handler: async (ctx) => {
    let cursor: string | null = null;
    let totalSessions = 0;
    let totalItemsPatched = 0;
    let totalSessionsPatched = 0;
    while (true) {
      const result: {
        cursor: string | null;
        isDone: boolean;
        sessionsScanned: number;
        sessionsPatched: number;
        itemsPatched: number;
      } = await ctx.runMutation(
        internal.migrations.backfillGalleryPetIdentityPage,
        { cursor },
      );
      totalSessions += result.sessionsScanned;
      totalItemsPatched += result.itemsPatched;
      totalSessionsPatched += result.sessionsPatched;
      if (result.isDone) break;
      cursor = result.cursor;
    }
    return {
      sessionsScanned: totalSessions,
      sessionsPatched: totalSessionsPatched,
      galleryItemsPatched: totalItemsPatched,
    };
  },
});

export const backfillGalleryPetIdentityPage = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db
      .query("sessions")
      .paginate({ cursor, numItems: 100 });

    let sessionsPatched = 0;
    let itemsPatched = 0;
    for (const session of page.page) {
      const items = session.galleryItems;
      const answers = session.quizAnswers;
      if (!items || items.length === 0 || !answers) continue;
      const fallbackName = answers.name?.trim();
      const fallbackBreed = answers.breed?.trim();
      if (!fallbackName && !fallbackBreed) continue;

      let changed = false;
      const next = items.map((it) => {
        const needsName = !it.petName && fallbackName;
        const needsBreed = !it.breed && fallbackBreed;
        if (!needsName && !needsBreed) return it;
        changed = true;
        itemsPatched += 1;
        return {
          ...it,
          petName: it.petName ?? fallbackName,
          breed: it.breed ?? fallbackBreed,
        };
      });
      if (changed) {
        await ctx.db.patch(session._id, { galleryItems: next });
        sessionsPatched += 1;
      }
    }
    return {
      cursor: page.continueCursor,
      isDone: page.isDone,
      sessionsScanned: page.page.length,
      sessionsPatched,
      itemsPatched,
    };
  },
});
