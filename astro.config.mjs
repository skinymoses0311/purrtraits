// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

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
export default defineConfig({
  site: "https://purrtraits.shop",
  integrations: [
    react(),
    sitemap({
      filter: (page) => !NOINDEX_PAGES.some((p) => page.includes(p)),
    }),
  ],
});
