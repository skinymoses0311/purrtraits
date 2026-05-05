// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";

// User-flow pages that should not be indexed or appear in the sitemap.
// Keep this in sync with the `noindex` prop on each page's <Layout>
// and the Disallow rules in public/robots.txt.
const NOINDEX_PAGES = [
  "/cart",
  "/success",
  "/sign-up",
  "/gallery",
  "/upload",
  "/generate",
  "/reveal",
  "/style-pick",
  "/quiz",
  "/pdp",
];

// React is added as an integration so the Convex Auth UI (which is React-only
// in @convex-dev/auth) can be embedded as a small client-only island on the
// /sign-up page. The rest of the app stays vanilla Astro/TS.
//
// Output is "static" (every page prerenders by default). The Vercel adapter
// is wired up only so we can opt specific endpoints into server-rendered mode
// — currently just /api/geo, which reads the Vercel-injected `x-vercel-ip-country`
// header to auto-detect the buyer's currency. Pages stay static; only the
// explicit `prerender = false` files become serverless.
export default defineConfig({
  site: "https://purrtraits.shop",
  output: "static",
  adapter: vercel(),
  integrations: [
    react(),
    sitemap({
      filter: (page) => !NOINDEX_PAGES.some((p) => page.includes(p)),
    }),
  ],
});
