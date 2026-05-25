"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const BREVO_API = "https://api.brevo.com/v3";

const SENDER = { name: "Purrtraits", email: "orders@purrtraits.shop" } as const;

// Templates created in Brevo dashboard; IDs are stable per template.
const TEMPLATES = {
  confirmation: 1,
  inProduction: 2,
  inTransit: 3,
  delivered: 4,
  cancellation: 5,
  welcome: 6,
  nameShortlist: 7,
} as const;

// Brevo contact lists.
//   nameGeneratorLeads (3) — captures emails from the /dog-name-generator
//   page when the user opts in via the marketing-consent checkbox. Kept
//   separate from any future general-newsletter list so the funnel stage
//   ("SEO lead, not yet a buyer") stays addressable.
const LISTS = {
  nameGeneratorLeads: 3,
} as const;

const HOMEPAGE_URL = "https://purrtraits.shop";

// Max names to include in the shortlist email. The page may show more via
// the "show more" control; the email is a digest of the first N from the
// deterministic order — same as what the user saw first on screen.
const SHORTLIST_EMAIL_NAME_COUNT = 20;

type Stage = "confirmation" | "inProduction" | "inTransit" | "delivered" | "canceled";

function authHeaders() {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error("BREVO_API_KEY not configured");
  return {
    "api-key": key,
    "Content-Type": "application/json",
    accept: "application/json",
  };
}

function shortOrderNumber(id: string): string {
  return id.slice(-8).toUpperCase();
}

function firstNameOf(fullName: string | undefined): string {
  if (!fullName) return "";
  return fullName.trim().split(/\s+/)[0] ?? "";
}

function formatMoney(amountCents: number, currency: string): string {
  const major = (amountCents / 100).toFixed(2);
  return `${currency.toUpperCase()} ${major}`;
}

