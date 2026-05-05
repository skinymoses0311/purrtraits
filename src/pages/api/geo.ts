import type { APIRoute } from "astro";
import { COUNTRY_TO_CURRENCY } from "../../../convex/currency";

// Server-rendered endpoint — opted out of Astro's default static prerender
// so it runs as a Vercel serverless function and can read the
// Vercel-injected `x-vercel-ip-country` request header.
//
// Called once per visitor on first load (see src/lib/currency.ts) to seed
// the buyer's preferred currency. The result is cached in localStorage and
// on the Convex session, so subsequent visits never call this endpoint.
export const prerender = false;

export const GET: APIRoute = ({ request }) => {
  const country = request.headers.get("x-vercel-ip-country") ?? null;
  const upper = country?.toUpperCase() ?? null;
  const currency = upper ? COUNTRY_TO_CURRENCY[upper] ?? "usd" : "usd";

  return new Response(
    JSON.stringify({ country: upper, currency }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        // No caching: the same edge IP can serve users from different
        // countries (VPNs, mobile carrier exits), and the result is cached
        // client-side anyway. Avoid any CDN-level caching keyed on URL alone.
        "cache-control": "no-store",
      },
    },
  );
};
