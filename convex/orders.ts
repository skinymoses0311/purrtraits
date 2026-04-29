import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

const shippingValidator = v.object({
  name: v.string(),
  phone: v.optional(v.string()),
  addressLine1: v.string(),
  addressLine2: v.optional(v.string()),
  city: v.string(),
  postCode: v.string(),
  state: v.optional(v.string()),
  country: v.string(),
});

const lineItemValidator = v.object({
  productId: v.id("products"),
  printFileUrl: v.string(),
  displayUrl: v.optional(v.string()),
  style: v.string(),
  petName: v.optional(v.string()),
  quantity: v.number(),
  unitPriceCents: v.number(),
});

// Pre-creates a "pending" order at checkout-session-create time. Cart is
// snapshotted into lineItems here so the webhook can rely on it even if the
// session's cart was cleared/edited after payment was initiated.
export const createPending = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    stripeSessionId: v.string(),
    currency: v.string(),
    petName: v.optional(v.string()),
    lineItems: v.array(lineItemValidator),
  },
  handler: async (ctx, args): Promise<Id<"orders">> => {
    const existing = await ctx.db
      .query("orders")
      .withIndex("by_session", (q) =>
        q.eq("stripeSessionId", args.stripeSessionId),
      )
      .unique();
    if (existing) return existing._id;

    const session = await ctx.db.get(args.sessionId);
    const selectedStyle = session?.selectedStyle ?? args.lineItems[0]?.style;

    return await ctx.db.insert("orders", {
      sessionId: args.sessionId,
      stripeSessionId: args.stripeSessionId,
      currency: args.currency,
      amountTotal: 0,
      lineItems: args.lineItems,
      petName: args.petName,
      selectedStyle,
      status: "pending",
    });
  },
});

// Webhook completes the pending order with the Stripe-confirmed total,
// shipping, and customer email. Idempotent on stripeSessionId.
export const markPaid = internalMutation({
  args: {
    stripeSessionId: v.string(),
    amountTotal: v.number(),
    currency: v.string(),
    customerEmail: v.optional(v.string()),
    shipping: v.optional(shippingValidator),
  },
  handler: async (ctx, args): Promise<Id<"orders"> | null> => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_session", (q) =>
        q.eq("stripeSessionId", args.stripeSessionId),
      )
      .unique();
    if (!order) return null;
    if (order.status === "paid" || order.status === "fulfilling" || order.status === "fulfilled") {
      return order._id;
    }
    await ctx.db.patch(order._id, {
      amountTotal: args.amountTotal,
      currency: args.currency,
      customerEmail: args.customerEmail,
      shipping: args.shipping,
      status: "paid",
    });
    return order._id;
  },
});

export const getInternal = internalQuery({
  args: { id: v.id("orders") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

// Helper for the webhook: does this order contain any physical line?
export const hasPhysicalLines = internalQuery({
  args: { id: v.id("orders") },
  handler: async (ctx, { id }) => {
    const order = await ctx.db.get(id);
    if (!order) return false;
    const lines = order.lineItems ?? [];
    for (const line of lines) {
      const product = await ctx.db.get(line.productId);
      if (product && product.format !== "digital") return true;
    }
    // Legacy single-product fallback.
    if (order.productId) {
      const product = await ctx.db.get(order.productId);
      if (product && product.format !== "digital") return true;
    }
    return false;
  },
});

// Used by /success — looks up an order plus the joined product info for each
// line so the page can render the list without further fetches.
export const getByStripeSession = query({
  args: { stripeSessionId: v.string() },
  handler: async (ctx, { stripeSessionId }) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_session", (q) => q.eq("stripeSessionId", stripeSessionId))
      .unique();
    if (!order) return null;

    const lines = order.lineItems ?? [];
    const lineItemsWithProduct = await Promise.all(
      lines.map(async (line) => ({
        ...line,
        product: await ctx.db.get(line.productId),
      })),
    );

    // Legacy single-product order fallback (pre-cart orders).
    const legacyProduct = order.productId ? await ctx.db.get(order.productId) : null;

    return { order, lineItems: lineItemsWithProduct, legacyProduct };
  },
});

export const setFulfilling = internalMutation({
  args: { id: v.id("orders"), gelatoOrderId: v.string() },
  handler: async (ctx, { id, gelatoOrderId }) => {
    await ctx.db.patch(id, { status: "fulfilling", gelatoOrderId });
  },
});

export const setStatus = internalMutation({
  args: { id: v.id("orders"), status: v.string() },
  handler: async (ctx, { id, status }) => {
    await ctx.db.patch(id, { status });
  },
});

export const setStatusByGelatoId = internalMutation({
  args: { gelatoOrderId: v.string(), status: v.string() },
  handler: async (ctx, { gelatoOrderId, status }) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_gelato", (q) => q.eq("gelatoOrderId", gelatoOrderId))
      .unique();
    if (!order) return;
    await ctx.db.patch(order._id, { status });
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("orders").order("desc").take(50);
  },
});
