import { query, internalQuery, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

// Minimal "who am I" lookup used by the nav + gallery to decide what UI to
// render. Returns null if not signed in. We do not return the full user
// document to keep this query cheap and side-effect-free; specific app
// state (regensRemaining etc.) lives in dedicated queries.
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      image: user.image,
    };
  },
});

// Server-side fetch used by the welcome email action. Public `me` returns
// only what the frontend needs; this returns the full doc so the action
// can read email + welcomeEmailSentAt.
export const getInternal = internalQuery({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

// Stamps welcomeEmailSentAt the moment the Brevo send succeeds, so a
// retried createOrUpdateUser won't double-send the welcome email.
export const markWelcomeEmailSent = internalMutation({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { welcomeEmailSentAt: Date.now() });
  },
});
