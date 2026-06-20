// One-off backfills. Run via `npx convex run migrations:<name>`.
//
// Paginated to stay under the per-mutation read/write limits on larger
// deployments. Each call processes one page and returns the next cursor;
// the wrapping action loops until done.

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// Diagnostic: examine a single session's quizAnswers + gallery state.
export const debugSession = internalQuery({
  args: { id: v.id("sessions") },
  handler: async (ctx, { id }) => {
    const s = await ctx.db.get(id);
    if (!s) return null;
    return {
      _id: s._id,
      userId: s.userId,
      selectedStyle: s.selectedStyle,
      quizAnswers: s.quizAnswers,
      generations: s.generations,
      cart: s.cart,
      galleryCount: s.galleryItems?.length ?? 0,
    };
  },
});

// Diagnostic: list sessions with selectedStyle set (these are PDP-eligible)
// to spot any whose quizAnswers is missing name/breed.
export const debugPdpSessions = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("sessions").collect();
    return all
      .filter((s) => s.selectedStyle && s.generations)
      .map((s) => ({
        _id: s._id,
        _creationTime: s._creationTime,
        userId: s.userId,
        selectedStyle: s.selectedStyle,
        name: s.quizAnswers?.name,
        breed: s.quizAnswers?.breed,
        hasQuizAnswers: !!s.quizAnswers,
        galleryCount: s.galleryItems?.length ?? 0,
      }))
      .sort((a, b) => b._creationTime - a._creationTime);
  },
});

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
      .paginate({ cursor, numItems: 50 });

    // Per-user "best known" pet identity, drawn from any of the user's
    // sessions' quizAnswers OR any gallery item that already has the field.
    // This catches items on sessions whose quizAnswers got wiped — the same
    // strategy the generations/cart backfill uses.
    const userIds = new Set<string>();
    for (const s of page.page) if (s.userId) userIds.add(s.userId);
    const userFallback = new Map<
      string,
      { petName?: string; breed?: string }
    >();
    const indexUser = (
      userId: string | undefined,
      petName: string | undefined,
      breed: string | undefined,
    ) => {
      if (!userId) return;
      const existing = userFallback.get(userId);
      if (existing && existing.petName && existing.breed) return;
      userFallback.set(userId, {
        petName: existing?.petName ?? (petName?.trim() || undefined),
        breed: existing?.breed ?? (breed?.trim() || undefined),
      });
    };
    for (const userId of userIds) {
      const userSessions = await ctx.db
        .query("sessions")
        .withIndex("by_userId", (q) => q.eq("userId", userId as any))
        .collect();
      for (const s of userSessions) {
        indexUser(userId, s.quizAnswers?.name, s.quizAnswers?.breed);
        for (const it of s.galleryItems ?? []) {
          indexUser(userId, it.petName, it.breed);
        }
      }
    }

    let sessionsPatched = 0;
    let itemsPatched = 0;
    for (const session of page.page) {
      const items = session.galleryItems;
      if (!items || items.length === 0) continue;
      const sessionName = session.quizAnswers?.name?.trim() || undefined;
      const sessionBreed = session.quizAnswers?.breed?.trim() || undefined;
      const userBest = session.userId
        ? userFallback.get(session.userId)
        : undefined;
      const fallbackName = sessionName ?? userBest?.petName;
      const fallbackBreed = sessionBreed ?? userBest?.breed;
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

// Backfill petName + breed onto every existing `generations` entry and
// every existing cart line. The new fields are populated going forward by
// fal.ts / useFromGallery / useFromUserGallery / cart.addItem; this fills
// in the historical rows so the PDP and Stripe checkout stop falling back
// to "your pet" / "dog" on sessions whose quizAnswers got wiped.
//
// Resolution order per row:
//   1. Match by imageUrl/printFileUrl against any of the user's gallery
//      items — those carry petName + breed post the earlier migration.
//   2. Fall back to the session's own quizAnswers if it's still populated.
// Idempotent: only writes if a field is missing AND a value is found.
export const backfillGenerationAndCartIdentity = internalAction({
  args: {},
  handler: async (ctx) => {
    let cursor: string | null = null;
    let totalSessions = 0;
    let totalGenerations = 0;
    let totalCartLines = 0;
    let totalSessionsPatched = 0;
    while (true) {
      const result: {
        cursor: string | null;
        isDone: boolean;
        sessionsScanned: number;
        sessionsPatched: number;
        generationsPatched: number;
        cartLinesPatched: number;
      } = await ctx.runMutation(
        internal.migrations.backfillGenerationAndCartIdentityPage,
        { cursor },
      );
      totalSessions += result.sessionsScanned;
      totalSessionsPatched += result.sessionsPatched;
      totalGenerations += result.generationsPatched;
      totalCartLines += result.cartLinesPatched;
      if (result.isDone) break;
      cursor = result.cursor;
    }
    return {
      sessionsScanned: totalSessions,
      sessionsPatched: totalSessionsPatched,
      generationsPatched: totalGenerations,
      cartLinesPatched: totalCartLines,
    };
  },
});

export const backfillGenerationAndCartIdentityPage = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db
      .query("sessions")
      .paginate({ cursor, numItems: 50 });

    // Build a per-page lookup table from imageUrl/printFileUrl → (petName,
    // breed) by scanning gallery items across every session belonging to
    // each user this page touches. Across-user lookup is bounded: we only
    // query sessions for userIds we've actually seen.
    const userIds = new Set<string>();
    for (const s of page.page) if (s.userId) userIds.add(s.userId);

    const lookups = new Map<
      string,
      { petName?: string; breed?: string }
    >();
    // Per-user "best known" pet identity: if the imageUrl-keyed lookup
    // misses a field (because the matching gallery item was also written
    // before that field existed), we fall back to anything we've seen
    // anywhere in this user's data — quizAnswers OR gallery items.
    const userFallback = new Map<
      string,
      { petName?: string; breed?: string }
    >();
    const indexItem = (
      key: string | undefined,
      petName: string | undefined,
      breed: string | undefined,
    ) => {
      if (!key) return;
      const existing = lookups.get(key);
      if (existing && existing.petName && existing.breed) return;
      lookups.set(key, {
        petName: existing?.petName ?? petName,
        breed: existing?.breed ?? breed,
      });
    };
    const indexUser = (
      userId: string | undefined,
      petName: string | undefined,
      breed: string | undefined,
    ) => {
      if (!userId) return;
      const existing = userFallback.get(userId);
      if (existing && existing.petName && existing.breed) return;
      userFallback.set(userId, {
        petName: existing?.petName ?? (petName?.trim() || undefined),
        breed: existing?.breed ?? (breed?.trim() || undefined),
      });
    };

    // Same-page sessions first (covers anonymous sessions too).
    for (const s of page.page) {
      indexUser(s.userId, s.quizAnswers?.name, s.quizAnswers?.breed);
      for (const it of s.galleryItems ?? []) {
        indexItem(it.imageUrl, it.petName, it.breed);
        indexItem(it.printFileUrl, it.petName, it.breed);
        indexUser(s.userId, it.petName, it.breed);
      }
    }
    // Then expand the lookup with cross-session items for users we touched.
    for (const userId of userIds) {
      const userSessions = await ctx.db
        .query("sessions")
        .withIndex("by_userId", (q) => q.eq("userId", userId as any))
        .collect();
      for (const s of userSessions) {
        indexUser(userId, s.quizAnswers?.name, s.quizAnswers?.breed);
        for (const it of s.galleryItems ?? []) {
          indexItem(it.imageUrl, it.petName, it.breed);
          indexItem(it.printFileUrl, it.petName, it.breed);
          indexUser(userId, it.petName, it.breed);
        }
      }
    }

    let sessionsPatched = 0;
    let generationsPatched = 0;
    let cartLinesPatched = 0;
    for (const session of page.page) {
      const sessionName = session.quizAnswers?.name?.trim() || undefined;
      const sessionBreed = session.quizAnswers?.breed?.trim() || undefined;
      const userBest = session.userId ? userFallback.get(session.userId) : undefined;
      const fallbackName = sessionName ?? userBest?.petName;
      const fallbackBreed = sessionBreed ?? userBest?.breed;

      let changed = false;
      const patch: {
        generations?: NonNullable<typeof session.generations>;
        cart?: NonNullable<typeof session.cart>;
      } = {};

      const gens = session.generations;
      if (gens && gens.length > 0) {
        const nextGens = gens.map((g) => {
          if (g.petName && g.breed) return g;
          const fromGallery =
            lookups.get(g.imageUrl) ??
            (g.printFileUrl ? lookups.get(g.printFileUrl) : undefined);
          const nextName = g.petName ?? fromGallery?.petName ?? fallbackName;
          const nextBreed = g.breed ?? fromGallery?.breed ?? fallbackBreed;
          if (nextName === g.petName && nextBreed === g.breed) return g;
          generationsPatched += 1;
          return { ...g, petName: nextName, breed: nextBreed };
        });
        if (nextGens.some((g, i) => g !== gens[i])) {
          patch.generations = nextGens;
          changed = true;
        }
      }

      const cart = session.cart;
      if (cart && cart.length > 0) {
        const nextCart = cart.map((line) => {
          if (line.breed) return line;
          const fromGallery = lookups.get(line.printFileUrl);
          const nextBreed = line.breed ?? fromGallery?.breed ?? fallbackBreed;
          if (nextBreed === line.breed) return line;
          cartLinesPatched += 1;
          return { ...line, breed: nextBreed };
        });
        if (nextCart.some((l, i) => l !== cart[i])) {
          patch.cart = nextCart;
          changed = true;
        }
      }

      if (changed) {
        await ctx.db.patch(session._id, patch);
        sessionsPatched += 1;
      }
    }

    return {
      cursor: page.continueCursor,
      isDone: page.isDone,
      sessionsScanned: page.page.length,
      sessionsPatched,
      generationsPatched,
      cartLinesPatched,
    };
  },
});

