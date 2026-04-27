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

export const recordPaid = internalMutation({
  args: {
    productId: v.id("products"),
    sessionId: v.optional(v.id("sessions")),
    printFileUrl: v.optional(v.string()),
    stripeSessionId: v.string(),
    amountTotal: v.number(),
    currency: v.string(),
    customerEmail: v.optional(v.string()),
    shipping: v.optional(shippingValidator),
  },
  handler: async (ctx, args): Promise<Id<"orders">> => {
    const existing = await ctx.db
      .query("orders")
      .withIndex("by_session", (q) =>
        q.eq("stripeSessionId", args.stripeSessionId),
      )
      .unique();
    if (existing) return existing._id;

    // If a Convex session is linked, capture which style they bought.
    let selectedStyle: string | undefined;
    if (args.sessionId) {
      const session = await ctx.db.get(args.sessionId);
      selectedStyle = session?.selectedStyle ?? undefined;
    }

    return await ctx.db.insert("orders", {
      productId: args.productId,
      sessionId: args.sessionId,
      stripeSessionId: args.stripeSessionId,
      amountTotal: args.amountTotal,
      currency: args.currency,
      customerEmail: args.customerEmail,
      printFileUrl: args.printFileUrl,
      selectedStyle,
      shipping: args.shipping,
      status: "paid",
    });
  },
});

export const getInternal = internalQuery({
  args: { id: v.id("orders") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

// Used by the /success page to look up an order by the Stripe session id
// (which we get from the redirect URL).
export const getByStripeSession = query({
  args: { stripeSessionId: v.string() },
  handler: async (ctx, { stripeSessionId }) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_session", (q) => q.eq("stripeSessionId", stripeSessionId))
      .unique();
    if (!order) return null;
    const product = await ctx.db.get(order.productId);
    return { order, product };
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
