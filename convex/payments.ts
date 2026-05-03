"use node";

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import Stripe from "stripe";
import type { Id } from "./_generated/dataModel";
import { formatProductDescription } from "./productCopy";

// Indexed-access type lookup: Stripe SDK 22.x re-exports SessionCreateParams
// as a type alias in Checkout/index.d.ts, which strips the companion
// namespace, so `…SessionCreateParams.ShippingAddressCollection.AllowedCountry`
// no longer resolves. Walking the type via property indices preserves it.
type AllowedCountry = NonNullable<
  Stripe.Checkout.SessionCreateParams["shipping_address_collection"]
>["allowed_countries"][number];

const ALLOWED_SHIPPING_COUNTRIES: AllowedCountry[] = [
  "AC","AD","AE","AF","AG","AI","AL","AM","AO","AQ","AR","AT","AU","AW","AX","AZ",
  "BA","BB","BD","BE","BF","BG","BH","BI","BJ","BL","BM","BN","BO","BQ","BR","BS","BT","BV","BW","BY","BZ",
  "CA","CD","CF","CG","CH","CI","CK","CL","CM","CN","CO","CR","CV","CW","CY","CZ",
  "DE","DJ","DK","DM","DO","DZ","EC","EE","EG","EH","ER","ES","ET",
  "FI","FJ","FK","FO","FR","GA","GB","GD","GE","GF","GG","GH","GI","GL","GM","GN","GP","GQ","GR","GS","GT","GU","GW","GY",
  "HK","HN","HR","HT","HU","ID","IE","IL","IM","IN","IO","IQ","IS","IT",
  "JE","JM","JO","JP","KE","KG","KH","KI","KM","KN","KR","KW","KY","KZ",
  "LA","LB","LC","LI","LK","LR","LS","LT","LU","LV","LY",
  "MA","MC","MD","ME","MF","MG","MK","ML","MM","MN","MO","MQ","MR","MS","MT","MU","MV","MW","MX","MY","MZ",
  "NA","NC","NE","NG","NI","NL","NO","NP","NR","NU","NZ","OM",
  "PA","PE","PF","PG","PH","PK","PL","PM","PN","PR","PS","PT","PY","QA",
  "RE","RO","RS","RU","RW","SA","SB","SC","SE","SG","SH","SI","SJ","SK","SL","SM","SN","SO","SR","SS","ST","SV","SX","SZ",
  "TA","TC","TD","TF","TG","TH","TJ","TK","TL","TM","TN","TO","TR","TT","TV","TW","TZ",
  "UA","UG","US","UY","UZ","VA","VC","VE","VG","VN","VU","WF","WS","XK","YE","YT","ZA","ZM","ZW","ZZ",
];

const SHIPPING_FLAT_CENTS = 3000;