// Quiz v2 cleanup: removes the `room` field from every session's quizAnswers.
// Run once after deploying the v2 quiz; once it completes the `room` validator
// can be deleted from convex/schema.ts in a follow-up. Idempotent — sessions
// without `room` are skipped.
export const stripRoomFromQuizAnswers = internalAction({
  args: {},
  handler: async (ctx) => {
    let cursor: string | null = null;
    let totalScanned = 0;
    let totalPatched = 0;
    while (true) {
      const result: {
        cursor: string | null;
        isDone: boolean;
        sessionsScanned: number;
        sessionsPatched: number;
      } = await ctx.runMutation(
        internal.migrations.stripRoomFromQuizAnswersPage,
        { cursor },
      );
      totalScanned += result.sessionsScanned;
      totalPatched += result.sessionsPatched;
      if (result.isDone) break;
      cursor = result.cursor;
    }
    return { sessionsScanned: totalScanned, sessionsPatched: totalPatched };
  },
});

export const stripRoomFromQuizAnswersPage = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db
      .query("sessions")
      .paginate({ cursor, numItems: 100 });

    let sessionsPatched = 0;
    for (const session of page.page) {
      const answers = session.quizAnswers as
        | (Record<string, unknown> & { room?: string })
        | undefined;
      if (!answers || answers.room === undefined) continue;
      const { room: _room, ...rest } = answers;
      await ctx.db.patch(session._id, {
        quizAnswers: rest as typeof session.quizAnswers,
      });
      sessionsPatched += 1;
    }
    return {
      cursor: page.continueCursor,
      isDone: page.isDone,
      sessionsScanned: page.page.length,
      sessionsPatched,
    };
  },
});

