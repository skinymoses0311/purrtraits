"use node";

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import Stripe from "stripe";

const ALLOWED_SHIPPING_COUNTRIES: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] = [
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

export const createCheckoutSession = action({
  args: {
    productId: v.id("products"),
    sessionId: v.optional(v.id("sessions")),
    // The specific generated artwork URL the customer is buying. Falls back
    // to the product's printFileUrl (test image) if not provided.
    printFileUrl: v.optional(v.string()),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (
    ctx,
    { productId, sessionId, printFileUrl, successUrl, cancelUrl },
  ): Promise<string> => {
    const product = await ctx.runQuery(internal.products.getInternal, {
      id: productId,
    });
    if (!product) throw new Error("Product not found");

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-09-30.clover",
    });

    const isPhysical = product.format !== "digital";

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: product.currency,
            unit_amount: product.priceCents,
            product_data: {
              name: product.name,
              ...(product.description ? { description: product.description } : {}),
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        convexProductId: productId,
        ...(sessionId ? { convexSessionId: sessionId } : {}),
        ...(printFileUrl ? { printFileUrl } : {}),
      },
    };

    if (isPhysical) {
      params.shipping_address_collection = {
        allowed_countries: ALLOWED_SHIPPING_COUNTRIES,
      };
      params.phone_number_collection = { enabled: true };
      params.shipping_options = [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 3000, currency: "usd" },
            display_name: "Worldwide standard",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 5 },
              maximum: { unit: "business_day", value: 14 },
            },
          },
        },
      ];
    } else {
      // Digital: collect email only, no shipping.
      params.customer_email = undefined;
    }

    const session = await stripe.checkout.sessions.create(params);
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return session.url;
  },
});

export const handleStripeWebhook = internalAction({
  args: {
    payload: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, { payload, signature }): Promise<{ received: boolean }> => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-09-30.clover",
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
      const productId = session.metadata?.convexProductId;
      if (!productId || session.amount_total == null || !session.currency) {
        return { received: true };
      }

      const sessionAny = session as any;
      const shipping =
        sessionAny.collected_information?.shipping_details ??
        sessionAny.shipping_details ??
        null;

      const orderId = await ctx.runMutation(internal.orders.recordPaid, {
        productId: productId as any,
        sessionId: (session.metadata?.convexSessionId as any) ?? undefined,
        printFileUrl: session.metadata?.printFileUrl ?? undefined,
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

      // Only kick off Gelato fulfilment for physical orders.
      const product = await ctx.runQuery(internal.products.getInternal, {
        id: productId as any,
      });
      if (product && product.format !== "digital") {
        await ctx.scheduler.runAfter(0, internal.gelato.fulfillConvexOrder, {
          orderId,
        });
      } else {
        // Digital: mark as fulfilled immediately. Customer gets the link on /success.
        await ctx.runMutation(internal.orders.setStatus, {
          id: orderId,
          status: "fulfilled",
        });
      }
    }

    return { received: true };
  },
});
