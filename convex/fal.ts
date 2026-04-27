"use node";

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Nano Banana (Gemini 2.5 Flash Image) — image-editing mode. Takes 1+ reference
// images + a prompt and returns a new styled image while preserving identity.
const FAL_URL = "https://fal.run/fal-ai/nano-banana/edit";

// Aura SR — fast 4× super-resolution upscaler. Nano Banana outputs around
// 1024px on the long edge; a 4× upscale takes us to ~4096px, which is enough
// for ~13" at 300 DPI or ~27" at 150 DPI (Gelato's minimum for art prints).
// Cheaper than clarity-upscaler at roughly $0.02 vs $0.04 per image.
const UPSCALE_URL = "https://fal.run/fal-ai/aura-sr";
const UPSCALE_FACTOR = 4;

const STYLES = ["oil", "watercolour", "pop"] as const;
type Style = (typeof STYLES)[number];

// ----- Prompt construction --------------------------------------------------
// We send the same set of pet photos to four parallel calls, varying only the
// prompt. Each prompt is hand-tuned to give Nano Banana a clear stylistic
// brief while explicitly telling it to preserve the pet's identity.

const STYLE_PROMPTS: Record<Style, string> = {
  oil:
    "Render the scene as a masterful classical oil painting in the style of 19th-century European portraiture. Rich layered brushstrokes with visible texture, warm chiaroscuro lighting, deep shadows, museum-quality finish. Soft painterly neutral background tones (deep umber to ochre) where the scene allows. Elegant and timeless.",
  watercolour:
    "Render the scene as a delicate watercolour painting. Soft translucent washes of pigment, subtle paper texture, gentle blooms where colors bleed at the edges, light pastel palette with airy negative space. Loose impressionistic brushwork while keeping the pet's features precise. Light cream paper background.",
  pop:
    "Render the scene as a bold Andy Warhol-style pop art print. Vibrant flat blocks of saturated color, high-contrast outlines, retro silkscreen aesthetic, halftone dot patterns, two or three colour palette. Graphic and punchy.",
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
  "Crucially, preserve the exact likeness of the pet shown in the reference photos — same breed, fur colour, markings, eye colour, ear shape, and overall proportions. Only change the artistic style, never the pet itself. Output the pet in portrait orientation.";

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

// Two-step pipeline: Nano Banana for the artistic transformation, then a
// clarity upscale so the print file is high-DPI. Failures in step 2 fall
// back to the lower-res source so the user still gets a portrait.
async function generateOnePortrait(
  prompt: string,
  imageUrls: string[],
): Promise<string> {
  const lowRes = await callNanoBanana(prompt, imageUrls);
  const hiRes = await upscale(lowRes);
  return hiRes ?? lowRes;
}

// ----- Generation orchestration --------------------------------------------

async function generateAllStyles(
  ctx: any,
  sessionId: any,
): Promise<{ style: Style; imageUrl: string }[]> {
  const session = await ctx.runQuery(internal.sessions.getInternal, { id: sessionId });
  if (!session) throw new Error("Session not found");
  const photos = session.petPhotoUrls ?? [];
  if (photos.length === 0) throw new Error("No pet photos uploaded");

  const activity = session.quizAnswers?.activity;
  const mood = session.quizAnswers?.mood;

  // Fire all four styles in parallel. If one fails we keep the rest;
  // returning a partial gallery is better than blanking the screen.
  const results = await Promise.allSettled(
    STYLES.map((style) =>
      generateOnePortrait(buildPrompt(style, activity, mood), photos).then(
        (url) => ({ style, imageUrl: url }),
      ),
    ),
  );

  const generations: { style: Style; imageUrl: string }[] = [];
  const errors: string[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") generations.push(r.value);
    else errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
  }
  if (errors.length > 0) console.warn("Some styles failed:", errors);
  if (generations.length === 0) throw new Error(errors[0] ?? "All generations failed");
  return generations;
}

export const generatePortraits = action({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }): Promise<{ count: number }> => {
    await ctx.runMutation(internal.sessions.setGenerationStatus, {
      id: sessionId,
      status: "generating",
      error: undefined,
    });
    try {
      const generations = await generateAllStyles(ctx, sessionId);
      await ctx.runMutation(internal.sessions.setGenerations, {
        id: sessionId,
        generations,
      });
      // Persist to the session-scoped gallery so users can revisit results
      // even after starting a new flow.
      const session = await ctx.runQuery(internal.sessions.getInternal, { id: sessionId });
      await ctx.runMutation(internal.sessions.appendGalleryItems, {
        id: sessionId,
        items: generations.map((g) => ({
          style: g.style,
          imageUrl: g.imageUrl,
          activity: session?.quizAnswers?.activity,
          mood: session?.quizAnswers?.mood,
        })),
      });
      return { count: generations.length };
    } catch (err) {
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
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }): Promise<{ count: number }> => {
    const session = await ctx.runQuery(internal.sessions.getInternal, { id: sessionId });
    if (!session) throw new Error("Session not found");
    if (session.regensRemaining <= 0) throw new Error("No regens left");

    await ctx.runMutation(internal.sessions.setGenerationStatus, {
      id: sessionId,
      status: "generating",
    });
    try {
      const generations = await generateAllStyles(ctx, sessionId);
      await ctx.runMutation(internal.sessions.setGenerations, {
        id: sessionId,
        generations,
      });
      // Persist to the session-scoped gallery so users can revisit results
      // even after starting a new flow.
      const session = await ctx.runQuery(internal.sessions.getInternal, { id: sessionId });
      await ctx.runMutation(internal.sessions.appendGalleryItems, {
        id: sessionId,
        items: generations.map((g) => ({
          style: g.style,
          imageUrl: g.imageUrl,
          activity: session?.quizAnswers?.activity,
          mood: session?.quizAnswers?.mood,
        })),
      });
      await ctx.runMutation(internal.sessions.decrementRegens, { id: sessionId });
      return { count: generations.length };
    } catch (err) {
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