// Backfill species onto every pre-cutover session, order, cart line, and
// generation / gallery item. The schema widened species to v.optional in
// the schema-migration step; this backfill stamps the "dog" default so
// legacy data has a stable species value once the validators narrow.
//
// Idempotent — every guard is "if the field is already set, skip":
//   - sessions: quizAnswers.species missing  → set to "dog"
//                top-level species missing   → set to "dog"
//   - orders:    top-level species missing   → derive from first lineItem
//                with species, else "dog"
//                lineItems[i].species missing → set to "dog"
//   - carts.items[i].species missing         → set to "dog"
//   - legacy sessions.cart[i].species missing → set to "dog"
//   - sessions.generations[i].species missing → set to "dog"
//   - sessions.galleryItems[i].species missing → set to "dog"
//
// Page size 50 (matches the existing migrations in this file).
export const backfillSpecies = internalAction({
  args: {},
  handler: async (ctx) => {
    let cursor: string | null = null;
    let sessionsScanned = 0;
    let sessionsPatched = 0;
    let ordersScanned = 0;
    let ordersPatched = 0;
    let lineItemsPatched = 0;
    let cartsScanned = 0;
    let cartsPatched = 0;
    let cartLinesPatched = 0;
    let generationsPatched = 0;
    let galleryItemsPatched = 0;
    while (true) {
      const result: {
        cursor: string | null;
        isDone: boolean;
        sessionsScanned: number;
        sessionsPatched: number;
        ordersScanned: number;
        ordersPatched: number;
        lineItemsPatched: number;
        cartsScanned: number;
        cartsPatched: number;
        cartLinesPatched: number;
        generationsPatched: number;
        galleryItemsPatched: number;
      } = await ctx.runMutation(
        internal.migrations.backfillSpeciesPage,
        { cursor },
      );
      sessionsScanned += result.sessionsScanned;
      sessionsPatched += result.sessionsPatched;
      ordersScanned += result.ordersScanned;
      ordersPatched += result.ordersPatched;
      lineItemsPatched += result.lineItemsPatched;
      cartsScanned += result.cartsScanned;
      cartsPatched += result.cartsPatched;
      cartLinesPatched += result.cartLinesPatched;
      generationsPatched += result.generationsPatched;
      galleryItemsPatched += result.galleryItemsPatched;
      if (result.isDone) break;
      cursor = result.cursor;
    }
    return {
      sessionsScanned,
      sessionsPatched,
      ordersScanned,
      ordersPatched,
      lineItemsPatched,
      cartsScanned,
      cartsPatched,
      cartLinesPatched,
      generationsPatched,
      galleryItemsPatched,
    };
  },
});

