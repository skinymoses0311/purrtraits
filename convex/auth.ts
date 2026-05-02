import { convexAuth } from "@convex-dev/auth/server";
import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { internal } from "./_generated/api";

// Password provider with no email verification step (deliberate — we want a
// frictionless sign-up at the end of the quiz). Google OAuth uses the Auth.js
// Google provider; AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET must be set on the
// Convex deployment.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password,
    Google,
  ],
  callbacks: {
    // Initialize per-user app state when an account is first created.
    // Convex Auth invokes this on every sign-in / sign-up; the
    // `existingUserId` arg lets us distinguish brand-new users from
    // returning ones so we only seed `regensRemaining` once.
    async createOrUpdateUser(ctx, args) {
      if (args.existingUserId) {
        return args.existingUserId;
      }
      const profile = args.profile as {
        email?: string;
        name?: string;
        image?: string;
      };
      const userId = await ctx.db.insert("users", {
        email: profile.email,
        name: profile.name,
        image: profile.image,
        regensRemaining: 3,
      });
      // Welcome email: scheduled (not awaited) so a Brevo outage can't block
      // sign-up. The action is idempotent on welcomeEmailSentAt.
      if (profile.email) {
        await ctx.scheduler.runAfter(0, internal.brevo.sendWelcome, { userId });
      }
      return userId;
    },
  },
});
