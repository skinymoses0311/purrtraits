// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";

// React is added as an integration so the Convex Auth UI (which is React-only
// in @convex-dev/auth) can be embedded as a small client-only island on the
// /sign-up page. The rest of the app stays vanilla Astro/TS.
export default defineConfig({
  integrations: [react()],
});