// Builds a Stripe Checkout session for the entire cart on the given Convex
// session. Server re-prices every line from the products table — the client
// never tells us a price. Pre-creates a "pending" order keyed off the Stripe
// session id so the webhook can find it and we don't have to cram the cart
// into Stripe metadata (which has tight per-key limits).
export const createCheckoutSession = action({
  args: {
    sessionId: v.id("sessions"),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, { sessionId, successUrl, cancelUrl }): Promise<string> => {
    const cart = await ctx.runQuery(internal.cart.getInternalForCheckout, {
      sessionId,
    });
    if (!cart || cart.items.length === 0) throw new Error("Cart is empty");

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-04-22.dahlia",
    });

    const hasPhysical = cart.physicalCount > 0;
    const currency = cart.currency;

    type LineItem = NonNullable<Stripe.Checkout.SessionCreateParams["line_items"]>[number];
    const lineItems: LineItem[] = cart.items.map(
      (item) => ({
        quantity: item.quantity,
        price_data: {
          currency,
          unit_amount: item.product.priceCents,
          product_data: {
            name: item.product.name,
            description: formatProductDescription(
              item.product,
              item.petName,
              item.breed,
            ),
          },
        },
      }),
    );

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { convexSessionId: sessionId },
    };

    if (hasPhysical) {
      params.shipping_address_collection = {
        allowed_countries: ALLOWED_SHIPPING_COUNTRIES,
      };
      params.phone_number_collection = { enabled: true };
      params.shipping_options = [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: SHIPPING_FLAT_CENTS, currency },
            display_name: "Worldwide standard",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 5 },
              maximum: { unit: "business_day", value: 14 },
            },
          },
        },
      ];
    }

    const stripeSession = await stripe.checkout.sessions.create(params);
    if (!stripeSession.url) throw new Error("Stripe did not return a checkout URL");

    // Pre-create a pending order with the line snapshot. The webhook fills
    // in shipping/email/total once payment completes.
    // Pet name is stable across all lines in a single cart (same session),
    // so we collapse it onto the order itself for easy customer-support refs.
    const orderPetName =
      cart.items.find((item) => item.petName)?.petName ?? undefined;

    await ctx.runMutation(internal.orders.createPending, {
      sessionId,
      stripeSessionId: stripeSession.id,
      currency,
      petName: orderPetName,
      lineItems: cart.items.map((item) => ({
        productId: item.productId as Id<"products">,
        printFileUrl: item.printFileUrl,
        displayUrl: item.displayUrl,
        style: item.style,
        petName: item.petName,
        breed: item.breed,
        quantity: item.quantity,
        unitPriceCents: item.product.priceCents,
      })),
    });

    return stripeSession.url;
  },
});

export const handleStripeWebhook = internalAction({
  args: {
    payload: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, { payload, signature }): Promise<{ received: boolean }> => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-04-22.dahlia",
    });
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET not configured");

    const event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      webhookSecret,
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.amount_total == null || !session.currency) {
        return { received: true };
      }

      const sessionAny = session as any;
      const shipping =
        sessionAny.collected_information?.shipping_details ??
        sessionAny.shipping_details ??
        null;

      const orderId = await ctx.runMutation(internal.orders.markPaid, {
        stripeSessionId: session.id,
        amountTotal: session.amount_total,
        currency: session.currency,
        customerEmail: session.customer_details?.email ?? undefined,
        shipping: shipping
          ? {
              name: shipping.name ?? "",
              phone: session.customer_details?.phone ?? undefined,
              addressLine1: shipping.address?.line1 ?? "",
              addressLine2: shipping.address?.line2 ?? undefined,
              city: shipping.address?.city ?? "",
              postCode: shipping.address?.postal_code ?? "",
              state: shipping.address?.state ?? undefined,
              country: shipping.address?.country ?? "",
            }
          : undefined,
      });

      if (!orderId) return { received: true };

      // Refill the buyer's generation budget — every purchase grants 3
      // fresh regens. Pulled off the order's userId (set from the session
      // at createPending time).
      const orderForUserId = await ctx.runQuery(internal.orders.getInternal, {
        id: orderId,
      });
      if (orderForUserId?.userId) {
        await ctx.runMutation(internal.sessions.resetRegens, {
          userId: orderForUserId.userId,
        });
      }

      // Clear the cart on the originating Convex session so refreshing the
      // app doesn't show stale lines.
      const convexSessionId = session.metadata?.convexSessionId as
        | Id<"sessions">
        | undefined;
      if (convexSessionId) {
        await ctx.runMutation(internal.cart.clearInternal, {
          sessionId: convexSessionId,
        });
      }

      // Upscale → confirmation email → Gelato. We defer upscaling to here
      // so we don't pay storage/fal costs for previews that never convert.
      // The action is idempotent on `printFileHiResUpscaledAt` and the
      // downstream email/Gelato calls are idempotent on their own markers.
      await ctx.scheduler.runAfter(0, internal.fal.upscaleAndFulfil, {
        orderId,
      });
    }

    return { received: true };
  },
});