async function sendTemplate(args: {
  templateId: number;
  to: { email: string; name?: string };
  params: Record<string, unknown>;
}): Promise<void> {
  const res = await fetch(`${BREVO_API}/smtp/email`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      sender: SENDER,
      to: [args.to],
      templateId: args.templateId,
      params: args.params,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo send failed (${res.status}): ${text}`);
  }
}

function originLabel(key: string): string {
  switch (key) {
    case "english-germanic": return "English & Germanic";
    case "celtic":           return "Celtic";
    case "romance":          return "Romance";
    case "slavic":           return "Slavic";
    case "arabic":           return "Arabic & Middle Eastern";
    case "east-asian":       return "East Asian";
    default:                 return key;
  }
}

// Confirmation: fired right after Stripe webhook marks the order paid.
// Every paid line gets the high-res printFileUrl as a download — physical
// orders include the digital file for free, so the email surfaces it the
// same way it always has for digital-only orders. Param names are kept as
// `digitalDownloads` / `hasDigital` so the existing Brevo template still
// resolves them; the array now just contains entries for physical lines too.
export const sendOrderConfirmation = internalAction({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }): Promise<void> => {
    const data = await ctx.runQuery(internal.orders.getInternalWithProducts, {
      id: orderId,
    });
    if (!data) return;
    const { order, lineItems } = data;
    if (order.confirmationEmailSentAt) return;
    if (!order.customerEmail) {
      console.warn(`Order ${orderId} has no customerEmail — skipping confirmation`);
      return;
    }

    const fullName = order.shipping?.name;
    const lineItemParams = lineItems.map((line) => ({
      name: line.product?.name ?? "Item",
      format: line.product?.format ?? "",
      style: line.style,
      quantity: line.quantity,
      displayUrl: line.displayUrl ?? line.printFileUrl,
      downloadUrl: line.printFileUrl,
      lineTotal: formatMoney(line.unitPriceCents * line.quantity, order.currency),
    }));

    // Dedupe by printFileUrl: a "Poster + Digital of the same artwork" cart
    // would otherwise produce two identical download links in the email.
    const seen = new Set<string>();
    const digitalDownloads: Array<{ name: string; url: string }> = [];
    for (const l of lineItemParams) {
      if (!l.downloadUrl || seen.has(l.downloadUrl)) continue;
      seen.add(l.downloadUrl);
      digitalDownloads.push({ name: l.name, url: l.downloadUrl });
    }

    await sendTemplate({
      templateId: TEMPLATES.confirmation,
      to: { email: order.customerEmail, name: fullName },
      params: {
        firstName: firstNameOf(fullName),
        petName: order.petName ?? "",
        orderNumber: shortOrderNumber(orderId),
        lineItems: lineItemParams,
        total: formatMoney(order.amountTotal, order.currency),
        currency: order.currency.toUpperCase(),
        shippingAddress: order.shipping ?? null,
        hasDigital: digitalDownloads.length > 0,
        digitalDownloads,
        // Convenience: single top-level URL for the typical 1-digital-line cart.
        downloadUrl: digitalDownloads[0]?.url ?? null,
      },
    });

    await ctx.runMutation(internal.orders.markEmailSent, {
      id: orderId,
      stage: "confirmation",
    });
  },
});

// Status emails — fired from the Gelato webhook handler. Each is idempotent
// on its own *EmailSentAt marker.
export const sendStatusEmail = internalAction({
  args: {
    orderId: v.id("orders"),
    stage: v.union(
      v.literal("inProduction"),
      v.literal("inTransit"),
      v.literal("delivered"),
      v.literal("canceled"),
    ),
    tracking: v.optional(
      v.object({
        url: v.optional(v.string()),
        carrier: v.optional(v.string()),
        code: v.optional(v.string()),
      }),
    ),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { orderId, stage, tracking, reason }): Promise<void> => {
    const order = await ctx.runQuery(internal.orders.getInternal, {
      id: orderId,
    });
    if (!order) return;
    if (!order.customerEmail) {
      console.warn(`Order ${orderId} has no customerEmail — skipping ${stage}`);
      return;
    }

    const sentField = `${stage}EmailSentAt` as
      | "inProductionEmailSentAt"
      | "inTransitEmailSentAt"
      | "deliveredEmailSentAt"
      | "canceledEmailSentAt";
    if ((order as Record<string, unknown>)[sentField]) return;

    const templateId =
      stage === "inProduction"
        ? TEMPLATES.inProduction
        : stage === "inTransit"
          ? TEMPLATES.inTransit
          : stage === "delivered"
            ? TEMPLATES.delivered
            : TEMPLATES.cancellation;

    const fullName = order.shipping?.name;
    const params: Record<string, unknown> = {
      firstName: firstNameOf(fullName),
      petName: order.petName ?? "",
      orderNumber: shortOrderNumber(orderId as Id<"orders">),
    };
    if (stage === "inTransit" && tracking) {
      params.trackingUrl = tracking.url ?? null;
      params.trackingCarrier = tracking.carrier ?? null;
      params.trackingCode = tracking.code ?? null;
    }
    if (stage === "canceled") {
      params.reason = reason ?? null;
    }

    await sendTemplate({
      templateId,
      to: { email: order.customerEmail, name: fullName },
      params,
    });

    await ctx.runMutation(internal.orders.markEmailSent, {
      id: orderId,
      stage,
    });
  },
});

// Dog-name shortlist: fired after the user saves their shortlist from the
// /dog-name-generator page. Idempotent on emailSentAt — a duplicate schedule
// (retry, double-submit) is a no-op once the row is marked.
//
// Recipient priority: the user's account email if present, otherwise the
// recipientEmail captured on the row at save time. If neither is set the
// send is skipped with a warning, never thrown — an email failure must
// never break the save.
//
// Sends via Brevo dashboard template 7 (`nameShortlist`). The template
// expects the param shape below — see also the design doc in the build
// thread for the canonical contract.
export const sendDogNameShortlist = internalAction({
  args: { shortlistId: v.id("dogShortlists") },
  handler: async (ctx, { shortlistId }): Promise<void> => {
    const row = await ctx.runQuery(internal.dogShortlists.getInternal, {
      id: shortlistId,
    });
    if (!row) return;
    if (row.emailSentAt) return;

    let toEmail: string | undefined = row.recipientEmail ?? undefined;
    let toName: string | undefined = undefined;
    if (row.userId) {
      const user = await ctx.runQuery(internal.users.getInternal, {
        id: row.userId,
      });
      if (user?.email) toEmail = user.email;
      if (user?.name) toName = user.name;
    }
    if (!toEmail) {
      console.warn(
        `dogShortlist ${shortlistId} has no recipient email — skipping send`,
      );
      return;
    }

    // Falls back to "there" so the template's "Hi {{ firstName }}" reads
    // naturally for email-only signups where we don't have a name on file.
    const firstName = firstNameOf(toName) || "there";
    // breedLabel is already "your-prefixed" so the template can drop it
    // straight into copy like "for {{ params.breedLabel }}". Stays "your dog"
    // when we don't know the breed.
    const breedLabel =
      row.inputs.breedMode === "unknown"
        ? "your dog"
        : row.inputs.breed
          ? `your ${row.inputs.breed}`
          : "your dog";

    const genderLabel =
      row.inputs.gender === "boy"
        ? "Boy"
        : row.inputs.gender === "girl"
          ? "Girl"
          : "Any";

    const styleLabels = row.inputs.styles.map((s) => originLabel(s));
    const styleLabelsJoined = joinHuman(styleLabels);

    // Top-N: the first SHORTLIST_EMAIL_NAME_COUNT names from the
    // deterministic shuffle the page stored. Matches what the user saw
    // first on screen.
    const topNames = row.names
      .slice(0, SHORTLIST_EMAIL_NAME_COUNT)
      .map((n) => ({
        name: n.name,
        originLabel: originLabel(n.origin),
        meaning: n.meaning,
      }));

    await sendTemplate({
      templateId: TEMPLATES.nameShortlist,
      to: { email: toEmail, name: toName },
      params: {
        firstName,
        breedLabel,
        genderLabel,
        styleLabels,
        styleLabelsJoined,
        names: topNames,
        portraitUrl: `${HOMEPAGE_URL}/upload`,
        homepageUrl: HOMEPAGE_URL,
        generatorUrl: `${HOMEPAGE_URL}/dog-name-generator`,
      },
    });

    await ctx.runMutation(internal.dogShortlists.markEmailSent, {
      id: shortlistId,
      at: Date.now(),
    });
  },
});

// Add the saved-shortlist's recipient to the "Name Generator Leads" Brevo
// list (id 3). Only scheduled if the user ticked the marketing-consent
// checkbox; we check the row again here as a defence-in-depth in case the
// scheduler was kicked off in error.
//
// Idempotent on contactSyncedAt — a retry after a successful sync is a
// no-op. Brevo's /contacts is itself idempotent (updates the existing
// contact, doesn't error on duplicate), so the worst case is one wasted
// API call per retry; the marker just makes it free.
export const addNameGeneratorContact = internalAction({
  args: { shortlistId: v.id("dogShortlists") },
  handler: async (ctx, { shortlistId }): Promise<void> => {
    const row = await ctx.runQuery(internal.dogShortlists.getInternal, {
      id: shortlistId,
    });
    if (!row) return;
    if (row.contactSyncedAt) return;
    if (row.marketingConsent !== true) {
      console.warn(
        `dogShortlist ${shortlistId} has no marketing consent — refusing to add to list`,
      );
      return;
    }

    // Recipient: same priority as the email send.
    let email: string | undefined = row.recipientEmail ?? undefined;
    let displayName: string | undefined = undefined;
    if (row.userId) {
      const user = await ctx.runQuery(internal.users.getInternal, {
        id: row.userId,
      });
      if (user?.email) email = user.email;
      if (user?.name) displayName = user.name;
    }
    if (!email) {
      console.warn(
        `dogShortlist ${shortlistId} has no recipient email — skipping contact sync`,
      );
      return;
    }

    // Useful attributes for Brevo segmentation. Brevo's contact attributes
    // are case-insensitive; we use upper-snake by convention so the
    // dashboard column names read naturally.
    const attributes: Record<string, unknown> = {
      SOURCE: "dog-name-generator",
    };
    if (displayName) {
      const first = firstNameOf(displayName);
      if (first) attributes.FIRSTNAME = first;
    }
    if (row.inputs.breed) attributes.DOG_BREED = row.inputs.breed;
    if (row.inputs.gender) attributes.DOG_GENDER = row.inputs.gender;
    if (row.inputs.styles.length > 0) {
      attributes.NAME_STYLES = row.inputs.styles.join(",");
    }

    const res = await fetch(`${BREVO_API}/contacts`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        email,
        attributes,
        listIds: [LISTS.nameGeneratorLeads],
        // updateEnabled: true → if the contact already exists in Brevo,
        // update its attributes / list membership instead of erroring out.
        // This is what makes the call idempotent on Brevo's side.
        updateEnabled: true,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Brevo contact sync failed (${res.status}): ${text}`);
    }

    await ctx.runMutation(internal.dogShortlists.markContactSynced, {
      id: shortlistId,
      at: Date.now(),
    });
  },
});

