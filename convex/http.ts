import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

// Convex Auth's sign-in / OAuth callback / token-refresh routes.
auth.addHttpRoutes(http);

http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }
    // IMPORTANT: must be the raw request body for signature verification.
    const payload = await request.text();

    try {
      await ctx.runAction(internal.payments.handleStripeWebhook, {
        payload,
        signature,
      });
      return new Response(null, { status: 200 });
    } catch (err) {
      console.error("Stripe webhook error:", err);
      return new Response("Webhook error", { status: 400 });
    }
  }),
});

// Gelato sends webhooks for order/shipment status changes.
// Gelato does not currently sign webhooks, so authenticity relies on the
// secrecy of the URL. Treat the webhook URL itself as a credential.
http.route({
  path: "/gelato/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let event: unknown;
    try {
      event = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }
    try {
      await ctx.runAction(internal.gelato.handleWebhook, { event });
      return new Response(null, { status: 200 });
    } catch (err) {
      console.error("Gelato webhook error:", err);
      return new Response("Webhook error", { status: 500 });
    }
  }),
});

export default http;
