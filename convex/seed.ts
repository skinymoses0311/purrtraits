"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const PRODUCT_API = "https://product.gelatoapis.com";

// V1 size ladder. 24x32 chosen over 24x36 so all four frame colours stay
// available at every size (24x36 has no light-wood / white frames).
const SIZES = [
  { size: "small" as const, dim: "12x16-inch" },
  { size: "medium" as const, dim: "18x24-inch" },
  { size: "large" as const, dim: "24x32-inch" },
];

const FRAMES = [
  { frame: "natural-wood" as const, label: "Natural Wood" },
  { frame: "dark-wood" as const, label: "Dark Wood" },
];

// Placeholder pricing (USD cents). Tweak any time.
const PRICES = {
  poster: { small: 1999, medium: 2999, large: 3999 },
  framed: { small: 5999, medium: 7999, large: 9999 },
  canvas: { small: 4999, medium: 6999, large: 8999 },
} as const;

const SIZE_LABEL = {
  small: "Small",
  medium: "Medium",
  large: "Large",
} as const;

function authHeaders() {
  const key = process.env.GELATO_API_KEY;
  if (!key) throw new Error("GELATO_API_KEY not configured");
  return { "X-API-KEY": key, "Content-Type": "application/json" };
}

async function searchOne(
  catalogUid: string,
  filters: Record<string, string[]>,
): Promise<string> {
  const res = await fetch(
    `${PRODUCT_API}/v3/catalogs/${catalogUid}/products:search`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ attributeFilters: filters, limit: 1, offset: 0 }),
    },
  );
  if (!res.ok) throw new Error(`Gelato ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { products?: Array<{ productUid: string }> };
  const uid = json.products?.[0]?.productUid;
  if (!uid) {
    throw new Error(
      `No product for ${catalogUid} ${JSON.stringify(filters)}`,
    );
  }
  return uid;
}

/**
 * Wipes the products table and reseeds it with the V1 catalog (12 SKUs):
 *   - 3 posters         (200gsm uncoated)
 *   - 6 framed posters  (natural-wood + dark-wood, 80lb coated silk inside)
 *   - 3 canvas          (slim 2cm wood frame)
 *
 *   npx convex run seed:seedV1Catalog
 */
export const seedV1Catalog = action({
  args: {},
  handler: async (ctx): Promise<{ inserted: number }> => {
    await ctx.runMutation(internal.products.wipeAllInternal, {});

    let inserted = 0;

    // Digital — single SKU, no Gelato UID, no shipping required.
    // Description is rendered per-session from convex/productCopy.ts so it
    // can interpolate the customer's pet name and breed; we deliberately
    // don't store a static description here.
    await ctx.runMutation(internal.products.insertInternal, {
      name: "Digital Portrait",
      format: "digital",
      size: "small", // placeholder; digital has no real size
      priceCents: 999,
      currency: "usd",
      active: true,
    });
    inserted++;
    for (const { size, dim } of SIZES) {
      // Poster
      const posterUid = await searchOne("posters", {
        PaperFormat: [dim],
        Orientation: ["ver"],
        PaperType: ["200-gsm-uncoated"],
      });
      await ctx.runMutation(internal.products.insertInternal, {
        name: `Poster — ${SIZE_LABEL[size]}`,
        format: "poster",
        size,
        gelatoProductUid: posterUid,
        priceCents: PRICES.poster[size],
        currency: "usd",
        active: true,
      });
      inserted++;

      // Framed posters (one per frame colour)
      for (const { frame, label } of FRAMES) {
        const framedUid = await searchOne("framed-posters", {
          FrameSize: [dim],
          Orientation: ["ver"],
          FrameColor: [frame],
          PaperType: ["80-lb-cover-coated-silk"],
        });
        await ctx.runMutation(internal.products.insertInternal, {
          name: `Framed Poster (${label}) — ${SIZE_LABEL[size]}`,
          format: "framed",
          size,
          frame,
          gelatoProductUid: framedUid,
          priceCents: PRICES.framed[size],
          currency: "usd",
          active: true,
        });
        inserted++;
      }

      // Canvas
      const canvasUid = await searchOne("canvas", {
        CanvasFormat: [dim],
        Orientation: ["ver"],
        CanvasFrame: ["wood-fsc-2-cm"],
      });
      await ctx.runMutation(internal.products.insertInternal, {
        name: `Canvas — ${SIZE_LABEL[size]}`,
        format: "canvas",
        size,
        gelatoProductUid: canvasUid,
        priceCents: PRICES.canvas[size],
        currency: "usd",
        active: true,
      });
      inserted++;
    }
    return { inserted };
  },
});
