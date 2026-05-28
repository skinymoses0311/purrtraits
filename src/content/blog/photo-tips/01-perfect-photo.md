---
# ── Identity / SEO ──────────────────────────────────────────────
title: "How to Take the Perfect Photo of Your Dog for a Portrait"
slug: how-to-photograph-your-dog-for-a-portrait
category: photo-tips
issue: "TBC"
author: Naia Croft
publishDate: "TBC"
metaTitle: "How to Photograph Your Dog for a Portrait | Purrtraits"
metaDescription: "The five fundamentals of a great reference photo for an AI pet portrait — light, height, background, framing and focus. Ten minutes, any phone."
primaryKeyword: "how to photograph your dog for a portrait"
secondaryKeywords:
  - "reference photo for a pet portrait"
  - "best photo for a dog portrait"
  - "dog photography tips for portraits"
wordCount: 1090

# ── Spec-table (monospace metadata block under H1) ──────────────
specTable:
  - { label: "DIFFICULTY", value: "BEGINNER" }
  - { label: "TIME NEEDED", value: "10 MIN" }
  - { label: "GEAR", value: "ANY SMARTPHONE" }
  - { label: "BEST LIGHT", value: "DAYLIGHT, INDIRECT" }
  - { label: "FILED UNDER", value: "FUNDAMENTALS" }

# ── Stats panel (in "Why this matters") ─────────────────────────
stats:
  - { value: "5", label: "fundamentals that decide every portrait" }
  - { value: "1", label: "great reference photo is the whole brief" }
  - { value: "60s", label: "from upload to a finished portrait" }