export const backfillSpeciesPage = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    // Walk sessions in pages. The legacy sessions.cart + sessions.generations
    // + sessions.galleryItems arrays live on the same row so we handle
    // them in this same pass. Orders + carts are separate tables; we
    // iterate them within the same page so the action's total count is
    // meaningful.
    const page = await ctx.db
      .query("sessions")
      .paginate({ cursor, numItems: 50 });

    let sessionsScanned = 0;
    let sessionsPatched = 0;
    let generationsPatched = 0;
    let galleryItemsPatched = 0;
    let cartLinesPatched = 0;

    for (const session of page.page) {
      sessionsScanned += 1;
      const answers = session.quizAnswers;
      const answersSpecies = answers?.species;
      // Prefer the quizAnswers value if already set; otherwise default to
      // "dog" for legacy sessions. The top-level species field mirrors
      // quizAnswers.species at saveQuiz time; pre-cutover rows have
      // neither, so we write "dog" to both.
      const species = answersSpecies ?? "dog";

      let changed = false;
      const patch: Partial<typeof session> = {};

      if (answersSpecies === undefined && answers) {
        patch.quizAnswers = { ...answers, species: "dog" };
        changed = true;
      }
      if (session.species === undefined) {
        patch.species = species;
        changed = true;
      }

      // Generations: per-line species. Idempotent — skip if already set.
      const gens = session.generations;
      if (gens && gens.length > 0) {
        const nextGens = gens.map((g) => {
          if (g.species !== undefined) return g;
          generationsPatched += 1;
          return { ...g, species };
        });
        if (nextGens.some((g, i) => g !== gens[i])) {
          patch.generations = nextGens;
          changed = true;
        }
      }

      // Gallery items: per-line species.
      const gallery = session.galleryItems;
      if (gallery && gallery.length > 0) {
        const nextGallery = gallery.map((g) => {
          if (g.species !== undefined) return g;
          galleryItemsPatched += 1;
          return { ...g, species };
        });
        if (nextGallery.some((g, i) => g !== gallery[i])) {
          patch.galleryItems = nextGallery;
          changed = true;
        }
      }

      // Legacy anonymous sessions.cart: per-line species.
      const cart = session.cart;
      if (cart && cart.length > 0) {
        const nextCart = cart.map((line) => {
          if (line.species !== undefined) return line;
          cartLinesPatched += 1;
          return { ...line, species };
        });
        if (nextCart.some((l, i) => l !== cart[i])) {
          patch.cart = nextCart;
          changed = true;
        }
      }

      if (changed) {
        await ctx.db.patch(session._id, patch);
        sessionsPatched += 1;
      }
    }

    // Orders: a separate full-table scan per page (cheap — orders count is
    // bounded by checkout volume). For each order with missing top-level
    // species, derive from the first lineItem that has a species, or
    // "dog" defensively if no lineItem carries species yet. For each
    // lineItem with missing species, set to the derived orderSpecies.
    let ordersScanned = 0;
    let ordersPatched = 0;
    let lineItemsPatched = 0;
    const orderCursor = cursor;
    const orderPage = await ctx.db
      .query("orders")
      .paginate({ cursor: orderCursor, numItems: 50 });

    for (const order of orderPage.page) {
      ordersScanned += 1;
      const lines = order.lineItems;
      const firstWithSpecies = lines?.find((l) => l.species !== undefined);
      const derivedSpecies = firstWithSpecies?.species ?? order.species ?? "dog";

      let changed = false;
      const patch: Partial<typeof order> = {};
      if (order.species === undefined) {
        patch.species = derivedSpecies;
        changed = true;
      }
      if (lines && lines.length > 0) {
        const nextLines = lines.map((line) => {
          if (line.species !== undefined) return line;
          lineItemsPatched += 1;
          return { ...line, species: derivedSpecies };
        });
        if (nextLines.some((l, i) => l !== lines[i])) {
          patch.lineItems = nextLines;
          changed = true;
        }
      }
      if (changed) {
        await ctx.db.patch(order._id, patch);
        ordersPatched += 1;
      }
    }

    // Carts: per-row per-line. Idempotent.
    let cartsScanned = 0;
    let cartsPatched = 0;
    const cartCursor = cursor;
    const cartPage = await ctx.db
      .query("carts")
      .paginate({ cursor: cartCursor, numItems: 50 });
    for (const cart of cartPage.page) {
      cartsScanned += 1;
      const items = cart.items;
      if (items.length === 0) continue;
      const nextItems = items.map((line) => {
        if (line.species !== undefined) return line;
        return { ...line, species: "dog" as const };
      });
      if (nextItems.some((l, i) => l !== items[i])) {
        await ctx.db.patch(cart._id, { items: nextItems });
        cartsPatched += 1;
      }
    }

    // Done when ALL three sub-scans are done (sessions AND orders AND
    // carts). They share the same cursor stream (same numItems), but
    // they may finish at different rates if any of the tables is empty.
    // We report isDone when the slowest one is done.
    const isDone =
      page.isDone && orderPage.isDone && cartPage.isDone;
    return {
      cursor: isDone ? null : page.continueCursor,
      isDone,
      sessionsScanned,
      sessionsPatched,
      ordersScanned,
      ordersPatched,
      lineItemsPatched,
      cartsScanned,
      cartsPatched,
      cartLinesPatched,
      generationsPatched,
      galleryItemsPatched,
    };
  },
});

