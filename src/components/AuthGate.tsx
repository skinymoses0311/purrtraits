import { useState, useEffect, useRef, type FormEvent } from "react";
import { ConvexReactClient } from "convex/react";
import {
  ConvexAuthProvider,
  useAuthActions,
  useConvexAuth,
} from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api.js";
import type { Id } from "../../convex/_generated/dataModel";
import { track, setUserId } from "../lib/analytics";
import { getCurrentUserId } from "../lib/authStorage";

const PUBLIC_CONVEX_URL = import.meta.env.PUBLIC_CONVEX_URL as string;
const SESSION_STORAGE_KEY = "purrtraits.sessionId";
// Carries the user's just-clicked auth intent across the Google OAuth
// redirect so the post-return code can fire the right sign_up vs sign_in
// event. Cleared as soon as we read it.
const PENDING_AUTH_KEY = "purrtraits.pendingAuth";

// Single ConvexReactClient per page load. Module-scoped so the OAuth code
// exchange runs against the same client the form-based flows used.
const convex = new ConvexReactClient(PUBLIC_CONVEX_URL);

type Props = {
  // Optional fallback for `next` if no `?next=` is in the URL. The page
  // template passes this, but the runtime URL is always preferred (Astro
  // prerenders /sign-up.astro, so the SSR-baked `next` would otherwise be
  // stale across query-string variants).
  next?: string;
};

// Read ?next= client-side so it reflects the actual URL the user is on.
// Falls back to the SSR-passed prop, then to "/". Only allows same-origin
// relative paths to avoid open-redirect risk.
function resolveNext(propNext: string): string {
  if (typeof window === "undefined") return propNext;
  const fromUrl = new URLSearchParams(window.location.search).get("next");
  const candidate = fromUrl ?? propNext ?? "/";
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;
  return "/";
}

export default function AuthGate({ next: propNext = "/" }: Props) {
  const next = resolveNext(propNext);
  return (
    <ConvexAuthProvider client={convex}>
      <AuthCard next={next} />
    </ConvexAuthProvider>
  );
}

function AuthCard({ next }: { next: string }) {
  const { signIn } = useAuthActions();
  // useConvexAuth tracks the provider's auth state. It flips to authenticated
  // both after a password sign-in returns AND after ConvexAuthProvider
  // auto-exchanges a `?code=` from the URL (the Google OAuth callback path).
  // We use a single effect to handle both cases — the password handler just
  // calls signIn() and lets this effect do the redirect.
  const { isLoading, isAuthenticated } = useConvexAuth();
  const [mode, setMode] = useState<"signUp" | "signIn">("signUp");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // True once the user lands here with `?code=` in the URL — Convex Auth
  // is in the middle of exchanging it for tokens. We render a "completing"
  // state instead of the form so the user doesn't see an empty form flash
  // mid-OAuth. ConvexAuthProvider strips the `code` param via replaceURL on
  // mount, so we read it once at mount-time before that runs.
  const [hadOauthCode, setHadOauthCode] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setHadOauthCode(
      new URLSearchParams(window.location.search).has("code"),
    );
  }, []);
  // If we landed with `?code=` but the exchange finished without the user
  // becoming authenticated, the code was invalid/expired — surface a clear
  // error and let the user try again rather than spinning on "Completing…".
  useEffect(() => {
    if (!hadOauthCode) return;
    if (isLoading) return;
    if (isAuthenticated) return;
    setHadOauthCode(false);
    setErr("Sign-in didn't complete. Please try again.");
  }, [hadOauthCode, isLoading, isAuthenticated]);

  // Guard against double-firing: linkAndContinue navigates away, but React
  // may render once more before the navigation actually happens.
  const navigatedRef = useRef(false);
  useEffect(() => {
    if (navigatedRef.current) return;
    if (isLoading) return;
    if (!isAuthenticated) return;
    navigatedRef.current = true;
    void linkAndContinue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated]);

  async function linkAndContinue() {
    // Stitch GA4 sessions to the just-confirmed userId BEFORE firing the
    // auth event, so the sign_up / sign_in hit carries the right user_id.
    try {
      setUserId(getCurrentUserId());
    } catch {
      // Non-fatal.
    }
    // If this run completes a Google OAuth flow, fire the auth event the
    // user originally intended (sign_up vs sign_in based on which tab was
    // active when they clicked Continue with Google).
    try {
      if (typeof window !== "undefined") {
        const pending = sessionStorage.getItem(PENDING_AUTH_KEY);
        if (pending) {
          sessionStorage.removeItem(PENDING_AUTH_KEY);
          const intent = pending === "signUp" ? "sign_up" : "sign_in";
          track(intent, { method: "google" });
        }
      }
    } catch {
      // Non-fatal — analytics must never break navigation.
    }
    // Stamp the in-progress anonymous session with the new userId so
    // generations + orders are tied to the account. Best-effort — the fal
    // action also calls linkSessionToUserInternal as a backstop.
    try {
      const sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
      if (sessionId) {
        await convex.mutation(api.sessions.linkSessionToUser, {
          sessionId: sessionId as Id<"sessions">,
        });
      }
    } catch {
      // Non-fatal.
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
      await signIn("password", formData);
      try {
        // setUserId before firing the event so GA4 stitches the sign-up hit
        // to the just-issued userId.
        setUserId(getCurrentUserId());
        track(mode === "signUp" ? "sign_up" : "sign_in", { method: "email" });
      } catch {
        // Non-fatal.
      }
      // useConvexAuth will flip to authenticated; the effect above handles
      // the redirect. Leave `pending` true so the form stays disabled until
      // navigation kicks in.
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Sign-in failed. Please try again.";
      // Convex Auth surfaces "InvalidAccountId" / "InvalidSecret" for both
      // wrong-password and account-not-found. Translate to plain English.
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
      // Persist the user's intent (sign-up vs sign-in tab) across the OAuth
      // round trip so the post-callback handler can fire the right analytics
      // event with method='google'.
      try {
        sessionStorage.setItem(PENDING_AUTH_KEY, mode);
      } catch {
        // Non-fatal.
      }
      // CRITICAL: redirect back to /sign-up (a React-island page) rather
      // than directly to /generate. Google's callback comes back as
      // ${SITE_URL}${redirectTo}?code=<code>; only a page with
      // ConvexAuthProvider mounted can exchange that code for tokens.
      // The original `next` is preserved so this component can navigate
      // onward once the exchange completes.
      const redirectTo = `/sign-up?next=${encodeURIComponent(next)}`;
      await signIn("google", { redirectTo });
      // The browser navigates away to Google here.
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Google sign-in failed.");
      setPending(false);
    }
  }

  // While the OAuth code is being exchanged, or while we're already authed
  // and waiting for navigation, show a small "completing…" placeholder
  // instead of the form. Avoids a flash of the form between OAuth return
  // and the redirect to /generate.
  const isExchangingCode = hadOauthCode && (isLoading || isAuthenticated);
  if (isExchangingCode || (!isLoading && isAuthenticated)) {
    return (
      <div className="auth auth--pending">
        <p className="muted">Completing sign-in…</p>
      </div>
    );
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
