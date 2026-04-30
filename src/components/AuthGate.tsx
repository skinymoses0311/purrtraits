import { useState, type FormEvent } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider, useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api.js";
import type { Id } from "../../convex/_generated/dataModel";

const PUBLIC_CONVEX_URL = import.meta.env.PUBLIC_CONVEX_URL as string;
const SESSION_STORAGE_KEY = "purrtraits.sessionId";

// Single ConvexReactClient for the React island. Module-scoped so the same
// instance is reused across rerenders inside Astro.
const convex = new ConvexReactClient(PUBLIC_CONVEX_URL);

type Props = {
  // Where to send the user once they're signed in. Falls back to /generate
  // (the gate's primary use case is the post-quiz transition into fal).
  next?: string;
};

export default function AuthGate({ next = "/generate" }: Props) {
  return (
    <ConvexAuthProvider client={convex}>
      <AuthCard next={next} />
    </ConvexAuthProvider>
  );
}

function AuthCard({ next }: { next: string }) {
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<"signUp" | "signIn">("signUp");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function linkAndContinue() {
    // After sign-in completes, stamp the in-progress anonymous session with
    // the new userId so generations + orders are tied to the account.
    try {
      const sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
      if (sessionId) {
        await convex.mutation(api.sessions.linkSessionToUser, {
          sessionId: sessionId as Id<"sessions">,
        });
      }
    } catch {
      // Non-fatal: the fal action also calls linkSessionToUserInternal, so
      // even if this fails the session will get linked when generation runs.
    }
    window.location.href = next;
  }

  async function onPasswordSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    const formData = new FormData(e.currentTarget);
    formData.set("flow", mode);
    try {
      const result = await signIn("password", formData);
      // For password flow there's no redirect; result.signingIn === true
      // means we're authed.
      if ((result as { signingIn?: boolean })?.signingIn !== false) {
        await linkAndContinue();
      } else {
        setErr("Sign-in did not complete. Please try again.");
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Sign-in failed. Please try again.";
      // Convex Auth surfaces "InvalidAccountId" on wrong-password / not-found.
      // Translate to something a human reads better.
      if (/InvalidAccountId|InvalidSecret/i.test(message)) {
        setErr(
          mode === "signUp"
            ? "Couldn't create that account — it may already exist."
            : "Email or password is incorrect.",
        );
      } else {
        setErr(message);
      }
      setPending(false);
    }
  }

  async function onGoogle() {
    setErr(null);
    setPending(true);
    try {
      // Google flow redirects out of the page, so linkAndContinue happens on
      // return: the OAuth callback hits Convex, which redirects back to
      // SITE_URL with tokens; we then stamp the session in onMount-ish via a
      // post-redirect handler. To keep that simple we just send the user
      // straight to /generate after redirect — the fal action's
      // linkSessionToUserInternal will stamp the session there.
      await signIn("google", { redirectTo: next });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Google sign-in failed.");
      setPending(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signUp"}
          className={`auth__tab ${mode === "signUp" ? "auth__tab--active" : ""}`}
          onClick={() => setMode("signUp")}
        >
          Create account
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signIn"}
          className={`auth__tab ${mode === "signIn" ? "auth__tab--active" : ""}`}
          onClick={() => setMode("signIn")}
        >
          Sign in
        </button>
      </div>

      <button
        type="button"
        className="btn auth__google"
        onClick={onGoogle}
        disabled={pending}
      >
        <span aria-hidden="true" className="auth__google-icon">G</span>
        Continue with Google
      </button>

      <div className="auth__divider" aria-hidden="true">
        <span>or</span>
      </div>

      <form onSubmit={onPasswordSubmit} className="auth__form">
        <label className="auth__field">
          <span>Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={pending}
          />
        </label>
        <label className="auth__field">
          <span>Password</span>
          <input
            name="password"
            type="password"
            autoComplete={
              mode === "signUp" ? "new-password" : "current-password"
            }
            minLength={8}
            required
            disabled={pending}
          />
        </label>

        {err ? <p className="auth__err">{err}</p> : null}

        <button
          type="submit"
          className="btn btn--primary btn--lg auth__submit"
          disabled={pending}
        >
          {pending
            ? "…"
            : mode === "signUp"
              ? "Create account & continue →"
              : "Sign in & continue →"}
        </button>
      </form>
    </div>
  );
}
