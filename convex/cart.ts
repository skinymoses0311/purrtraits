import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import {
  type Currency,
  SHIPPING_CENTS_BY_CURRENCY,
  currencyValidator,
} from "./currency";

// Resolve which currency a cart should be priced in. Order of precedence:
//   1. The session's preferredCurrency (set by /api/geo or footer toggle).
//   2. USD as global fallback.
function resolveCurrency(preferred: Currency | undefined): Currency {
  return preferred ?? "usd";
}

// Add an item to the session cart.
//   - merges duplicates by (productId + printFileUrl)
//   - digital lines are pinned to quantity 1
//   - quantity is clamped at >= 1
export const addItem = mutation({
  args: {
    sessionId: v.id("sessions"),
    productId: v.id("products"),
    printFileUrl: v.string(),
    displayUrl: v.optional(v.string()),
    style: v.string(),
    petName: v.optional(v.string()),
    breed: v.optional(v.string()),
    quantity: v.optional(v.number()),
  },
  handler: async (ctx, { sessionId, productId, printFileUrl, displayUrl, style, petName, breed, quantity }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    const product = await ctx.db.get(productId);
    if (!product || !product.active) throw new Error("Product unavailable");

    const isDigital = product.format === "digital";
    const requested = Math.max(1, quantity ?? 1);
    const cart = [...(session.cart ?? [])];
    const existingIndex = cart.findIndex(
      (l) => l.productId === productId && l.printFileUrl === printFileUrl,
    );

    if (existingIndex >= 0) {
      const existing = cart[existingIndex];
      cart[existingIndex] = {
        ...existing,
        // If the existing line had no name/breed/displayUrl (e.g. legacy add),
        // fold the newly-supplied values in so the cart UI improves on next view.
        petName: existing.petName ?? petName,
        breed: existing.breed ?? breed,
        displayUrl: existing.displayUrl ?? displayUrl,
        quantity: isDigital ? 1 : existing.quantity + requested,
      };
    } else {
      cart.push({
        productId,
        printFileUrl,
        displayUrl,
        style,
        petName,
        breed,
        quantity: isDigital ? 1 : requested,
        addedAt: Date.now(),
      });
    }

    await ctx.db.patch(sessionId, { cart });
  },
});

export const updateQuantity = mutation({
  args: {
    sessionId: v.id("sessions"),
    index: v.number(),
    quantity: v.number(),
  },
  handler: async (ctx, { sessionId, index, quantity }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    const cart = [...(session.cart ?? [])];
    if (index < 0 || index >= cart.length) return;

    const line = cart[index];
    const product = await ctx.db.get(line.productId);
    const isDigital = product?.format === "digital";
    if (isDigital) return; // qty is fixed at 1 for digital

    const next = Math.max(1, Math.floor(quantity));
    cart[index] = { ...line, quantity: next };
    await ctx.db.patch(sessionId, { cart });
  },
});

export const removeItem = mutation({
  args: { sessionId: v.id("sessions"), index: v.number() },
  handler: async (ctx, { sessionId, index }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    const cart = [...(session.cart ?? [])];
    if (index < 0 || index >= cart.length) return;
    cart.splice(index, 1);
    await ctx.db.patch(sessionId, { cart });
  },
});

export const clear = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    await ctx.db.patch(sessionId, { cart: [] });
  },
});

// Cart joined with product info — what the cart UI and the count badge use.
// Computes subtotal/shipping/total server-side so the UI never has to.
//
// Currency precedence: optional `currency` arg first (so the cart page can
// reprice live when the user toggles), else the session's preferredCurrency,
// else USD.
export const getWithProducts = query({
  args: {
    sessionId: v.id("sessions"),
    currency: v.optional(currencyValidator),
  },
  handler: async (ctx, { sessionId, currency }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return null;
    const lines = session.cart ?? [];

    const items = await Promise.all(
      lines.map(async (line) => {
        const product = await ctx.db.get(line.productId);
        return { line, product };
      }),
    );

    // Drop any orphaned line whose product has been deleted/deactivated —
    // we don't want them to render or count toward totals.
    const valid = items.filter(
      (i): i is { line: typeof lines[number]; product: NonNullable<typeof i.product> } =>
        Boolean(i.product && i.product.active),
    );

    const resolved = resolveCurrency(currency ?? session.preferredCurrency);

    // Defensive read against `prices`: if the products table hasn't been
    // re-seeded after the multi-currency migration, individual rows may be
    // missing the `prices` map. Fall back to 0 so the query still resolves
    // (and the UI renders a £0.00 line) rather than throwing — a thrown
    // query freezes the cart subscription on "Loading…" forever.
    function unitPriceFor(product: { prices?: Record<string, number> }): number {
      return product.prices?.[resolved] ?? 0;
    }

    let subtotalCents = 0;
    let physicalCount = 0;
    let unitCount = 0;
    for (const { line, product } of valid) {
      subtotalCents += unitPriceFor(product) * line.quantity;
      unitCount += line.quantity;
      if (product.format !== "digital") physicalCount += line.quantity;
    }

    const shippingCents = physicalCount > 0 ? SHIPPING_CENTS_BY_CURRENCY[resolved] : 0;
    const totalCents = subtotalCents + shippingCents;

    return {
      items: valid.map(({ line, product }, index) => ({
        index,
        productId: line.productId,
        printFileUrl: line.printFileUrl,
        displayUrl: line.displayUrl,
        style: line.style,
        petName: line.petName,
        breed: line.breed,
        quantity: line.quantity,
        product,
        unitPriceCents: unitPriceFor(product),
        lineTotalCents: unitPriceFor(product) * line.quantity,
      })),
      subtotalCents,
      shippingCents,
      totalCents,
      currency: resolved,
      unitCount,
      physicalCount,
    };
  },
});

// Internal mirror of getWithProducts for the checkout action — same shape,
// just callable from the server side without exposing it as a public query.
export const getInternalForCheckout = internalQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return null;
    const lines = session.cart ?? [];

    const items = await Promise.all(
      lines.map(async (line) => {
        const product = await ctx.db.get(line.productId);
        return { line, product };
      }),
    );

    const valid = items.filter(
      (i): i is { line: typeof lines[number]; product: NonNullable<typeof i.product> } =>
        Boolean(i.product && i.product.active),
    );

    const resolved = resolveCurrency(session.preferredCurrency);

    // Same defensive guard as in getWithProducts — see comment there.
    function unitPriceFor(product: { prices?: Record<string, number> }): number {
      return product.prices?.[resolved] ?? 0;
    }

    let physicalCount = 0;
    for (const { line, product } of valid) {
      if (product.format !== "digital") physicalCount += line.quantity;
    }

    return {
      items: valid.map(({ line, product }) => ({
        productId: line.productId,
        printFileUrl: line.printFileUrl,
        displayUrl: line.displayUrl,
        style: line.style,
        petName: line.petName,
        breed: line.breed,
        quantity: line.quantity,
        product,
        unitPriceCents: unitPriceFor(product),
      })),
      physicalCount,
      currency: resolved,
    };
  },
});

// Internal: clear cart from the webhook after a successful payment.
export const clearInternal = internalMutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    await ctx.db.patch(sessionId, { cart: [] });
  },
});

// Lightweight count for the nav cart badge — sums quantities, not lines.
export const count = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return 0;
    return (session.cart ?? []).reduce((n, l) => n + l.quantity, 0);
  },
});
