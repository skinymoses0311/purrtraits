"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import Stripe from "stripe";

const PRODUCT_API = "https://product.gelatoapis.com";

type Check = { name: string; ok: boolean; detail?: string };

function authHeaders() {
  return {
    "X-API-KEY": process.env.GELATO_API_KEY!,
    "Content-Type": "application/json",
  };
}

function catalogFor(format: string): string {
  if (format === "poster") return "posters";
  if (format === "framed") return "framed-posters";
  if (format === "canvas") return "canvas";
  throw new Error(`Unknown format ${format}`);
}

/**
 * Runs every check we can run without spending money or going through a browser.
 *   npx convex run tests:runAll
 */
export const runAll = action({
  args: {},
  handler: async (ctx): Promise<{ passed: number; failed: number; checks: Check[] }> => {
    const checks: Check[] = [];

    // ---- 1. Catalog integrity ----
    const products: any = await ctx.runQuery(
      (await import("./_generated/api")).api.products.list,
      {},
    );
    checks.push({
      name: "products.list returns 13 SKUs (12 physical + 1 digital)",
      ok: products.length === 13,
      detail: `got ${products.length}`,
    });

    const formats = new Set(products.map((p: any) => p.format));
    checks.push({
      name: "all 4 formats present (digital/poster/framed/canvas)",
      ok: ["digital", "poster", "framed", "canvas"].every((f) => formats.has(f)),
      detail: [...formats].join(", "),
    });

    const sizes = new Set(products.map((p: any) => p.size));
    checks.push({
      name: "all 3 sizes present (small/medium/large)",
      ok: ["small", "medium", "large"].every((s) => sizes.has(s)),
      detail: [...sizes].join(", "),
    });

    checks.push({
      name: "every PHYSICAL SKU has a gelatoProductUid",
      ok: products
        .filter((p: any) => p.format !== "digital")
        .every((p: any) => !!p.gelatoProductUid),
    });
    checks.push({
      name: "digital SKU has NO gelatoProductUid",
      ok: products
        .filter((p: any) => p.format === "digital")
        .every((p: any) => !p.gelatoProductUid),
    });

    checks.push({
      name: "every PHYSICAL SKU has a printFileUrl (test image)",
      ok: products
        .filter((p: any) => p.format !== "digital")
        .every((p: any) => !!p.printFileUrl),
    });

    checks.push({
      name: "every framed SKU has a frame colour",
      ok: products
        .filter((p: any) => p.format === "framed")
        .every((p: any) => p.frame === "natural-wood" || p.frame === "dark-wood"),
    });

    checks.push({
      name: "non-framed SKUs do NOT have a frame colour set",
      ok: products
        .filter((p: any) => p.format !== "framed")
        .every((p: any) => p.frame === undefined),
    });

    // ---- 2. Gelato productUid validity (one per physical format) ----
    const samples = ["poster", "framed", "canvas"].map(
      (f) => products.find((p: any) => p.format === f && p.size === "small")!,
    );
    for (const p of samples) {
      const url = `${PRODUCT_API}/v3/catalogs/${catalogFor(p.format)}/products/${encodeURIComponent(p.gelatoProductUid)}`;
      const res = await fetch(url, { headers: authHeaders() });
      checks.push({
        name: `Gelato recognises productUid for ${p.name}`,
        ok: res.ok,
        detail: res.ok ? `200 OK` : `${res.status} ${(await res.text()).slice(0, 200)}`,
      });
    }

    // ---- 3. Print file URL is publicly fetchable (Gelato will need this) ----
    const firstPhysical = products.find((p: any) => p.format !== "digital")!;
    const firstUrl = firstPhysical.printFileUrl;
    const fileRes = await fetch(firstUrl, { method: "HEAD" });
    checks.push({
      name: "print file URL is publicly fetchable",
      ok: fileRes.ok,
      detail: `${fileRes.status} ${fileRes.headers.get("content-type") ?? ""}`,
    });

    // ---- 4. Stripe Checkout — physical product session ----
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-09-30.clover",
    });
    const testProduct = firstPhysical;
    const url: string = await ctx.runAction(
      (await import("./_generated/api")).api.payments.createCheckoutSession,
      {
        productId: testProduct._id,
        successUrl: "https://example.com/ok",
        cancelUrl: "https://example.com/cancel",
      },
    );
    checks.push({
      name: "createCheckoutSession returns a Stripe URL",
      ok: url.startsWith("https://checkout.stripe.com/"),
      detail: url.slice(0, 60) + "...",
    });

    // Pull the session ID out of the URL and fetch its config
    const sessionId = new URL(url).pathname.split("/").pop()!;
    // The URL contains a session-derived path, but we can list recent sessions instead
    const sessions = await stripe.checkout.sessions.list({ limit: 1 });
    const session = await stripe.checkout.sessions.retrieve(sessions.data[0].id, {
      expand: ["shipping_options.shipping_rate"],
    });
    checks.push({
      name: "session has shipping_address_collection enabled",
      ok: !!session.shipping_address_collection,
      detail: `countries: ${session.shipping_address_collection?.allowed_countries.length ?? 0}`,
    });
    checks.push({
      name: "shipping_address_collection covers >= 200 countries",
      ok: (session.shipping_address_collection?.allowed_countries.length ?? 0) >= 200,
    });
    checks.push({
      name: "phone_number_collection enabled",
      ok: session.phone_number_collection?.enabled === true,
    });
    const ship = session.shipping_options?.[0];
    const shipRate = ship?.shipping_rate as
      | Stripe.ShippingRate
      | { fixed_amount?: { amount: number; currency: string } }
      | null
      | undefined;
    const shipAmount = (shipRate as any)?.fixed_amount?.amount;
    checks.push({
      name: "$30 USD flat-rate shipping configured",
      ok: shipAmount === 3000,
      detail: shipAmount != null ? `${shipAmount} cents` : "missing",
    });
    checks.push({
      name: "session metadata.convexProductId is set",
      ok: session.metadata?.convexProductId === testProduct._id,
    });

    // ---- 4b. Stripe Checkout — digital product session (no shipping!) ----
    const digitalProduct = products.find((p: any) => p.format === "digital")!;
    await ctx.runAction(
      (await import("./_generated/api")).api.payments.createCheckoutSession,
      {
        productId: digitalProduct._id,
        successUrl: "https://example.com/ok",
        cancelUrl: "https://example.com/cancel",
      },
    );
    const digSessions = await stripe.checkout.sessions.list({ limit: 1 });
    const digSession = await stripe.checkout.sessions.retrieve(digSessions.data[0].id, {
      expand: ["shipping_options.shipping_rate"],
    });
    checks.push({
      name: "DIGITAL session has NO shipping address collection",
      ok: !digSession.shipping_address_collection,
    });
    checks.push({
      name: "DIGITAL session has NO shipping options",
      ok: !digSession.shipping_options || digSession.shipping_options.length === 0,
    });

    // ---- 5. Webhook secrets configured ----
    checks.push({
      name: "STRIPE_SECRET_KEY env var is set",
      ok: !!process.env.STRIPE_SECRET_KEY,
    });
    checks.push({
      name: "STRIPE_WEBHOOK_SECRET env var is set",
      ok: !!process.env.STRIPE_WEBHOOK_SECRET,
    });
    checks.push({
      name: "GELATO_API_KEY env var is set",
      ok: !!process.env.GELATO_API_KEY,
    });

    // Touch sessionId to silence the "unused variable" lint
    void sessionId;

    const passed = checks.filter((c) => c.ok).length;
    const failed = checks.length - passed;
    return { passed, failed, checks };
  },
});
