// Vanilla bridge for Convex Auth — lets non-React pages read/refresh the JWT
// that the React island wrote to localStorage. We deliberately mirror the
// storage keys @convex-dev/auth uses, so a user who signed in via the React
// island stays signed in everywhere on the site without re-auth.
//
// Token lifecycle:
//   - JWT stored at __convexAuthJWT_<namespace>          (short-lived, ~1h)
//   - refreshToken stored at __convexAuthRefreshToken_<namespace>  (longer)
//   - <namespace> is the deployment URL with non-alphanumerics stripped
//
// `getValidJwt()` returns a usable JWT, refreshing it via the auth.signIn
// action if the stored one is missing or expired. Returns null if the user is
// not signed in (no refresh token at all).

import { ConvexClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";

const PUBLIC_CONVEX_URL = import.meta.env.PUBLIC_CONVEX_URL as string;

function namespace(): string {
  return PUBLIC_CONVEX_URL.replace(/[^a-zA-Z0-9]/g, "");
}

const JWT_KEY = `__convexAuthJWT_${namespace()}`;
const REFRESH_KEY = `__convexAuthRefreshToken_${namespace()}`;
// Refresh slightly before expiry so an in-flight call doesn't 401 mid-request.
const REFRESH_LEEWAY_SECONDS = 60;

export function getStoredJwt(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(JWT_KEY);
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function isSignedIn(): boolean {
  // We treat presence of either token as "signed in" — getValidJwt will
  // refresh on demand if the JWT specifically has expired.
  return !!(getStoredJwt() || getStoredRefreshToken());
}

export function clearAuthLocalStorage() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(JWT_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

function setTokens(jwt: string | null, refreshToken: string | null) {
  if (jwt === null) localStorage.removeItem(JWT_KEY);
  else localStorage.setItem(JWT_KEY, jwt);
  if (refreshToken === null) localStorage.removeItem(REFRESH_KEY);
  else localStorage.setItem(REFRESH_KEY, refreshToken);
}

// Decodes a claim from a JWT without verifying. We only use these for client-side
// checks (refresh timing, analytics user_id); the real signature/exp check happens server-side.
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

function jwtExpUnixSeconds(token: string): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  return typeof payload.exp === "number" ? payload.exp : null;
}

// Pull the userId (sub claim) out of the stored JWT. Returns null if no
// token is present or the claim is missing/malformed. Used by the analytics
// bootstrap so every page load can emit a user_data event for authed users.
export function getCurrentUserId(): string | null {
  const token = getStoredJwt();
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const sub = payload.sub;
  return typeof sub === "string" ? sub : null;
}

function isJwtFresh(token: string): boolean {
  const exp = jwtExpUnixSeconds(token);
  if (exp === null) return true; // can't tell — try it
  return exp - REFRESH_LEEWAY_SECONDS > Math.floor(Date.now() / 1000);
}

let inflightRefresh: Promise<string | null> | null = null;

async function refreshJwt(): Promise<string | null> {
  if (inflightRefresh) return inflightRefresh;
  inflightRefresh = (async () => {
    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) return null;
    // Use a brand-new un-authed client so the refresh call doesn't recurse
    // into our own token fetcher.
    const c = new ConvexClient(PUBLIC_CONVEX_URL);
    try {
      const res = (await c.action(api.auth.signIn as any, {
        refreshToken,
      })) as { tokens?: { token: string; refreshToken: string } | null };
      const tokens = res?.tokens ?? null;
      if (!tokens) {
        clearAuthLocalStorage();
        return null;
      }
      setTokens(tokens.token, tokens.refreshToken);
      return tokens.token;
    } catch {
      clearAuthLocalStorage();
      return null;
    } finally {
      try { c.close(); } catch { /* noop */ }
    }
  })();
  try {
    return await inflightRefresh;
  } finally {
    inflightRefresh = null;
  }
}

// Returns a usable JWT, refreshing if needed. Used as the setAuth fetcher on
// ConvexClient so every authed call automatically gets a current token.
export async function getValidJwt(): Promise<string | null> {
  const stored = getStoredJwt();
  if (stored && isJwtFresh(stored)) return stored;
  return await refreshJwt();
}

// Convenience: build a ConvexClient that already has setAuth wired to the
// vanilla token bridge. Pages that need authed calls (e.g. reveal's
// regenerate button) should use this instead of `makeClient`.
export function makeAuthedClient(): ConvexClient {
  const c = new ConvexClient(PUBLIC_CONVEX_URL);
  c.setAuth(() => getValidJwt());
  return c;
}
