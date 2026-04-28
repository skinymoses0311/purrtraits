import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Add an item to the session cart.
//   - merges duplicates by (productId + printFileUrl)
//   - digital lines are pinned to quantity 1
//   - quantity is clamped at >= 1
export const addItem = mutation({
  args: {
    sessionId: v.id("sessions"),
    productId: v.id("products"),
    printFileUrl: v.string(),
    style: v.string(),
    quantity: v.optional(v.number()),
  },
  handler: async (ctx, { sessionId, productId, printFileUrl, style, quantity }) => {
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
        quantity: isDigital ? 1 : existing.quantity + requested,
      };
    } else {
      cart.push({
        productId,
        printFileUrl,
        style,
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
export const getWithProducts = query({
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

    // Drop any orphaned line whose product has been deleted/deactivated —
    // we don't want them to render or count toward totals.
    const valid = items.filter(
      (i): i is { line: typeof lines[number]; product: NonNullable<typeof i.product> } =>
        Boolean(i.product && i.product.active),
    );

    let subtotalCents = 0;
    let physicalCount = 0;
    let unitCount = 0;
    for (const { line, product } of valid) {
      subtotalCents += product.priceCents * line.quantity;
      unitCount += line.quantity;
      if (product.format !== "digital") physicalCount += line.quantity;
    }

    const shippingCents = physicalCount > 0 ? 3000 : 0;
    const totalCents = subtotalCents + shippingCents;
    const currency = valid[0]?.product.currency ?? "usd";

    return {
      items: valid.map(({ line, product }, index) => ({
        index,
        productId: line.productId,
        printFileUrl: line.printFileUrl,
        style: line.style,
        quantity: line.quantity,
        product,
        lineTotalCents: product.priceCents * line.quantity,
      })),
      subtotalCents,
      shippingCents,
      totalCents,
      currency,
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

    let physicalCount = 0;
    for (const { line, product } of valid) {
      if (product.format !== "digital") physicalCount += line.quantity;
    }
    const currency = valid[0]?.product.currency ?? "usd";

    return {
      items: valid.map(({ line, product }) => ({
        productId: line.productId,
        printFileUrl: line.printFileUrl,
        style: line.style,
        quantity: line.quantity,
        product,
      })),
      physicalCount,
      currency,
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
