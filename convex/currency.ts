// Multi-currency primitives shared between server (cart, payments, seed) and
// client (PDP, cart page, footer toggle). Five supported currencies:
//   usd · gbp · eur · cad · aud
//
// Prices live on `products.prices` as a per-currency cents object; this file
// owns the validator, the country→currency mapping used by /api/geo, and the
// flat shipping table.

import { v } from "convex/values";

export const CURRENCIES = ["usd", "gbp", "eur", "cad", "aud"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const currencyValidator = v.union(
  v.literal("usd"),
  v.literal("gbp"),
  v.literal("eur"),
  v.literal("cad"),
  v.literal("aud"),
);

// Per-currency price set on a product. Keys mirror Currency. Values are in
// the currency's minor unit (cents/pence).
export const pricesValidator = v.object({
  usd: v.number(),
  gbp: v.number(),
  eur: v.number(),
  cad: v.number(),
  aud: v.number(),
});

export type Prices = {
  usd: number;
  gbp: number;
  eur: number;
  cad: number;
  aud: number;
};

// Flat-rate shipping per currency, in minor units. Hand-tuned to round
// numbers per currency rather than FX-converted on the fly so customers see
// stable prices.
export const SHIPPING_CENTS_BY_CURRENCY: Record<Currency, number> = {
  usd: 3000,
  gbp: 2399,
  eur: 2799,
  cad: 4099,
  aud: 4499,
};

export function isCurrency(x: unknown): x is Currency {
  return typeof x === "string" && (CURRENCIES as readonly string[]).includes(x);
}

// ISO-3166 alpha-2 country code → buyer currency. Anything not in this map
// (including most of Asia, LATAM, Africa, Middle East) falls through to USD.
// EU/EEA countries that use the euro are listed individually; non-euro EU
// members (Sweden/Poland/Czechia/etc.) deliberately fall through to USD per
// product decision — we only sell in the five listed currencies.
export const COUNTRY_TO_CURRENCY: Record<string, Currency> = {
  // GBP
  GB: "gbp",
  // CAD
  CA: "cad",
  // AUD
  AU: "aud",
  // EUR — eurozone only
  AT: "eur",
  BE: "eur",
  CY: "eur",
  DE: "eur",
  EE: "eur",
  ES: "eur",
  FI: "eur",
  FR: "eur",
  GR: "eur",
  HR: "eur",
  IE: "eur",
  IT: "eur",
  LT: "eur",
  LU: "eur",
  LV: "eur",
  MT: "eur",
  NL: "eur",
  PT: "eur",
  SI: "eur",
  SK: "eur",
  // US handled by default below — but we list it for clarity.
  US: "usd",
};

export function currencyForCountry(countryCode: string | undefined | null): Currency {
  if (!countryCode) return "usd";
  return COUNTRY_TO_CURRENCY[countryCode.toUpperCase()] ?? "usd";
}
