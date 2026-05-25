// Saved shortlists for the public /dog-name-generator. Kept independent of
// `sessions` so the SEO funnel never touches the buying-flow container.
//
// v2 flow (email-only, no sign-up detour):
//   - Signed-out user submits email + consent checkbox → saveShortlist
//     writes the row, schedules the shortlist email, and (iff consent)
//     schedules a contact-add to Brevo list 3.
//   - Signed-in user → same shape, against their account.
//
// Both send paths are scheduled (not awaited) so a Brevo outage can't block
// the save or break the page — same pattern as sendWelcome in auth.ts.
//
// Legacy: `claimShortlist` and the `claimToken` column are kept for
// backward compatibility with any rows created during the brief window
// between v1 and v2 deploys. New code never sets a claimToken; new clients
// never call claimShortlist. Both can be removed once the legacy rows have
// aged out.

import {
  mutation,
  query,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const inputsValidator = v.object({
  breed: v.optional(v.string()),
  breeds: v.optional(v.array(v.string())),
  breedMode: v.union(
    v.literal("single"),
    v.literal("crossbreed"),
    v.literal("unknown"),
  ),
  gender: v.union(
    v.literal("boy"),
    v.literal("girl"),
    v.literal("either"),
  ),
  styles: v.array(v.string()),
});

const namesValidator = v.array(
  v.object({
    name: v.string(),
    origin: v.string(),
    gender: v.string(),
    meaning: v.string(),
  }),
);

export const saveShortlist = mutation({
  args: {
    inputs: inputsValidator,
    names: namesValidator,
    // Recipient email. Signed-in callers may omit it — we fall back to the
    // account email in the email action. Signed-out callers MUST pass it.
    email: v.optional(v.string()),
    // Whether the user ticked the marketing-consent checkbox on the form.
    // false (or missing) → transactional shortlist email only.
    // true               → also add to Brevo contact list 3.
    marketingConsent: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ id: Id<"dogShortlists"> }> => {
    const userId = await getAuthUserId(ctx);
    const consent = args.marketingConsent === true;
    const now = Date.now();

    if (!userId && !args.email) {
      // Signed-out callers must give us an address — otherwise we have
      // nowhere to send the email.
      throw new Error("Email is required for signed-out saves");
    }

    const id = await ctx.db.insert("dogShortlists", {
      userId: userId ?? undefined,
      inputs: args.inputs,
      names: args.names,
      recipientEmail: args.email,
      marketingConsent: consent,
      marketingConsentAt: consent ? now : undefined,
      createdAt: now,
    });

    // Schedule the shortlist email — idempotent on emailSentAt.
    await ctx.scheduler.runAfter(0, internal.brevo.sendDogNameShortlist, {
      shortlistId: id,
    });

    // If the user gave marketing consent, add them to the Brevo contact
    // list separately. Scheduled (not awaited) so a Brevo /contacts outage
    // doesn't block the save.
    if (consent) {
      await ctx.scheduler.runAfter(
        0,
        internal.brevo.addNameGeneratorContact,
        { shortlistId: id },
      );
    }

    return { id };
  },
});

// LEGACY: kept callable for any in-flight v1 client that still has a pending
// claim token in sessionStorage. New clients never call this. Once we are
// confident no v1 clients are out there, this and the claimToken column
// can be removed in a follow-up migration.
export const claimShortlist = mutation({
  args: {
    id: v.id("dogShortlists"),
    claimToken: v.string(),
  },
  handler: async (ctx, { id, claimToken }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const row = await ctx.db.get(id);
    if (!row) return { ok: false as const, reason: "missing" as const };
    if (row.userId && row.userId !== userId) {
      return { ok: false as const, reason: "owned-by-other" as const };
    }
    if (row.userId === userId) {
      if (!row.emailSentAt) {
        await ctx.scheduler.runAfter(0, internal.brevo.sendDogNameShortlist, {
          shortlistId: id,
        });
      }
      return { ok: true as const, alreadyClaimed: true };
    }
    if (row.claimToken !== claimToken) {
      return { ok: false as const, reason: "bad-token" as const };
    }
    await ctx.db.patch(id, {
      userId,
      claimToken: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.brevo.sendDogNameShortlist, {
      shortlistId: id,
    });
    return { ok: true as const, alreadyClaimed: false };
  },
});

// Lists the calling user's saved shortlists, most recent first. Used by the
// future "My shortlists" view; not consumed in v1 but kept here so the
// table earns its keep beyond the email round-trip.
export const getMyShortlists = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("dogShortlists")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows;
  },
});

// Internal accessors for the email + contact-sync actions.
export const getInternal = internalQuery({
  args: { id: v.id("dogShortlists") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const markEmailSent = internalMutation({
  args: { id: v.id("dogShortlists"), at: v.number() },
  handler: async (ctx, { id, at }) => {
    await ctx.db.patch(id, { emailSentAt: at });
  },
});

export const markContactSynced = internalMutation({
  args: { id: v.id("dogShortlists"), at: v.number() },
  handler: async (ctx, { id, at }) => {
    await ctx.db.patch(id, { contactSyncedAt: at });
  },
});