# ── Image manifest ──────────────────────────────────────────────
# `depicts` is the generation brief for the fal.ai image step.
# Recurring cast: this post uses HOUSE DOG A — a tan, short-coated
# Labrador-type dog, mid-size. Reuse the same dog for all pairs.
images:
  hero:
    id: "01-hero"
    file: "src/assets/blog/how-to-photograph-your-dog-for-a-portrait/01-hero.jpg"
    file2x: "src/assets/blog/how-to-photograph-your-dog-for-a-portrait/01-hero@2x.jpg"
    slot: hero
    size: "1600x900"
    aspect: "16:9"
    badge: "FIG. 00 · REFERENCE SHOT IN PROGRESS · WINDOW LIGHT"
    alt: "A person crouching to photograph their dog by a window in daylight"
    depicts: "Behind-the-scenes photo: a person kneeling on the floor of a bright, simply furnished living room, holding up a smartphone to photograph a tan short-coated Labrador-type dog sitting calmly beside a large window in soft daylight. Candid, warm, realistic."
  pairs:
    - step: "01"
      good:
        id: "01-01-good"
        file: "src/assets/blog/how-to-photograph-your-dog-for-a-portrait/01-01-good.jpg"
        file2x: "src/assets/blog/how-to-photograph-your-dog-for-a-portrait/01-01-good@2x.jpg"
        size: "800x1000"
        aspect: "4:5"
        caption: "WINDOW LIGHT · OVERCAST · 1M FROM GLASS"
        status: PASS
        alt: "Tan dog lit by soft window light, eyes bright and in focus"
        depicts: "HOUSE DOG A (tan short-coated Labrador-type, mid-size) sitting calmly about one metre from a large window in soft overcast daylight from the side, photographed at the dog's eye level, sharp focus, bright catchlights in both eyes, plain pale wall behind. Realistic smartphone photo."
        pins:
          - { n: 1, x: 50, y: 34, note: "Catchlight in both eyes" }
          - { n: 2, x: 36, y: 64, note: "Soft, even light across the face" }
      bad:
        id: "01-01-bad"
        file: "src/assets/blog/how-to-photograph-your-dog-for-a-portrait/01-01-bad.jpg"
        file2x: "src/assets/blog/how-to-photograph-your-dog-for-a-portrait/01-01-bad@2x.jpg"
        size: "800x1000"
        aspect: "4:5"
        caption: "CEILING LAMP · 9PM · OVERHEAD"
        status: FAIL
        alt: "Tan dog under a yellow ceiling light, eyes lost in shadow"
        depicts: "HOUSE DOG A indoors at night lit only by a warm yellow ceiling light directly overhead. Strong orange colour cast, eyes sunk in shadow, slightly dim and flat. Realistic smartphone photo."
        pins:
          - { n: 1, x: 52, y: 30, note: "Hard yellow colour cast" }
          - { n: 2, x: 48, y: 42, note: "Eyes fall into shadow" }
    - step: "03"
      good:
        id: "01-03-good"
        file: "src/assets/blog/how-to-photograph-your-dog-for-a-portrait/01-03-good.jpg"
        file2x: "src/assets/blog/how-to-photograph-your-dog-for-a-portrait/01-03-good@2x.jpg"
        size: "800x1000"
        aspect: "4:5"
        caption: "PLAIN WALL · UNCLUTTERED"
        status: PASS
        alt: "Tan dog against a plain pale wall, nothing else in frame"
        depicts: "HOUSE DOG A sitting in front of a plain, pale, uncluttered wall, soft daylight, photographed at eye level, nothing else in the frame. Realistic smartphone photo."
        pins:
          - { n: 1, x: 78, y: 30, note: "Nothing competing behind the dog" }
      bad:
        id: "01-03-bad"
        file: "src/assets/blog/how-to-photograph-your-dog-for-a-portrait/01-03-bad.jpg"
        file2x: "src/assets/blog/how-to-photograph-your-dog-for-a-portrait/01-03-bad@2x.jpg"
        size: "800x1000"
        aspect: "4:5"
        caption: "PATTERNED RUG · PLANT BEHIND HEAD"
        status: FAIL
        alt: "Tan dog in a cluttered room with a plant behind its head"
        depicts: "HOUSE DOG A sitting in a cluttered living room, a leafy houseplant directly behind its head and a busy patterned rug filling the background. Realistic smartphone photo."
        pins:
          - { n: 1, x: 64, y: 22, note: "Plant appears to grow from the ear" }
          - { n: 2, x: 40, y: 80, note: "Rug pattern fights the coat" }
    - step: "05"
      good:
        id: "01-05-good"
        file: "src/assets/blog/how-to-photograph-your-dog-for-a-portrait/01-05-good.jpg"
        file2x: "src/assets/blog/how-to-photograph-your-dog-for-a-portrait/01-05-good@2x.jpg"
        size: "800x1000"
        aspect: "4:5"
        caption: "EYE CONTACT · BOTH HANDS · SHARP"
        status: PASS
        alt: "Tan dog alert and sharp, looking at the camera"
        depicts: "HOUSE DOG A alert and perfectly still, ears up, looking directly into the camera lens, razor-sharp focus on the eyes, soft daylight. Realistic smartphone photo."
        pins:
          - { n: 1, x: 50, y: 36, note: "Eyes sharp and on the lens" }
          - { n: 2, x: 50, y: 16, note: "Ears up — alert" }
      bad:
        id: "01-05-bad"
        file: "src/assets/blog/how-to-photograph-your-dog-for-a-portrait/01-05-bad.jpg"
        file2x: "src/assets/blog/how-to-photograph-your-dog-for-a-portrait/01-05-bad@2x.jpg"
        size: "800x1000"
        aspect: "4:5"
        caption: "MID-TURN · ONE HAND · MOTION BLUR"
        status: FAIL
        alt: "Tan dog mid-movement, muzzle blurred, looking away"
        depicts: "HOUSE DOG A caught mid-movement turning its head away from the camera, clear motion blur across the muzzle, gaze off to one side. Realistic smartphone photo."
        pins:
          - { n: 1, x: 44, y: 52, note: "Motion blur across the muzzle" }
          - { n: 2, x: 70, y: 38, note: "Gaze off-camera — no contact" }
  # Common-mistakes thumbnails (1:1) — crop/reuse the FAIL frames above,
  # no fresh generation needed.
  commonMistakeThumbs:
    - { id: "01-cm-1", source: "01-01-bad", crop: "1:1", file: "src/assets/blog/how-to-photograph-your-dog-for-a-portrait/01-cm-1.jpg", file2x: "src/assets/blog/how-to-photograph-your-dog-for-a-portrait/01-cm-1@2x.jpg" }
    - { id: "01-cm-2", source: "01-hero",   crop: "1:1", note: "crop to show high shooting angle", file: "src/assets/blog/how-to-photograph-your-dog-for-a-portrait/01-cm-2.jpg", file2x: "src/assets/blog/how-to-photograph-your-dog-for-a-portrait/01-cm-2@2x.jpg" }
    - { id: "01-cm-3", source: "01-03-bad", crop: "1:1", file: "src/assets/blog/how-to-photograph-your-dog-for-a-portrait/01-cm-3.jpg", file2x: "src/assets/blog/how-to-photograph-your-dog-for-a-portrait/01-cm-3@2x.jpg" }
    - { id: "01-cm-4", source: "01-05-bad", crop: "1:1", file: "src/assets/blog/how-to-photograph-your-dog-for-a-portrait/01-cm-4.jpg", file2x: "src/assets/blog/how-to-photograph-your-dog-for-a-portrait/01-cm-4@2x.jpg" }
# ── Diagrams (SVG kit — no generation) ──────────────────────────
diagrams:
  - step: "02"
    archetype: camera-height
    label: "Fig. 02 — Lens height. Standing fails, kneeling passes, eye level is right."
  - step: "04"
    archetype: distance
    label: "Fig. 04 — Framing distance. The safe zone: head and chest with a margin on every side."

# ── Related posts ───────────────────────────────────────────────
related:
  - { type: photo-tips, slug: "the-5-photo-mistakes-that-wreck-a-portrait", title: "The 5 Photo Mistakes That Wreck a Portrait" }
  - { type: photo-tips, slug: "why-natural-light-is-everything", title: "Why Natural Light Is Everything" }
  - { type: breed, slug: "labrador-retriever", title: "Labrador Retriever Portraits" }
