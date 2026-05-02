"use node";

import sharp from "sharp";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ALL_STYLES, type Style } from "./styleScoring";

// Nano Banana (Gemini 2.5 Flash Image) — image-editing mode. Takes 1+ reference
// images + a prompt and returns a new styled image while preserving identity.
const FAL_URL = "https://fal.run/fal-ai/nano-banana/edit";

// Aura SR — fast 4× super-resolution upscaler. Nano Banana outputs around
// 1024px on the long edge; a 4× upscale takes us to ~4096px, which is enough
// for ~13" at 300 DPI or ~27" at 150 DPI (Gelato's minimum for art prints).
// Cheaper than clarity-upscaler at roughly $0.02 vs $0.04 per image.
const UPSCALE_URL = "https://fal.run/fal-ai/aura-sr";
const UPSCALE_FACTOR = 4;

// ----- Prompt construction --------------------------------------------------
// We send the same set of pet photos to N parallel calls, varying only the
// prompt. Each prompt is hand-tuned to give Nano Banana a clear stylistic
// brief while explicitly telling it to preserve the pet's identity.

const STYLE_PROMPTS: Record<Style, string> = {
  oil:
    "Render the scene as a masterful classical oil painting in the style of 19th-century European portraiture. Rich layered brushstrokes with visible texture, warm chiaroscuro lighting, deep shadows, museum-quality finish. Soft painterly neutral background tones (deep umber to ochre) where the scene allows. Elegant and timeless.",
  watercolour:
    "Render the scene as a delicate watercolour painting. Soft translucent washes of pigment, subtle paper texture, gentle blooms where colors bleed at the edges, light pastel palette with airy negative space. Loose impressionistic brushwork while keeping the pet's features precise. Light cream paper background.",
  pop:
    "Render the scene as a bold Andy Warhol-style pop art print. Vibrant flat blocks of saturated color, high-contrast outlines, retro silkscreen aesthetic, halftone dot patterns, two or three colour palette. Graphic and punchy.",
  sketch:
    "Render the scene as a hand-drawn pencil and charcoal sketch with a timeless monochrome feel. Fine graphite linework, layered crosshatching for tonal shading, soft smudged charcoal in the shadows, subtle paper grain visible throughout. Detailed naturalistic drawing on warm off-white paper, no colour beyond a faint sepia cast. Refined, classical, hand-crafted.",
  impressionist:
    "Render the scene as a Monet-style impressionist painting. Soft broken brushwork in dabs and short strokes, dreamy diffused natural light, harmonious dappled colour palette of muted pastels, less defined edges where forms melt into background. Painterly atmosphere with visible canvas texture, romantic and luminous.",
  ukiyo:
    "Render the scene as a Japanese woodblock print in the Ukiyo-e tradition (think Hokusai or Hiroshige). Bold confident black outlines, flat areas of solid colour with no gradients, limited refined palette of indigo, vermillion, ochre and ink black, decorative patterning, subtle paper texture. Graphic, elegant, and balanced.",
  renaissance:
    "Render the scene as a formal Renaissance royal portrait in the manner of the Old Masters. Ornate background with deep velvet drapery, gold filigree detailing and a heraldic motif, classical sidelight chiaroscuro illuminating the subject, rich earthy palette of crimson, gold and umber. Very regal, dignified, museum-quality oil-on-canvas finish.",
  comic:
    "Render the scene in a modern comic book / graphic novel style. Bold inked black outlines of varying weight, cel-shaded vibrant flat colour with crisp shadow shapes, dynamic energetic feel, subtle halftone dot shading, action-focused composition. High contrast and punchy without being silly.",
  geometric:
    "Render the scene in a low-poly geometric style. Form built from angular faceted triangular planes, clean flat-shaded surfaces with subtle gradients between facets, modern and striking modern graphic aesthetic, considered colour palette. Crisp vector-like edges, contemporary and decorative.",
  botanical:
    "Render the scene as a vintage botanical illustration in the style of 19th-century Victorian scientific plates. Fine ink linework with delicate stippling and crosshatching, muted earthy watercolour washes (sepia, sage, dusty rose, ochre), refined and naturalistic, on aged cream paper with subtle foxing. Elegant, scholarly, and timeless.",
};

