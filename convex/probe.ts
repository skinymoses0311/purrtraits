"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

const KEY = () => process.env.GELATO_API_KEY!;
const headers = () => ({ "X-API-KEY": KEY(), "Content-Type": "application/json" });

async function probe(label: string, init: { url: string; method: string; body?: unknown }) {
  try {
    const res = await fetch(init.url, {
      method: init.method,
      headers: headers(),
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    const text = await res.text();
    return { label, url: init.url, method: init.method, status: res.status, ok: res.ok, sample: text.slice(0, 1200) };
  } catch (err) {
    return { label, url: init.url, method: init.method, status: 0, ok: false, sample: String(err) };
  }
}

export const gelatoStoreFlow = action({
  args: {},
  handler: async (): Promise<unknown[]> => {
    return await Promise.all([
      probe("Create store", {
        url: "https://ecommerce.gelatoapis.com/v1/stores",
        method: "POST",
        body: { name: "Purrtraits Probe", currency: "USD" },
      }),
      probe("Try alt: GET mockups", {
        url: "https://product.gelatoapis.com/v3/products/mockups",
        method: "GET",
      }),
      probe("Try alt: ecommerce mockup", {
        url: "https://ecommerce.gelatoapis.com/v1/products/mockups",
        method: "POST",
        body: {
          productUid: "flat_product_pf_18x24-inch_pt_200-gsm-uncoated_cl_4-0_ct_none_prt_none_sft_none_set_none_ver",
        },
      }),
    ]);
  },
});

// Lists existing stores then attempts to create a product in the first one.
// We need the store id to do anything useful.
export const gelatoCreateProduct = action({
  args: {
    storeId: v.string(),
    productUid: v.string(),
    fileUrl: v.string(),
  },
  handler: async (_ctx, { storeId, productUid, fileUrl }): Promise<unknown> => {
    // Per Gelato e-commerce API, products can be created with template-style
    // payloads that include image placeholders. The response should expose
    // mockup image URLs per variant.
    const body = {
      title: "Probe Product",
      description: "Probe — internal mockup test",
      variants: [
        {
          title: "Default",
          productUid,
          imagePlaceholders: [
            { name: "ImageFront", fileType: "default", url: fileUrl },
          ],
        },
      ],
    };
    const res = await fetch(
      `https://ecommerce.gelatoapis.com/v1/stores/${storeId}/products`,
      { method: "POST", headers: headers(), body: JSON.stringify(body) },
    );
    const text = await res.text();
    return { status: res.status, ok: res.ok, sample: text.slice(0, 2000) };
  },
});

export const gelatoListProducts = action({
  args: { storeId: v.string() },
  handler: async (_ctx, { storeId }): Promise<unknown> => {
    const res = await fetch(
      `https://ecommerce.gelatoapis.com/v1/stores/${storeId}/products`,
      { headers: headers() },
    );
    const text = await res.text();
    return { status: res.status, ok: res.ok, sample: text.slice(0, 2000) };
  },
});

export const gelatoGetProduct = action({
  args: { storeId: v.string(), productId: v.string() },
  handler: async (_ctx, { storeId, productId }): Promise<unknown> => {
    const res = await fetch(
      `https://ecommerce.gelatoapis.com/v1/stores/${storeId}/products/${productId}`,
      { headers: headers() },
    );
    const text = await res.text();
    return { status: res.status, ok: res.ok, sample: text.slice(0, 3000) };
  },
});