---

A Purrtraits portrait is only ever as good as the photo you start it with. The artwork is generated from your reference photo, so everything the finished piece gets right, your photo got right first. The good news: you don't need a camera, a studio, or any skill with either. You need daylight, the right height, and about ten unhurried minutes. This guide covers the five fundamentals that decide every portrait — get them right and the hard part is already done.

## Why this matters for your portrait

Purrtraits builds your portrait from the photo you upload. The AI reads that photo for everything — the shape of the face, the colour and texture of the coat, the set of the ears, the light in the eyes. It is very good at translating what is there. It cannot invent what isn't.

Send a sharp, well-lit photo and the portrait has real detail to work from: individual fur, a true coat colour, an expression that belongs to your dog and no other. Send a dark, blurred or cluttered photo and the AI has to guess — and a guessed portrait looks like a generic dog, not yours.

This is why the photo matters more than anything else you'll do, and why it's worth ten patient minutes. You're not taking a nice picture of your dog; you're giving the artist their brief. A clear brief is the whole job. The five steps below are that brief, in order of how much each one changes the result.

## The five fundamentals

### 01 — Use daylight, never a lamp

Photograph your dog in natural light. A window is ideal: settle your dog a metre or so from a large window on an overcast day, or one without direct sun blasting through it, and let the soft light fall across their face. Daylight is even, it shows true coat colour, and it places a small bright catchlight in the eyes that makes a portrait feel alive.

Indoor ceiling lights do the opposite. They throw a yellow cast over everything, they come from directly above so the eyes fall into shadow, and they're rarely bright enough to freeze a moving dog. If it's dark outside, wait until morning. No lamp beats a window.

### 02 — Get down to their eye level

Crouch, kneel or sit so your phone is level with your dog's eyes. This single move does more for a portrait than any other.

Photographed from standing height, a dog is foreshortened — a large nose, a small body, the top of a head. Photographed at eye level, you get what a painter actually wants: both eyes, the full muzzle, the line of the jaw, and the sense of a dog meeting your gaze rather than being looked down on. The diagram shows the difference — standing fails, kneeling passes, eye level is right. Your knees will object. Do it anyway.

### 03 — Put them against a plain background

The subject of the photo is your dog. Anything else in the frame competes with them — and a busy background gives the AI more to misread. A plain wall, a closed curtain, a clean floor, a stretch of grass: any simple, uncluttered surface works.

Watch for the things that hide in a background until the portrait reveals them — a patterned rug, a houseplant directly behind the head, a doorframe that seems to sprout from one ear. You don't need a backdrop. You need to move the dog, or move yourself, until there is nothing behind them but calm, even space.

### 04 — Fill the frame, with a little room to spare

Get close enough that your dog is the photo, not a detail in it. As a rule, the head and chest should fill most of the frame.

But leave a margin. A photo cropped tight to the ears or chin gives the portrait no room to breathe and nothing to reframe. The diagram shows the safe zone: head and chest with a comfortable border of background on every side. Close enough for detail, loose enough to work with. If in doubt, take one step back rather than one step forward — you can always crop in later, but you cannot add a chin that was never in the shot.

### 05 — Wait for a sharp, natural expression

The last step is the one that needs patience. Hold the phone steady with both hands, get your dog's attention — a treat held just above the lens works well — and take the photo the moment they are still and alert.

Two things ruin this shot: movement and indifference. A dog mid-turn comes out as a blur the AI cannot sharpen. A dog staring at the floor gives a portrait with no spark. You are waiting for one second of stillness and contact — ears up, eyes on the lens, in focus. Take several frames. One of them will be the one.

## Common mistakes to avoid

- **Using flash.** It flattens the face, throws a hard shadow and turns eyes a glassy green. Daylight, always.
- **Shooting from standing height.** The most common mistake of all — a phone held at chest height looks down on the dog and distorts every proportion.
- **A cluttered background.** If you can name three objects behind your dog, the background is too busy.
- **Accepting the first blurry frame.** A photo that looks fine on a phone screen is often soft when enlarged. Check the focus on the eyes before you stop.

## Pre-flight checklist

- Natural daylight — no flash, no ceiling lamp.
- Phone held at your dog's eye level.
- Plain, uncluttered background.
- Dog fills most of the frame, with a small margin.
- Eyes sharp and in focus.
- Several frames taken — upload your best two or three.

**Inline CTA —** Got a photo that ticks all six boxes? That's the whole job done. Upload it and see your dog as a portrait.

## Ready to upload?

You don't need to be a photographer — just a window, a treat and ten patient minutes. When your reference photo gets the five fundamentals right, the portrait has everything it needs to look like your dog and no other. Take your best two or three shots and upload them. Your dog's portrait is sixty seconds away.
