"use node";

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const ORDER_API = "https://order.gelatoapis.com";
const PRODUCT_API = "https://product.gelatoapis.com";

function authHeaders() {
  const key = process.env.GELATO_API_KEY;
  if (!key) throw new Error("GELATO_API_KEY not configured");
  return {
    "X-API-KEY": key,
    "Content-Type": "application/json",
  };
}

export const ping = action({
  args: {},
  handler: async (): Promise<{ ok: boolean; status: number; sample: unknown }> => {
    const res = await fetch(`${ORDER_API}/v4/orders?limit=1`, {
      headers: authHeaders(),
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, sample: body };
  },
});

export const listCatalogs = action({
  args: {},
  handler: async (): Promise<unknown> => {
    const res = await fetch(`${PRODUCT_API}/v3/catalogs`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Gelato ${res.status}: ${await res.text()}`);
    return await res.json();
  },
});

export const searchCatalog = action({
  args: {
    catalogUid: v.string(),
    attributeFilters: v.optional(v.any()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (_ctx, args): Promise<unknown> => {
    const body = {
      attributeFilters: args.attributeFilters ?? {},
      limit: args.limit ?? 50,
      offset: args.offset ?? 0,
    };
    const res = await fetch(
      `${PRODUCT_API}/v3/catalogs/${args.catalogUid}/products:search`,
      { method: "POST", headers: authHeaders(), body: JSON.stringify(body) },
    );
    if (!res.ok) throw new Error(`Gelato ${res.status}: ${await res.text()}`);
    return await res.json();
  },
});

export const getProduct = action({
  args: { catalogUid: v.string(), productUid: v.string() },
  handler: async (_ctx, { catalogUid, productUid }): Promise<unknown> => {
    const res = await fetch(
      `${PRODUCT_API}/v3/catalogs/${catalogUid}/products/${encodeURIComponent(productUid)}`,
      { headers: authHeaders() },
    );
    if (!res.ok) throw new Error(`Gelato ${res.status}: ${await res.text()}`);
    return await res.json();
  },
});

// ---- Order fulfilment (existing) ----

export const createOrder = internalAction({
  args: {
    orderReferenceId: v.string(),
    items: v.array(
      v.object({
        productUid: v.string(),
        quantity: v.number(),
        fileUrl: v.string(),
      }),
    ),
    shippingAddress: v.object({
      firstName: v.string(),
      lastName: v.string(),
      addressLine1: v.string(),
      addressLine2: v.optional(v.string()),
      city: v.string(),
      postCode: v.string(),
      state: v.optional(v.string()),
      country: v.string(),
      email: v.string(),
    }),
    currency: v.string(),
  },
  handler: async (_ctx, args) => {
    const payload = {
      orderType: "order",
      orderReferenceId: args.orderReferenceId,
      customerReferenceId: args.shippingAddress.email,
      currency: args.currency.toUpperCase(),
      items: args.items.map((item, i) => ({
        itemReferenceId: `item-${i}`,
        productUid: item.productUid,
        quantity: item.quantity,
        files: [{ type: "default", url: item.fileUrl }],
      })),
      shippingAddress: args.shippingAddress,
      shipmentMethodUid: "normal",
    };
    const res = await fetch(`${ORDER_API}/v4/orders`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gelato order create failed (${res.status}): ${text}`);
    }
    return await res.json();
  },
});

