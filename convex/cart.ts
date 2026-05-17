import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc } from "./_generated/dataModel";
import {
  type Currency,
  SHIPPING_CENTS_BY_CURRENCY,
  currencyValidator,
} from "./currency";

// Resolve which currency a cart should be priced in. Order of precedence:
//   1. Explicit `currency` arg (passed by the cart page so toggling reprices live).
//   2. USD as global fallback.
// User-scoped carts no longer carry a preferredCurrency themselves; the
// session record still owns that and the client passes it through.
function resolveCurrency(preferred: Currency | undefined): Currency {
  return preferred ?? "usd";
}

// Mutations look up the user's cart row, creating an empty one on first
// write. Queries don't use this — they treat absence as "empty cart" so a
// fresh user with no row doesn't pay an insert just to render zero items.
async function getOrCreateCart(
  ctx: MutationCtx,
  userId: string,
): Promise<Doc<"carts">> {
  const existing = await ctx.db
    .query("carts")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (existing) return existing;
  const _id = await ctx.db.insert("carts", { userId, items: [] });
  const inserted = await ctx.db.get(_id);
  if (!inserted) throw new Error("Failed to create cart");
  return inserted;
}

// Add an item to the signed-in user's cart.
//   - merges duplicates by (productId + printFileUrl)
//   - digital lines are pinned to quantity 1
//   - quantity is clamped at >= 1
export const addItem = mutation({
  args: {
    productId: v.id("products"),
    printFileUrl: v.string(),
    displayUrl: v.optional(v.string()),
    style: v.string(),
    petName: v.optional(v.string()),
    breed: v.optional(v.string()),
    quantity: v.optional(v.number()),
  },
  handler: async (ctx, { productId, printFileUrl, displayUrl, style, petName, breed, quantity }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const product = await ctx.db.get(productId);
    if (!product || !product.active) throw new Error("Product unavailable");

    const cartDoc = await getOrCreateCart(ctx, userId);
    const isDigital = product.format === "digital";
    const requested = Math.max(1, quantity ?? 1);
    const items = [...cartDoc.items];
    const existingIndex = items.findIndex(
      (l) => l.productId === productId && l.printFileUrl === printFileUrl,
    );

    if (existingIndex >= 0) {
      const existing = items[existingIndex];
      items[existingIndex] = {
        ...existing,
        // If the existing line had no name/breed/displayUrl (e.g. legacy add),
        // fold the newly-supplied values in so the cart UI improves on next view.
        petName: existing.petName ?? petName,
        breed: existing.breed ?? breed,
        displayUrl: existing.displayUrl ?? displayUrl,
        quantity: isDigital ? 1 : existing.quantity + requested,
      };
    } else {
      items.push({
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

    await ctx.db.patch(cartDoc._id, { items });
  },
});

export const updateQuantity = mutation({
  args: {
    index: v.number(),
    quantity: v.number(),
  },
  handler: async (ctx, { index, quantity }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const cartDoc = await getOrCreateCart(ctx, userId);
    const items = [...cartDoc.items];
    if (index < 0 || index >= items.length) return;

    const line = items[index];
    const product = await ctx.db.get(line.productId);
    const isDigital = product?.format === "digital";
    if (isDigital) return; // qty is fixed at 1 for digital

    const next = Math.max(1, Math.floor(quantity));
    items[index] = { ...line, quantity: next };
    await ctx.db.patch(cartDoc._id, { items });
  },
});

export const removeItem = mutation({
  args: { index: v.number() },
  handler: async (ctx, { index }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const cartDoc = await getOrCreateCart(ctx, userId);
    const items = [...cartDoc.items];
    if (index < 0 || index >= items.length) return;
    items.splice(index, 1);
    await ctx.db.patch(cartDoc._id, { items });
  },
});

export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const cartDoc = await getOrCreateCart(ctx, userId);
    await ctx.db.patch(cartDoc._id, { items: [] });
  },
});

// Cart joined with product info — what the cart UI and the count badge use.
// Computes subtotal/shipping/total server-side so the UI never has to.
//
// Returns null if the user isn't signed in (cart is user-scoped now), so the
// caller can render the empty state without an auth check.
export const getWithProducts = query({
  args: {
    currency: v.optional(currencyValidator),
  },
  handler: async (ctx, { currency }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const cartDoc = await ctx.db
      .query("carts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    const lines = cartDoc?.items ?? [];

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

    const resolved = resolveCurrency(currency);

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
// Takes userId + currency explicitly because the action context can resolve
// both: userId via getAuthUserId, currency via the session record.
export const getInternalForCheckout = internalQuery({
  args: {
    userId: v.string(),
    currency: v.optional(currencyValidator),
  },
  handler: async (ctx, { userId, currency }) => {
    const cartDoc = await ctx.db
      .query("carts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    const lines = cartDoc?.items ?? [];

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

    const resolved = resolveCurrency(currency);

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
// Webhook passes the userId pulled from the Stripe session metadata. Noop
// if no cart row exists yet for that user (e.g. already cleared, or never
// created — which would indicate a checkout flow bug, but we don't want
// the webhook to fail loudly over it).
export const clearInternal = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const cartDoc = await ctx.db
      .query("carts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!cartDoc) return;
    await ctx.db.patch(cartDoc._id, { items: [] });
  },
});

// Lightweight count for the nav cart badge — sums quantities, not lines.
// Returns 0 for anonymous visitors so the badge stays at 0 instead of
// throwing on the subscription.
export const count = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;
    const cartDoc = await ctx.db
      .query("carts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    return (cartDoc?.items ?? []).reduce((n, l) => n + l.quantity, 0);
  },
});