// What the pet is actually doing in the portrait — driven by Q1 of the quiz.
const ACTIVITY_PROMPTS: Record<string, string> = {
  regal:
    "The pet is sitting upright in a regal, dignified pose, wearing a small ornamental gold crown perched lightly atop their head, like noble portraiture. Centred head-and-shoulders composition.",
  playing:
    "The pet is captured mid-action playing energetically with a colourful toy or ball, tail in motion, joyful expression. Dynamic full-body composition.",
  napping:
    "The pet is curled up peacefully asleep on a soft cushion or blanket, eyes gently closed, paws tucked in. Cosy intimate composition.",
  adventuring:
    "The pet is shown outdoors on an adventure, perched proudly atop a hill or rocky outcrop with mountains, trees, or open sky in the background. Heroic full-body composition.",
};

const MOOD_HINT: Record<string, string> = {
  calm: "The pet's expression should feel peaceful and content.",
  playful: "The pet's expression should feel bright and joyful.",
  regal: "The pet should look noble and dignified.",
  quirky: "The pet should look charming with a hint of whimsy.",
};

const IDENTITY_GUARD =
  "Crucially, preserve the exact likeness of the pet shown in the reference photos — same breed, fur colour, markings, eye colour, ear shape, and overall proportions. Only change the artistic style, never the pet itself. The output MUST be in 3:4 portrait orientation (taller than wide), matching the aspect ratio of the reference photos exactly — do not crop, letterbox, or change the framing.";

function buildPrompt(style: Style, activity?: string, mood?: string): string {
  const stylePart = STYLE_PROMPTS[style];
  // Activity (what the pet is doing) leads — it sets the scene. Style then
  // dictates how that scene is rendered. Mood adds emotional flavour.
  const activityPart = activity ? ` ${ACTIVITY_PROMPTS[activity] ?? ""}` : "";
  const moodPart = mood ? ` ${MOOD_HINT[mood] ?? ""}` : "";
  return `${stylePart}${activityPart}${moodPart} ${IDENTITY_GUARD}`;
}

// ----- fal API call --------------------------------------------------------