export const fulfillConvexOrder = internalAction({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }): Promise<void> => {
    const order = await ctx.runQuery(internal.orders.getInternal, { id: orderId });
    if (!order) throw new Error(`Order ${orderId} not found`);
    if (!order.shipping) {
      console.error(`Order ${orderId} has no shipping address — cannot fulfil`);
      await ctx.runMutation(internal.orders.setStatus, { id: orderId, status: "failed" });
      return;
    }

    // Build the list of physical items to send to Gelato. New orders use
    // `lineItems`; legacy single-product orders fall through to the
    // top-level productId/printFileUrl fields.
    type GelatoItem = {
      itemReferenceId: string;
      productUid: string;
      quantity: number;
      files: Array<{ type: string; url: string }>;
    };
    const gelatoItems: GelatoItem[] = [];

    const lineItems = order.lineItems ?? [];
    if (lineItems.length > 0) {
      for (let i = 0; i < lineItems.length; i++) {
        const line = lineItems[i];
        const product = await ctx.runQuery(internal.products.getInternal, {
          id: line.productId,
        });
        if (!product || !product.gelatoProductUid) continue; // skip digital
        const printFileUrl = line.printFileUrl ?? product.printFileUrl;
        if (!printFileUrl) {
          console.error(`Order ${orderId} line ${i} has no print file URL`);
          continue;
        }
        gelatoItems.push({
          itemReferenceId: `${orderId}-item-${i + 1}`,
          productUid: product.gelatoProductUid,
          quantity: line.quantity,
          files: [{ type: "default", url: printFileUrl }],
        });
      }
    } else if (order.productId) {
      const product = await ctx.runQuery(internal.products.getInternal, {
        id: order.productId,
      });
      const printFileUrl = order.printFileUrl ?? product?.printFileUrl;
      if (product?.gelatoProductUid && printFileUrl) {
        gelatoItems.push({
          itemReferenceId: `${orderId}-item-1`,
          productUid: product.gelatoProductUid,
          quantity: 1,
          files: [{ type: "default", url: printFileUrl }],
        });
      }
    }

    if (gelatoItems.length === 0) {
      console.error(`Order ${orderId} has no fulfillable physical items`);
      await ctx.runMutation(internal.orders.setStatus, { id: orderId, status: "failed" });
      return;
    }

    const [firstName, ...rest] = order.shipping.name.trim().split(/\s+/);
    const lastName = rest.join(" ") || firstName;

    const payload = {
      orderType: "order",
      orderReferenceId: orderId,
      customerReferenceId: order.customerEmail ?? orderId,
      currency: order.currency.toUpperCase(),
      items: gelatoItems,
      shippingAddress: {
        firstName,
        lastName,
        addressLine1: order.shipping.addressLine1,
        ...(order.shipping.addressLine2 ? { addressLine2: order.shipping.addressLine2 } : {}),
        city: order.shipping.city,
        postCode: order.shipping.postCode,
        ...(order.shipping.state ? { state: order.shipping.state } : {}),
        country: order.shipping.country,
        ...(order.shipping.phone ? { phone: order.shipping.phone } : {}),
        email: order.customerEmail ?? "",
      },
      shipmentMethodUid: "normal",
    };

    const res = await fetch(`${ORDER_API}/v4/orders`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`Gelato create failed: ${res.status} ${text}`);
      await ctx.runMutation(internal.orders.setStatus, { id: orderId, status: "failed" });
      throw new Error(`Gelato order create failed (${res.status}): ${text}`);
    }
    const gelatoOrder = (await res.json()) as { id: string };
    await ctx.runMutation(internal.orders.setFulfilling, {
      id: orderId,
      gelatoOrderId: gelatoOrder.id,
    });
  },
});

export const handleWebhook = internalAction({
  args: { event: v.any() },
  handler: async (ctx, { event }): Promise<{ received: boolean }> => {
    console.log("Gelato webhook:", JSON.stringify(event));
    const e = event as {
      event?: string;
      orderId?: string;
      fulfillmentStatus?: string;
      comment?: string;
    };
    if (e.event !== "order_status_updated" || !e.orderId || !e.fulfillmentStatus) {
      return { received: true };
    }

    await ctx.runMutation(internal.orders.setStatusByGelatoId, {
      gelatoOrderId: e.orderId,
      status: e.fulfillmentStatus,
    });

    // Map Gelato status → email stage. Anything not in this map is silent.
    // Per spec: only "in_production" triggers the in-production email
    // (we ignore "passed_to_print_provider" so the customer gets one notice).
    const stageByStatus: Record<
      string,
      "inProduction" | "inTransit" | "delivered" | "canceled"
    > = {
      in_production: "inProduction",
      in_transit: "inTransit",
      delivered: "delivered",
      canceled: "canceled",
    };
    const stage = stageByStatus[e.fulfillmentStatus];
    if (!stage) return { received: true };

    const order = await ctx.runQuery(internal.orders.getByGelatoIdInternal, {
      gelatoOrderId: e.orderId,
    });
    if (!order) return { received: true };

    let tracking: { url?: string; carrier?: string; code?: string } | undefined;
    if (stage === "inTransit") {
      const fetched = await ctx.runAction(internal.brevo.fetchGelatoTracking, {
        gelatoOrderId: e.orderId,
      });
      tracking = fetched ?? undefined;
    }

    await ctx.scheduler.runAfter(0, internal.brevo.sendStatusEmail, {
      orderId: order._id,
      stage,
      tracking,
      reason: stage === "canceled" ? e.comment : undefined,
    });

    return { received: true };
  },
});