// Joins an array of strings into an Oxford-comma-ish "A, B and C" — small
// helper used by the shortlist email to format the chosen styles. Kept
// inline because it's only used in one place.
function joinHuman(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

// Welcome: fired once per new user from auth.ts createOrUpdateUser. Idempotent
// on `welcomeEmailSentAt` so a retried sign-up flow can't double-send.
export const sendWelcome = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<void> => {
    const user = await ctx.runQuery(internal.users.getInternal, { id: userId });
    if (!user) return;
    if (user.welcomeEmailSentAt) return;
    if (!user.email) {
      console.warn(`User ${userId} has no email — skipping welcome`);
      return;
    }

    await sendTemplate({
      templateId: TEMPLATES.welcome,
      to: { email: user.email, name: user.name },
      params: {
        firstName: firstNameOf(user.name) || "there",
        homepageUrl: HOMEPAGE_URL,
      },
    });

    await ctx.runMutation(internal.users.markWelcomeEmailSent, { id: userId });
  },
});

// Pulls tracking info + ETA off a Gelato order. Gelato exposes shipment
// info on the order detail endpoint under `shipment` (and per-item
// `fulfillments`). We try the order-level shipment first; fall back to
// the first item's fulfillment that has a tracking URL. ETA is taken
// from `shipment.minDeliveryDate` / `maxDeliveryDate` when present and
// returned as unix ms so the orders page can render it directly.
export const fetchGelatoTracking = internalAction({
  args: { gelatoOrderId: v.string() },
  handler: async (
    _ctx,
    { gelatoOrderId },
  ): Promise<{
    tracking: { url: string; carrier?: string; code?: string } | null;
    etaMinAt?: number;
    etaMaxAt?: number;
  } | null> => {
    const key = process.env.GELATO_API_KEY;
    if (!key) return null;
    const res = await fetch(
      `https://order.gelatoapis.com/v4/orders/${encodeURIComponent(gelatoOrderId)}`,
      { headers: { "X-API-KEY": key } },
    );
    if (!res.ok) {
      console.warn(`Gelato order fetch failed: ${res.status}`);
      return null;
    }
    const body = (await res.json()) as {
      shipment?: {
        trackingUrl?: string;
        trackingCode?: string;
        shipmentMethodName?: string;
        minDeliveryDate?: string;
        maxDeliveryDate?: string;
      };
      items?: Array<{
        fulfillments?: Array<{
          trackingUrl?: string;
          trackingCode?: string;
          shipmentMethodName?: string;
        }>;
      }>;
    };

    const parseDate = (s: string | undefined): number | undefined => {
      if (!s) return undefined;
      const t = Date.parse(s);
      return Number.isFinite(t) ? t : undefined;
    };
    const etaMinAt = parseDate(body.shipment?.minDeliveryDate);
    const etaMaxAt = parseDate(body.shipment?.maxDeliveryDate);

    let tracking: { url: string; code?: string; carrier?: string } | null = null;
    if (body.shipment?.trackingUrl) {
      tracking = {
        url: body.shipment.trackingUrl,
        code: body.shipment.trackingCode,
        carrier: body.shipment.shipmentMethodName,
      };
    } else {
      for (const item of body.items ?? []) {
        for (const f of item.fulfillments ?? []) {
          if (f.trackingUrl) {
            tracking = {
              url: f.trackingUrl,
              code: f.trackingCode,
              carrier: f.shipmentMethodName,
            };
            break;
          }
        }
        if (tracking) break;
      }
    }

    return { tracking, etaMinAt, etaMaxAt };
  },
});
