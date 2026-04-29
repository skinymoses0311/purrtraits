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

// Disable right-click, drag-to-save, and copy on every img.protected-img
// in the document. Call this once after any dynamic image renders. It's
// idempotent — safe to call multiple times. Real protection requires a
// server-side watermark, but this stops casual save attempts.
export function disableImageGrabbers(root: ParentNode = document) {
  root.querySelectorAll<HTMLImageElement>("img.protected-img").forEach((img) => {
    if ((img as any).__protected) return;
    (img as any).__protected = true;
    img.addEventListener("contextmenu", (e) => e.preventDefault());
    img.addEventListener("dragstart", (e) => e.preventDefault());
    img.draggable = false;
  });
}

// Wire up a brand-aligned loading skeleton for portrait images so the
// browser's broken-image / alt-text placeholder is never seen. The
// helper looks for any <img data-loadable> (or .protected-img / images
// inside an .img-loading-wrap), tags both the image and its wrapper
// with .is-loading until the src finishes loading, then swaps to a
// short fade-in. Idempotent — safe to call after any dynamic render.
export function attachImageLoading(root: ParentNode = document) {
  const sel =
    "img.protected-img, img[data-loadable], .img-loading-wrap img";
  root.querySelectorAll<HTMLImageElement>(sel).forEach((img) => {
    if ((img as any).__loadingWired) return;
    (img as any).__loadingWired = true;

    const wrap = img.closest<HTMLElement>(".protected-wrap, .img-loading-wrap");

    const isReady = () =>
      img.complete && img.naturalWidth > 0;

    const markLoading = () => {
      img.classList.add("is-loading-img");
      img.classList.remove("is-loaded");
      if (wrap) wrap.classList.add("is-loading");
    };
    const markDone = () => {
      img.classList.remove("is-loading-img");
      img.classList.add("is-loaded");
      if (wrap) wrap.classList.remove("is-loading");
    };

    if (!img.getAttribute("src") || !isReady()) {
      markLoading();
    }

    img.addEventListener("load", markDone);
    img.addEventListener("error", markDone);

    // Observe future src swaps so the skeleton reappears between
    // generations (e.g. regenerate on /reveal).
    const obs = new MutationObserver(() => {
      if (!isReady()) markLoading();
    });
    obs.observe(img, { attributes: true, attributeFilter: ["src"] });

    if (isReady()) markDone();
  });
}
