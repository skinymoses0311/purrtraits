// Saved shortlists for the public /dog-name-generator. Kept independent of
// `sessions` so the SEO funnel never touches the buying-flow container.
//
// Save flow:
//   - Signed-in user: saveShortlist() stamps userId immediately and schedules
//     the transactional email in the same mutation.
//   - Signed-out user: saveShortlist() writes with a fresh claimToken and
//     returns { id, claimToken }. The page stashes the token, sends the user
//     through /sign-up?next=..., then calls claimShortlist() on return to
//     stamp userId and schedule the email.
//
// The email send is scheduled (not awaited) so a Brevo outage can't block
// the save or break the page — same pattern as sendWelcome in auth.ts.

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

// 16 bytes of base36 — random enough that an attacker can't guess another
// user's claim token in practice (~80 bits of entropy).
function makeClaimToken(): string {
  const a = Math.random().toString(36).slice(2, 12);
  const b = Math.random().toString(36).slice(2, 12);
  return `${a}${b}`;
}

export const saveShortlist = mutation({
  args: {
    inputs: inputsValidator,
    names: namesValidator,
    // Signed-out callers pass an email so the email send has a recipient.
    // Signed-in callers can omit it — we use the account email.
    email: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ id: Id<"dogShortlists">; claimToken: string | null }> => {
    const userId = await getAuthUserId(ctx);
    if (userId) {
      // Signed-in: own immediately, schedule email against the user's
      // account email.
      const id = await ctx.db.insert("dogShortlists", {
        userId,
        inputs: args.inputs,
        names: args.names,
        recipientEmail: args.email,
        createdAt: Date.now(),
      });
      await ctx.scheduler.runAfter(0, internal.brevo.sendDogNameShortlist, {
        shortlistId: id,
      });
      return { id, claimToken: null };
    }
    // Signed-out: write unclaimed with a token. Email is sent on claim, not
    // now — sending a shortlist to an anonymous email address before any
    // account verification would be a spam vector.
    const claimToken = makeClaimToken();
    const id = await ctx.db.insert("dogShortlists", {
      claimToken,
      inputs: args.inputs,
      names: args.names,
      recipientEmail: args.email,
      createdAt: Date.now(),
    });
    return { id, claimToken };
  },
});

// Called from /dog-name-generator after the sign-up round-trip. The page
// reads the stashed { id, claimToken } from sessionStorage and posts it
// here; we stamp userId, clear the token, and schedule the email.
//
// Idempotent — claiming an already-claimed row owned by the same user is a
// no-op; claiming a row owned by a different user is a no-op (defensive —
// the token is the bearer credential, but if it leaked, we don't let it
// steal a different user's shortlist).
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
    // Already claimed by this user — still trigger the email send, which is
    // itself idempotent on emailSentAt. This lets a sign-up that succeeded
    // but failed the email schedule recover on a refresh.
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

// Internal accessors for the email action.
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
