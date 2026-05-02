"use node";

import { action } from "./_generated/server";

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

    // ---- 4. Stripe Checkout sessions ----
    // Removed: this used to create checkout sessions for individual products
    // via `createCheckoutSession({ productId, … })`, but that signature no
    // longer exists — checkout now flows through the cart and takes a
    // sessionId. Rewriting these checks against the cart flow is a separate
    // job; until then the removed assertions were:
    //   - createCheckoutSession returns a Stripe URL
    //   - shipping_address_collection enabled and ≥ 200 countries (physical)
    //   - phone_number_collection enabled (physical)
    //   - $30 USD flat-rate shipping configured (physical)
    //   - metadata.convexProductId set (physical)
    //   - DIGITAL session has NO shipping address collection / options

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

    const passed = checks.filter((c) => c.ok).length;
    const failed = checks.length - passed;
    return { passed, failed, checks };
  },
});
