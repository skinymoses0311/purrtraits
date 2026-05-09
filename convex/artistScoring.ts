// Quiz-driven artist ranking. Mirrors styleScoring.ts but for the 10
// public-domain artists surfaced on Tab 2 of the picker. Same input
// (QuizAnswers) and same scoring shape — only the per-key score tables
// differ. Kept as a parallel file (not merged into styleScoring) so a
// maintainer reading either side sees one self-contained pattern.

import type { QuizAnswers } from "./styleScoring";

export const ALL_ARTISTS = [
  "vangogh",
  "monet",
  "vermeer",
  "klimt",
  "hokusai",
  "mucha",
  "davinci",
  "rembrandt",
  "seurat",
  "cassatt",
] as const;

export type Artist = (typeof ALL_ARTISTS)[number];

export const ARTIST_LABELS: Record<Artist, string> = {
  vangogh: "Van Gogh",
  monet: "Monet",
  vermeer: "Vermeer",
  klimt: "Klimt",
  hokusai: "Hokusai",
  mucha: "Mucha",
  davinci: "Da Vinci",
  rembrandt: "Rembrandt",
  seurat: "Seurat",
  cassatt: "Cassatt",
};

export const ARTIST_BLURBS: Record<Artist, string> = {
  vangogh: "Swirling impasto, vivid colour",
  monet: "Soft impressionist light",
  vermeer: "Dutch Golden Age realism",
  klimt: "Gilded Art Nouveau pattern",
  hokusai: "Iconic Japanese woodblock",
  mucha: "Decorative Art Nouveau line",
  davinci: "Renaissance sfumato mastery",
  rembrandt: "Dramatic Baroque chiaroscuro",
  seurat: "Pointillist colour science",
  cassatt: "Tender Impressionist warmth",
};

type ArtistScoreTable = Record<string, Partial<Record<Artist, number>>>;

const MOOD: ArtistScoreTable = {
  regal: { rembrandt: 2, davinci: 2, vermeer: 1 },
  playful: { vangogh: 2, hokusai: 2, mucha: 1 },
  calm: { monet: 2, cassatt: 2, vermeer: 1 },
  quirky: { klimt: 2, mucha: 1, hokusai: 1 },
};

const ACTIVITY: ArtistScoreTable = {
  regal: { davinci: 2, rembrandt: 2, vermeer: 1 },
  playing: { vangogh: 2, hokusai: 1, seurat: 1 },
  napping: { cassatt: 2, monet: 2, vermeer: 1 },
  adventuring: { hokusai: 2, monet: 1, seurat: 1 },
};

const AGE: ArtistScoreTable = {
  "under-1": { vangogh: 1, hokusai: 1, mucha: 1 },
  "1-3": { vangogh: 1, hokusai: 1, mucha: 1 },
  young: { vangogh: 1, hokusai: 1, mucha: 1 },
  kitten: { vangogh: 1, hokusai: 1, mucha: 1 },
  puppy: { vangogh: 1, hokusai: 1, mucha: 1 },
  "8-plus": { rembrandt: 1, vermeer: 1, cassatt: 1 },
  senior: { rembrandt: 1, vermeer: 1, cassatt: 1 },
};

const LIFESTYLE: ArtistScoreTable = {
  indoor: { vermeer: 1, cassatt: 1, davinci: 1 },
  homebody: { vermeer: 1, cassatt: 1, davinci: 1 },
  outdoor: { hokusai: 1, monet: 1, seurat: 1 },
  adventurer: { hokusai: 1, monet: 1, seurat: 1 },
  mix: { vangogh: 1, klimt: 1 },
};

function applyTable(
  scores: Record<Artist, number>,
  table: ArtistScoreTable,
  value?: string,
) {
  if (!value) return;
  const row = table[value];
  if (!row) return;
  for (const [artist, delta] of Object.entries(row)) {
    scores[artist as Artist] += delta ?? 0;
  }
}

// Stable tiebreaker: keep the canonical ALL_ARTISTS order when scores tie.
export function scoreArtists(answers: QuizAnswers | undefined): Artist[] {
  const scores = Object.fromEntries(
    ALL_ARTISTS.map((a) => [a, 0]),
  ) as Record<Artist, number>;
  if (answers) {
    applyTable(scores, MOOD, answers.mood);
    applyTable(scores, ACTIVITY, answers.activity);
    applyTable(scores, AGE, answers.age);
    applyTable(scores, LIFESTYLE, answers.lifestyle);
  }
  const indexed = ALL_ARTISTS.map((artist, idx) => ({
    artist,
    idx,
    score: scores[artist],
  }));
  indexed.sort((a, b) => (b.score - a.score) || (a.idx - b.idx));
  return indexed.map((x) => x.artist);
}
