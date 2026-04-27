// Shared browser-side helpers for the Purrtraits flow.
//
// Every page that's part of the "buying flow" needs:
//   1. A Convex client.
//   2. A session id, persisted in localStorage so it survives navigation.
//
// We create the Convex session lazily on first use (when the user actually
// uploads a photo), so a casual homepage visit doesn't pollute the table.

import { ConvexClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";
import type { Id } from "../../convex/_generated/dataModel";

const STORAGE_KEY = "purrtraits.sessionId";

export function makeClient(): ConvexClient {
  return new ConvexClient(import.meta.env.PUBLIC_CONVEX_URL);
}

export function getSessionId(): Id<"sessions"> | null {
  return (localStorage.getItem(STORAGE_KEY) as Id<"sessions"> | null) ?? null;
}

export function setSessionId(id: Id<"sessions">) {
  localStorage.setItem(STORAGE_KEY, id);
}

export function clearSessionId() {
  localStorage.removeItem(STORAGE_KEY);
}

export async function ensureSession(client: ConvexClient): Promise<Id<"sessions">> {
  let id = getSessionId();
  if (id) {
    // Validate the id still resolves; otherwise start fresh.
    const session = await client.query(api.sessions.get, { id });
    if (session) return id;
  }
  id = (await client.mutation(api.sessions.create, {})) as Id<"sessions">;
  setSessionId(id);
  return id;
}

// Tiny helper to redirect with a friendly message if state is missing.
export function requireOrRedirect(condition: unknown, redirectTo: string): boolean {
  if (!condition) {
    window.location.href = redirectTo;
    return false;
  }
  return true;
}