async function callNanoBanana(
  prompt: string,
  imageUrls: string[],
): Promise<string> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY not configured");

  const res = await fetch(FAL_URL, {
    method: "POST",
    headers: {
      "Authorization": `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_urls: imageUrls,
      num_images: 1,
      output_format: "jpeg",
      aspect_ratio: "3:4",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fal ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = (await res.json()) as { images?: Array<{ url: string }> };
  const url = data.images?.[0]?.url;
  if (!url) throw new Error(`fal returned no image: ${JSON.stringify(data).slice(0, 300)}`);
  return url;
}

// Upscales a fal-hosted image URL using clarity-upscaler. We swallow errors
// here and let the caller fall back to the source URL — print-quality is a
// nice-to-have, but a missing portrait would ruin the experience.
async function upscale(imageUrl: string): Promise<string | null> {
  const key = process.env.FAL_KEY;
  if (!key) return null;
  try {
    const res = await fetch(UPSCALE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: imageUrl,
        upscaling_factor: UPSCALE_FACTOR,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn(`Upscaler ${res.status}: ${text.slice(0, 300)}`);
      return null;
    }
    const data = (await res.json()) as { image?: { url?: string } };
    return data.image?.url ?? null;
  } catch (err) {
    console.warn("Upscaler error:", err);
    return null;
  }
}

// fal.media URLs are temporary (typically ~24h), which means the gallery,
// the cart's printFileUrl, and digital downloads on the success page all
// silently rot once fal expires the file. Persisting the bytes into Convex
// storage gives us a permanent, CDN-backed URL we control.
async function persistToConvexStorage(ctx: any, url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`persistToConvexStorage: fetch failed ${res.status} for ${url}`);
      return url;
    }
    const blob = await res.blob();
    const storageId = await ctx.storage.store(blob);
    const persisted = await ctx.storage.getUrl(storageId);
    return persisted ?? url;
  } catch (err) {
    console.warn("persistToConvexStorage failed:", err);
    return url;
  }
}

// Belt-and-braces aspect enforcement. We pass aspect_ratio: "3:4" to fal,
// but the model can still drift on occasion — when it does, the off-aspect
// image leaks all the way to the print product where Gelato will reject it
// or crop unpredictably. Center-cropping to exactly 3:4 server-side
// guarantees every persisted image matches the product geometry.
//
// Tolerance allows ±1% slop (e.g. 1024×1365 vs the exact 1024×1365.33),
// so we don't burn a re-encode on rounding noise.
const TARGET_ASPECT = 3 / 4; // width / height
const ASPECT_TOLERANCE = 0.01;

async function enforce3by4AndStore(ctx: any, url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`enforce3by4AndStore: fetch failed ${res.status} for ${url}`);
      return url;
    }
    const inputBytes = Buffer.from(await res.arrayBuffer());

    let outBytes: Buffer = inputBytes;
    let contentType = res.headers.get("content-type") ?? "image/jpeg";
    try {
      const img = sharp(inputBytes);
      const meta = await img.metadata();
      const w = meta.width;
      const h = meta.height;
      if (w && h) {
        const actual = w / h;
        if (Math.abs(actual - TARGET_ASPECT) > TARGET_ASPECT * ASPECT_TOLERANCE) {
          // Off-aspect: center-crop to exactly 3:4.
          let cropW: number, cropH: number;
          if (actual > TARGET_ASPECT) {
            // Too wide — keep height, narrow width.
            cropH = h;
            cropW = Math.round(h * TARGET_ASPECT);
          } else {
            // Too tall — keep width, shorten height.
            cropW = w;
            cropH = Math.round(w / TARGET_ASPECT);
          }
          const left = Math.floor((w - cropW) / 2);
          const top = Math.floor((h - cropH) / 2);
          outBytes = await img
            .extract({ left, top, width: cropW, height: cropH })
            .jpeg({ quality: 92 })
            .toBuffer();
          contentType = "image/jpeg";
          console.warn(
            `enforce3by4AndStore: cropped ${w}x${h} (${actual.toFixed(3)}) → ${cropW}x${cropH}`,
          );
        }
      }
    } catch (err) {
      // sharp parsing failure — store the original rather than blanking the result.
      console.warn("enforce3by4AndStore: sharp failed, storing raw:", err);
    }

    const blob = new Blob([new Uint8Array(outBytes)], { type: contentType });
    const storageId = await ctx.storage.store(blob);
    const persisted = await ctx.storage.getUrl(storageId);
    return persisted ?? url;
  } catch (err) {
    console.warn("enforce3by4AndStore failed:", err);
    return url;
  }
}

// Single-step pipeline: Nano Banana for the artistic transformation. We
// persist the ~1024px result to Convex storage and use it as both the
// display URL and the (placeholder) print URL. The 4× upscale is deferred
// to order-completion time — see `upscaleAndFulfil` below — so we don't
// burn Convex storage on the ~90% of generations that never get bought.
async function generateOnePortrait(
  ctx: any,
  prompt: string,
  imageUrls: string[],
): Promise<{ imageUrl: string; printFileUrl: string }> {
  const lowRes = await callNanoBanana(prompt, imageUrls);
  const display = await enforce3by4AndStore(ctx, lowRes);
  return { imageUrl: display, printFileUrl: display };
}

// Upscale + persist a single low-res URL. Used by `upscaleAndFulfil` at order
// completion. Falls back to the input URL if upscaling fails so we never
// block fulfilment on a transient fal failure.
async function upscaleAndPersist(ctx: any, lowResUrl: string): Promise<string> {
  const hi = await upscale(lowResUrl);
  if (!hi) return lowResUrl;
  return await persistToConvexStorage(ctx, hi);
}

// ----- Generation orchestration --------------------------------------------

async function generateAllStyles(
  ctx: any,
  sessionId: any,
  styles: Style[],
): Promise<{ style: Style; imageUrl: string; printFileUrl: string }[]> {
  const session = await ctx.runQuery(internal.sessions.getInternal, { id: sessionId });
  if (!session) throw new Error("Session not found");
  const photos = session.petPhotoUrls ?? [];
  if (photos.length === 0) throw new Error("No pet photos uploaded");

  const activity = session.quizAnswers?.activity;
  const mood = session.quizAnswers?.mood;

  // Fire chosen styles in parallel. If one fails we keep the rest;
  // returning a partial gallery is better than blanking the screen.
  const results = await Promise.allSettled(
    styles.map((style) =>
      generateOnePortrait(ctx, buildPrompt(style, activity, mood), photos).then(
        (urls) => ({ style, ...urls }),
      ),
    ),
  );

  const generations: { style: Style; imageUrl: string; printFileUrl: string }[] = [];
  const errors: string[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") generations.push(r.value);
    else errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
  }
  if (errors.length > 0) console.warn("Some styles failed:", errors);
  if (generations.length === 0) throw new Error(errors[0] ?? "All generations failed");
  return generations;
}

// Validate caller-supplied style keys against the canonical list and dedupe.
// Returns at most 3 valid styles, in the order given.
function resolveSelectedStyles(input: string[] | undefined, fallback: Style[]): Style[] {
  const allow = new Set<string>(ALL_STYLES);
  const seen = new Set<string>();
  const valid: Style[] = [];
  for (const s of input ?? []) {
    if (allow.has(s) && !seen.has(s)) {
      seen.add(s);
      valid.push(s as Style);
    }
    if (valid.length === 3) break;
  }
  if (valid.length === 3) return valid;
  // Backfill from the fallback (top-ranked) so we always generate exactly 3.
  for (const s of fallback) {
    if (!seen.has(s)) {
      seen.add(s);
      valid.push(s);
      if (valid.length === 3) break;
    }
  }
  return valid;
}

export const generatePortraits = action({
  args: {
    sessionId: v.id("sessions"),
    styles: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { sessionId, styles }): Promise<{ count: number }> => {
    // Require auth — the gate is on /sign-up before the user gets here.
    // Defense in depth in case someone hits the action directly.
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    // Stamp the session with the user (idempotent). This handles the
    // sign-up→generate transition without a separate round trip from the
    // frontend.
    await ctx.runMutation(internal.sessions.linkSessionToUserInternal, {
      sessionId,
      userId,
    });
    // Consume a regen up-front; refund if the AI call fails. This is the
    // serializable way to enforce a 3-per-user budget — checking and
    // decrementing in the same mutation prevents a double-tap from
    // generating two sets when the user only has one regen left.
    const remainingAfter = await ctx.runMutation(internal.sessions.consumeRegen, { userId });

    await ctx.runMutation(internal.sessions.setGenerationStatus, {
      id: sessionId,
      status: "generating",
      error: undefined,
    });
    try {
      const session = await ctx.runQuery(internal.sessions.getInternal, { id: sessionId });
      const ranked = (session?.rankedStyles ?? []) as Style[];
      const chosen = resolveSelectedStyles(styles, ranked);
      const generations = await generateAllStyles(ctx, sessionId, chosen);
      await ctx.runMutation(internal.sessions.setGenerations, {
        id: sessionId,
        generations,
      });
      // Persist to the session-scoped gallery so users can revisit results
      // even after starting a new flow.
      await ctx.runMutation(internal.sessions.appendGalleryItems, {
        id: sessionId,
        items: generations.map((g) => ({
          style: g.style,
          imageUrl: g.imageUrl,
          printFileUrl: g.printFileUrl,
          activity: session?.quizAnswers?.activity,
          mood: session?.quizAnswers?.mood,
          petName: session?.quizAnswers?.name,
        })),
      });
      // Once the user has no regens left, the source photos can't be used
      // again — free the Convex storage they're occupying.
      if (remainingAfter === 0) {
        await ctx.runMutation(internal.sessions.deletePetPhotos, { id: sessionId });
      }
      return { count: generations.length };
    } catch (err) {
      // Refund the regen we charged — the user got nothing.
      await ctx.runMutation(internal.sessions.refundRegen, { userId });
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.sessions.setGenerationStatus, {
        id: sessionId,
        status: "failed",
        error: message,
      });
      throw err;
    }
  },
});

export const regenerate = action({
  args: {
    sessionId: v.id("sessions"),
    styles: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { sessionId, styles }): Promise<{ count: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.runQuery(internal.sessions.getInternal, { id: sessionId });
    if (!session) throw new Error("Session not found");

    await ctx.runMutation(internal.sessions.linkSessionToUserInternal, {
      sessionId,
      userId,
    });
    // Consume up-front; refund on failure. Throws OUT_OF_REGENS if the user
    // has no budget left.
    const remainingAfter = await ctx.runMutation(internal.sessions.consumeRegen, { userId });

    await ctx.runMutation(internal.sessions.setGenerationStatus, {
      id: sessionId,
      status: "generating",
    });
    try {
      // Re-paint the same styles the user just saw, unless caller overrides.
      const fallback = (session.generations?.map((g) => g.style) ?? []) as Style[];
      const ranked = (session.rankedStyles ?? []) as Style[];
      const chosen = resolveSelectedStyles(
        styles ?? fallback,
        ranked,
      );
      const generations = await generateAllStyles(ctx, sessionId, chosen);
      await ctx.runMutation(internal.sessions.setGenerations, {
        id: sessionId,
        generations,
      });
      // Persist to the session-scoped gallery so users can revisit results
      // even after starting a new flow.
      await ctx.runMutation(internal.sessions.appendGalleryItems, {
        id: sessionId,
        items: generations.map((g) => ({
          style: g.style,
          imageUrl: g.imageUrl,
          printFileUrl: g.printFileUrl,
          activity: session?.quizAnswers?.activity,
          mood: session?.quizAnswers?.mood,
          petName: session?.quizAnswers?.name,
        })),
      });
      // Once the user has no regens left, the source photos can't be used
      // again — free the Convex storage they're occupying.
      if (remainingAfter === 0) {
        await ctx.runMutation(internal.sessions.deletePetPhotos, { id: sessionId });
      }
      return { count: generations.length };
    } catch (err) {
      await ctx.runMutation(internal.sessions.refundRegen, { userId });
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.sessions.setGenerationStatus, {
        id: sessionId,
        status: "failed",
        error: message,
      });
      throw err;
    }
  },
});

// ----- Order-time upscale + fulfilment -------------------------------------
// Triggered from the Stripe webhook once payment has settled. Walks the
// order's lineItems, upscales each unique source image to ~4096px, persists
// the high-res file to Convex storage, and patches the order so that the
// confirmation email and Gelato dispatch both pull from the upscaled URL.
//
// Done here (not at generation time) so we only pay storage + fal costs on
// images that actually convert to a purchase. The previous flow upscaled
// 3× per session up front — most sessions never bought, so the bytes were
// wasted.
//
// Idempotent on `printFileHiResUpscaledAt`: a duplicate Stripe webhook will
// noop the upscale and just re-fire the (also-idempotent) email + Gelato.
export const upscaleAndFulfil = internalAction({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }): Promise<void> => {
    const order = await ctx.runQuery(internal.orders.getInternal, { id: orderId });
    if (!order) return;

    if (!order.printFileHiResUpscaledAt) {
      const lines = order.lineItems ?? [];
      if (lines.length > 0) {
        // Cart lines that share a source image (e.g. the same portrait sold
        // as both a print and a digital) are deduped so we upscale once.
        const cache = new Map<string, string>();
        const updated: typeof lines = [];
        for (const line of lines) {
          let hi = cache.get(line.printFileUrl);
          if (!hi) {
            hi = await upscaleAndPersist(ctx, line.printFileUrl);
            cache.set(line.printFileUrl, hi);
          }
          updated.push({ ...line, printFileUrl: hi });
        }
        await ctx.runMutation(internal.orders.setUpscaledLineItems, {
          id: orderId,
          lineItems: updated,
        });
      } else if (order.printFileUrl) {
        // Legacy single-product order shape.
        const hi = await upscaleAndPersist(ctx, order.printFileUrl);
        await ctx.runMutation(internal.orders.setUpscaledLegacyPrintUrl, {
          id: orderId,
          printFileUrl: hi,
        });
      }
    }

    // Confirmation email reads the order's lineItems; with the upscale done
    // above, digital download links now point at the high-res file.
    await ctx.scheduler.runAfter(0, internal.brevo.sendOrderConfirmation, {
      orderId,
    });

    const hasPhysical = await ctx.runQuery(internal.orders.hasPhysicalLines, {
      id: orderId,
    });
    if (hasPhysical) {
      await ctx.scheduler.runAfter(0, internal.gelato.fulfillConvexOrder, {
        orderId,
      });
    } else {
      await ctx.runMutation(internal.orders.setStatus, {
        id: orderId,
        status: "fulfilled",
      });
    }
  },
});

// Smoke test for the fal connection. Confirms the key works without spending
// much money — generates one tiny image with no reference.
export const ping = action({
  args: {},
  handler: async (): Promise<{ ok: boolean }> => {
    const url = await callNanoBanana(
      "A tiny abstract test pattern, low detail",
      ["https://lovely-warthog-649.convex.cloud/api/storage/33280e0d-91dd-41b8-a083-cefc56eeeeda"],
    );
    return { ok: !!url };
  },
});
