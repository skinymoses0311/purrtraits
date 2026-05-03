// Quiz-driven style ranking. Given a user's quiz answers we score the 10
// available art styles and return them ranked highest-first. The top 3 get
// pre-suggested on the style selection screen; the user can swap any of
// them out before generation runs.

export const ALL_STYLES = [
  "oil",
  "watercolour",
  "pop",
  "sketch",
  "impressionist",
  "ukiyo",
  "renaissance",
  "comic",
  "geometric",
  "botanical",
] as const;

export type Style = (typeof ALL_STYLES)[number];

export const STYLE_LABELS: Record<Style, string> = {
  oil: "Oil Painting",
  watercolour: "Watercolour",
  pop: "Pop Art",
  sketch: "Pencil Sketch",
  impressionist: "Impressionist",
  ukiyo: "Japanese Woodblock",
  renaissance: "Renaissance Portrait",
  comic: "Comic Book",
  geometric: "Geometric",
  botanical: "Botanical Illustration",
};

// Short hand-written blurb shown alongside each style on the picker.
export const STYLE_BLURBS: Record<Style, string> = {
  oil: "Rich brushwork, museum-quality warmth",
  watercolour: "Soft washes, airy and gentle",
  pop: "Bold, vibrant, retro silkscreen",
  sketch: "Hand-drawn pencil and charcoal",
  impressionist: "Dreamy Monet-style light",
  ukiyo: "Japanese woodblock print",
  renaissance: "Regal Old-Master portrait",
  comic: "Inked outlines, punchy colour",
  geometric: "Modern faceted low-poly",
  botanical: "Vintage scientific illustration",
};

export type QuizAnswers = {
  name?: string;
  breed?: string;
  breeds?: string[];
  age?: string;
  lifestyle?: string;
  activity?: string;
  mood?: string;
  favouriteFeature?: string;
};

type ScoreTable = Record<string, Partial<Record<Style, number>>>;

const MOOD: ScoreTable = {
  regal: { oil: 2, renaissance: 2, botanical: 1 },
  playful: { pop: 2, comic: 2, geometric: 1 },
  calm: { watercolour: 2, impressionist: 2, sketch: 1 },
  quirky: { pop: 2, geometric: 1, ukiyo: 1 },
};

const ACTIVITY: ScoreTable = {
  regal: { renaissance: 2, oil: 2, botanical: 1 },
  playing: { comic: 2, pop: 2, geometric: 1 },
  napping: { watercolour: 2, impressionist: 2, sketch: 1 },
  adventuring: { ukiyo: 2, impressionist: 1, geometric: 1 },
};

const AGE: ScoreTable = {
  // young / kitten / puppy buckets
  "under-1": { pop: 1, comic: 1, geometric: 1 },
  "1-3": { pop: 1, comic: 1, geometric: 1 },
  young: { pop: 1, comic: 1, geometric: 1 },
  kitten: { pop: 1, comic: 1, geometric: 1 },
  puppy: { pop: 1, comic: 1, geometric: 1 },
  // senior buckets
  "8-plus": { oil: 1, sketch: 1, watercolour: 1 },
  senior: { oil: 1, sketch: 1, watercolour: 1 },
  // 4-7 / adult: no bonus
};

const LIFESTYLE: ScoreTable = {
  // Mapped from the quiz's homebody/adventurer values plus the broader
  // indoor/outdoor/mix vocabulary the spec uses.
  indoor: { oil: 1, watercolour: 1, renaissance: 1 },
  homebody: { oil: 1, watercolour: 1, renaissance: 1 },
  outdoor: { ukiyo: 1, impressionist: 1, botanical: 1 },
  adventurer: { ukiyo: 1, impressionist: 1, botanical: 1 },
  mix: { impressionist: 1, geometric: 1 },
};

function applyTable(scores: Record<Style, number>, table: ScoreTable, value?: string) {
  if (!value) return;
  const row = table[value];
  if (!row) return;
  for (const [style, delta] of Object.entries(row)) {
    scores[style as Style] += delta ?? 0;
  }
}

// Stable tiebreaker: keep the canonical ALL_STYLES order when scores tie.
// Without this the ranking would jitter purely on iteration order.
export function scoreStyles(answers: QuizAnswers | undefined): Style[] {
  const scores = Object.fromEntries(
    ALL_STYLES.map((s) => [s, 0]),
  ) as Record<Style, number>;
  if (answers) {
    applyTable(scores, MOOD, answers.mood);
    applyTable(scores, ACTIVITY, answers.activity);
    applyTable(scores, AGE, answers.age);
    applyTable(scores, LIFESTYLE, answers.lifestyle);
  }
  const indexed = ALL_STYLES.map((style, idx) => ({ style, idx, score: scores[style] }));
  indexed.sort((a, b) => (b.score - a.score) || (a.idx - b.idx));
  return indexed.map((x) => x.style);
}
