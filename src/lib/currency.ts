// Browser-side currency helpers. Two responsibilities:
//
//   1. Resolve the buyer's preferred currency on first visit by hitting
//      /api/geo (which reads Vercel's x-vercel-ip-country header), persist
//      it in localStorage, and mirror it onto the Convex session so the
//      cart query can price against it server-side.
//   2. Notify any listeners (PDP price label, cart totals) when the user
//      switches currency via the footer toggle, so prices reprice live
//      without a navigation.

import type { ConvexClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";
import type { Id } from "../../convex/_generated/dataModel";
import { CURRENCIES, type Currency } from "../../convex/currency.ts";

export type { Currency };
export { CURRENCIES };

const STORAGE_KEY = "purrtraits.currency";
const CHANGE_EVENT = "purrtraits:currency-change";

export function isCurrency(x: unknown): x is Currency {
  return typeof x === "string" && (CURRENCIES as readonly string[]).includes(x);
}

// Synchronous read of the cached currency. Returns null if we've never
// resolved one — callers should treat null as "use USD until /api/geo
// settles" rather than blocking the page on the network call.
export function getCachedCurrency(): Currency | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  return isCurrency(raw) ? raw : null;
}

function writeCache(currency: Currency) {
  try {
    localStorage.setItem(STORAGE_KEY, currency);
  } catch {
    // localStorage can throw in private modes; non-fatal.
  }
}

// Currency symbol for ad-hoc string interpolation (e.g. "from $19" upsell
// copy). For full price formatting use `formatMoney` instead.
const SYMBOL: Record<Currency, string> = {
  usd: "$",
  gbp: "£",
  eur: "€",
  cad: "CA$",
  aud: "A$",
};

export function currencySymbol(currency: Currency | string | null | undefined): string {
  if (!currency) return "$";
  const lower = String(currency).toLowerCase();
  return (SYMBOL as Record<string, string>)[lower] ?? "$";
}

// Money formatter shared by every page that renders a price.
// Falls back to a plain "{amount} {CODE}" string if Intl can't resolve the
// currency (very old browsers / locale stripping).
export function formatMoney(cents: number, currency: Currency | string | null | undefined): string {
  const code = (currency ?? "usd").toString().toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${code}`;
  }
}

// Asks /api/geo for the country this request was routed from and maps it
// to a currency. Cached after the first call so we don't keep hitting the
// endpoint on every page navigation.
let geoPromise: Promise<Currency> | null = null;
async function fetchGeoCurrency(): Promise<Currency> {
  if (geoPromise) return geoPromise;
  geoPromise = (async () => {
    try {
      const res = await fetch("/api/geo", { credentials: "omit" });
      if (!res.ok) return "usd";
      const data = (await res.json()) as { currency?: string };
      return isCurrency(data.currency) ? data.currency : "usd";
    } catch {
      return "usd";
    }
  })();
  return geoPromise;
}

// Resolves the currency for this visitor and persists it everywhere we'll
// need it (localStorage + the Convex session). Sticky — if a currency is
// already cached locally, we trust it and skip the geo lookup so the user's
// manual toggle (or a previous visit's auto-detect) wins forever after.
//
// The Convex session is patched best-effort: cart queries fall back to USD
// when the field is missing, so a transient mutation failure is non-fatal.
export async function ensureCurrencyForSession(
  client: ConvexClient,
  sessionId: Id<"sessions"> | null,
): Promise<Currency> {
  let currency = getCachedCurrency();
  if (!currency) {
    currency = await fetchGeoCurrency();
    writeCache(currency);
  }
  if (sessionId) {
    try {
      await client.mutation(api.sessions.setPreferredCurrency, {
        id: sessionId,
        currency,
      });
    } catch {
      // Non-fatal — the cart query falls back to USD when the field's missing.
    }
  }
  return currency;
}

// Manual override (footer toggle). Writes localStorage, patches the Convex
// session, and broadcasts a window event so any open listeners (PDP price,
// cart totals) reprice without a reload.
export async function setCurrency(
  client: ConvexClient,
  sessionId: Id<"sessions"> | null,
  currency: Currency,
): Promise<void> {
  writeCache(currency);
  if (sessionId) {
    try {
      await client.mutation(api.sessions.setPreferredCurrency, {
        id: sessionId,
        currency,
      });
    } catch {
      // Non-fatal — the local cache will still drive UI rendering.
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { currency } }));
  }
}

// Subscribe to currency-change events. Returns a teardown function.
export function onCurrencyChange(handler: (currency: Currency) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<{ currency: Currency }>).detail;
    if (detail && isCurrency(detail.currency)) handler(detail.currency);
  };
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}