// Diagnostic — returns counts of how many rows still have a missing
// species field on each of the five tables. A "0" on every count signals
// the backfill is complete and a future deploy can safely narrow the
// species validators from v.optional(...) to required.
export const verifySpeciesBackfill = internalQuery({
  args: {},
  handler: async (ctx) => {
    let sessionsRemaining = 0;
    let ordersRemaining = 0;
    let generationsRemaining = 0;
    let cartLinesRemaining = 0;
    let galleryItemsRemaining = 0;

    // Sessions: any session whose denormalized top-level species is
    // missing (or whose quizAnswers.species is missing on a session that
    // has quizAnswers). Sample the table — bounded by numItems 1000.
    for await (const s of ctx.db.query("sessions")) {
      if (s.species === undefined) sessionsRemaining += 1;
      for (const g of s.generations ?? []) {
        if (g.species === undefined) generationsRemaining += 1;
      }
      for (const it of s.galleryItems ?? []) {
        if (it.species === undefined) galleryItemsRemaining += 1;
      }
      for (const l of s.cart ?? []) {
        if (l.species === undefined) cartLinesRemaining += 1;
      }
      if (sessionsRemaining + generationsRemaining + galleryItemsRemaining + cartLinesRemaining > 1000) break;
    }

    for await (const o of ctx.db.query("orders")) {
      if (o.species === undefined) ordersRemaining += 1;
      if (ordersRemaining > 1000) break;
    }

    return {
      sessionsRemaining,
      ordersRemaining,
      generationsRemaining,
      cartLinesRemaining,
      galleryItemsRemaining,
    };
  },
});
