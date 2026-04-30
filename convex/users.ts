import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

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
