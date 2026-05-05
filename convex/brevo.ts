"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const BREVO_API = "https://api.brevo.com/v3";

const SENDER = { name: "Purrtraits", email: "orders@purrtraits.shop" } as const;

// Templates created in Brevo dashboard; IDs are stable per template.
const TEMPLATES = {
  confirmation: 1,
  inProduction: 2,
  inTransit: 3,
  delivered: 4,
  cancellation: 5,
  welcome: 6,
} as const;

const HOMEPAGE_URL = "https://purrtraits.shop";

type Stage = "confirmation" | "inProduction" | "inTransit" | "delivered" | "canceled";

function authHeaders() {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error("BREVO_API_KEY not configured");
  return {
    "api-key": key,
    "Content-Type": "application/json",
    accept: "application/json",
  };
}

function shortOrderNumber(id: string): string {
  return id.slice(-8).toUpperCase();
}

function firstNameOf(fullName: string | undefined): string {
  if (!fullName) return "";
  return fullName.trim().split(/\s+/)[0] ?? "";
}

function formatMoney(amountCents: number, currency: string): string {
  const major = (amountCents / 100).toFixed(2);
  return `${currency.toUpperCase()} ${major}`;
}

async function sendTemplate(args: {
  templateId: number;
  to: { email: string; name?: string };
  params: Record<string, unknown>;
}): Promise<void> {
  const res = await fetch(`${BREVO_API}/smtp/email`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      sender: SENDER,
      to: [args.to],
      templateId: args.templateId,
      params: args.params,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo send failed (${res.status}): ${text}`);
  }
}

// Confirmation: fired right after Stripe webhook marks the order paid.
// Every paid line gets the high-res printFileUrl as a download — physical
// orders include the digital file for free, so the email surfaces it the
// same way it always has for digital-only orders. Param names are kept as
// `digitalDownloads` / `hasDigital` so the existing Brevo template still
// resolves them; the array now just contains entries for physical lines too.
export const sendOrderConfirmation = internalAction({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }): Promise<void> => {
    const data = await ctx.runQuery(internal.orders.getInternalWithProducts, {
      id: orderId,
    });
    if (!data) return;
    const { order, lineItems } = data;
    if (order.confirmationEmailSentAt) return;
    if (!order.customerEmail) {
      console.warn(`Order ${orderId} has no customerEmail — skipping confirmation`);
      return;
    }

    const fullName = order.shipping?.name;
    const lineItemParams = lineItems.map((line) => ({
      name: line.product?.name ?? "Item",
      format: line.product?.format ?? "",
      style: line.style,
      quantity: line.quantity,
      displayUrl: line.displayUrl ?? line.printFileUrl,
      downloadUrl: line.printFileUrl,
      lineTotal: formatMoney(line.unitPriceCents * line.quantity, order.currency),
    }));

    // Dedupe by printFileUrl: a "Poster + Digital of the same artwork" cart
    // would otherwise produce two identical download links in the email.
    const seen = new Set<string>();
    const digitalDownloads: Array<{ name: string; url: string }> = [];
    for (const l of lineItemParams) {
      if (!l.downloadUrl || seen.has(l.downloadUrl)) continue;
      seen.add(l.downloadUrl);
      digitalDownloads.push({ name: l.name, url: l.downloadUrl });
    }

    await sendTemplate({
      templateId: TEMPLATES.confirmation,
      to: { email: order.customerEmail, name: fullName },
      params: {
        firstName: firstNameOf(fullName),
        petName: order.petName ?? "",
        orderNumber: shortOrderNumber(orderId),
        lineItems: lineItemParams,
        total: formatMoney(order.amountTotal, order.currency),
        currency: order.currency.toUpperCase(),
        shippingAddress: order.shipping ?? null,
        hasDigital: digitalDownloads.length > 0,
        digitalDownloads,
        // Convenience: single top-level URL for the typical 1-digital-line cart.
        downloadUrl: digitalDownloads[0]?.url ?? null,
      },
    });

    await ctx.runMutation(internal.orders.markEmailSent, {
      id: orderId,
      stage: "confirmation",
    });
  },
});

// Status emails — fired from the Gelato webhook handler. Each is idempotent
// on its own *EmailSentAt marker.
export const sendStatusEmail = internalAction({
  args: {
    orderId: v.id("orders"),
    stage: v.union(
      v.literal("inProduction"),
      v.literal("inTransit"),
      v.literal("delivered"),
      v.literal("canceled"),
    ),
    tracking: v.optional(
      v.object({
        url: v.optional(v.string()),
        carrier: v.optional(v.string()),
        code: v.optional(v.string()),
      }),
    ),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { orderId, stage, tracking, reason }): Promise<void> => {
    const order = await ctx.runQuery(internal.orders.getInternal, {
      id: orderId,
    });
    if (!order) return;
    if (!order.customerEmail) {
      console.warn(`Order ${orderId} has no customerEmail — skipping ${stage}`);
      return;
    }

    const sentField = `${stage}EmailSentAt` as
      | "inProductionEmailSentAt"
      | "inTransitEmailSentAt"
      | "deliveredEmailSentAt"
      | "canceledEmailSentAt";
    if ((order as Record<string, unknown>)[sentField]) return;

    const templateId =
      stage === "inProduction"
        ? TEMPLATES.inProduction
        : stage === "inTransit"
          ? TEMPLATES.inTransit
          : stage === "delivered"
            ? TEMPLATES.delivered
            : TEMPLATES.cancellation;

    const fullName = order.shipping?.name;
    const params: Record<string, unknown> = {
      firstName: firstNameOf(fullName),
      petName: order.petName ?? "",
      orderNumber: shortOrderNumber(orderId as Id<"orders">),
    };
    if (stage === "inTransit" && tracking) {
      params.trackingUrl = tracking.url ?? null;
      params.trackingCarrier = tracking.carrier ?? null;
      params.trackingCode = tracking.code ?? null;
    }
    if (stage === "canceled") {
      params.reason = reason ?? null;
    }

    await sendTemplate({
      templateId,
      to: { email: order.customerEmail, name: fullName },
      params,
    });

    await ctx.runMutation(internal.orders.markEmailSent, {
      id: orderId,
      stage,
    });
  },
});

// Welcome: fired once per new user from auth.ts createOrUpdateUser. Idempotent
// on `welcomeEmailSentAt` so a retried sign-up flow can't double-send.
export const sendWelcome = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<void> => {
    const user = await ctx.runQuery(internal.users.getInternal, { id: userId });
    if (!user) return;
    if (user.welcomeEmailSentAt) return;
    if (!user.email) {
      console.warn(`User ${userId} has no email — skipping welcome`);
      return;
    }

    await sendTemplate({
      templateId: TEMPLATES.welcome,
      to: { email: user.email, name: user.name },
      params: {
        firstName: firstNameOf(user.name) || "there",
        homepageUrl: HOMEPAGE_URL,
      },
    });

    await ctx.runMutation(internal.users.markWelcomeEmailSent, { id: userId });
  },
});

// Pulls tracking info + ETA off a Gelato order. Gelato exposes shipment
// info on the order detail endpoint under `shipment` (and per-item
// `fulfillments`). We try the order-level shipment first; fall back to
// the first item's fulfillment that has a tracking URL. ETA is taken
// from `shipment.minDeliveryDate` / `maxDeliveryDate` when present and
// returned as unix ms so the orders page can render it directly.
export const fetchGelatoTracking = internalAction({
  args: { gelatoOrderId: v.string() },
  handler: async (
    _ctx,
    { gelatoOrderId },
  ): Promise<{
    tracking: { url: string; carrier?: string; code?: string } | null;
    etaMinAt?: number;
    etaMaxAt?: number;
  } | null> => {
    const key = process.env.GELATO_API_KEY;
    if (!key) return null;
    const res = await fetch(
      `https://order.gelatoapis.com/v4/orders/${encodeURIComponent(gelatoOrderId)}`,
      { headers: { "X-API-KEY": key } },
    );
    if (!res.ok) {
      console.warn(`Gelato order fetch failed: ${res.status}`);
      return null;
    }
    const body = (await res.json()) as {
      shipment?: {
        trackingUrl?: string;
        trackingCode?: string;
        shipmentMethodName?: string;
        minDeliveryDate?: string;
        maxDeliveryDate?: string;
      };
      items?: Array<{
        fulfillments?: Array<{
          trackingUrl?: string;
          trackingCode?: string;
          shipmentMethodName?: string;
        }>;
      }>;
    };

    const parseDate = (s: string | undefined): number | undefined => {
      if (!s) return undefined;
      const t = Date.parse(s);
      return Number.isFinite(t) ? t : undefined;
    };
    const etaMinAt = parseDate(body.shipment?.minDeliveryDate);
    const etaMaxAt = parseDate(body.shipment?.maxDeliveryDate);

    let tracking: { url: string; code?: string; carrier?: string } | null = null;
    if (body.shipment?.trackingUrl) {
      tracking = {
        url: body.shipment.trackingUrl,
        code: body.shipment.trackingCode,
        carrier: body.shipment.shipmentMethodName,
      };
    } else {
      for (const item of body.items ?? []) {
        for (const f of item.fulfillments ?? []) {
          if (f.trackingUrl) {
            tracking = {
              url: f.trackingUrl,
              code: f.trackingCode,
              carrier: f.shipmentMethodName,
            };
            break;
          }
        }
        if (tracking) break;
      }
    }

    return { tracking, etaMinAt, etaMaxAt };
  },
});
