// Parser for photo-tips post markdown bodies.
//
// Posts follow a fixed structure: intro → "## Why this matters …" →
// "## The N things …" with "### NN — title" step subheadings →
// "## Common mistakes …" or "## A few smaller ones" → "## Pre-flight
// checklist" → "## Ready to upload?". The page renders each section
// in its own spec-sheet slot, so we split the body up here once and
// hand back a structured tree the template can iterate over.
//
// Only the limited markdown subset the posts actually use is
// supported (paragraphs, bullets, **bold**, *italic*) — the
// renderer is intentionally small, not a full CommonMark.

export type InlineHtml = string;

export interface ParsedSection {
  title: string;
  kind: SectionKind;
  html: InlineHtml;
  bullets?: InlineHtml[];
}

export type SectionKind =
  | "why-this-matters"
  | "procedure"
  | "common-mistakes"
  | "checklist"
  | "ready-to-upload"
  | "other";

export interface ParsedStep {
  no: string; // "01", "02", …
  title: string;
  html: InlineHtml;
}

export interface ParsedBody {
  intro: InlineHtml;
  whyThisMatters: ParsedSection | null;
  procedure: {
    h2Title: string;
    intro: InlineHtml;
    steps: ParsedStep[];
  } | null;
  commonMistakes: ParsedSection | null;
  checklist: ParsedSection | null;
  inlineCta: InlineHtml | null;
  readyToUpload: InlineHtml | null;
}

// ── Inline markdown ───────────────────────────────────────────────
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<![*])\*([^*]+)\*(?![*])/g, "<em>$1</em>");
}

// ── Block markdown (paragraphs + bullets) ─────────────────────────
function blocksToHtml(src: string): { html: string; bullets: string[] } {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  const bullets: string[] = [];
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (para.length === 0) return;
    out.push(`<p>${inline(para.join(" ").trim())}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list.length === 0) return;
    out.push(`<ul>${list.map((b) => `<li>${inline(b)}</li>`).join("")}</ul>`);
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) {
      flushPara();
      flushList();
      continue;
    }
    if (line.startsWith("- ")) {
      flushPara();
      const note = line.slice(2);
      list.push(note);
      bullets.push(note);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();

  return { html: out.join("\n"), bullets };
}

// ── Section classification ────────────────────────────────────────
function classify(title: string): SectionKind {
  const t = title.toLowerCase();
  if (t.startsWith("why this matters")) return "why-this-matters";
  if (
    t.startsWith("the ") &&
    (t.includes("things") || t.includes("fundamentals") || t.includes("mistakes"))
  ) {
    return "procedure";
  }
  if (t.startsWith("common mistakes") || t.startsWith("a few smaller ones")) {
    return "common-mistakes";
  }
  if (t.startsWith("pre-flight checklist")) return "checklist";
  if (t.startsWith("ready to upload")) return "ready-to-upload";
  return "other";
}

// ── Body splitter ────────────────────────────────────────────────
export function parseBody(body: string): ParsedBody {
  const lines = body.replace(/\r\n/g, "\n").split("\n");

  // Split into chunks: each chunk is one H2 section (the intro is
  // a pre-first-H2 chunk).
  const chunks: { title: string; lines: string[] }[] = [
    { title: "__intro__", lines: [] },
  ];
  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m && !line.startsWith("### ")) {
      chunks.push({ title: m[1], lines: [] });
    } else {
      chunks[chunks.length - 1].lines.push(line);
    }
  }

  const result: ParsedBody = {
    intro: "",
    whyThisMatters: null,
    procedure: null,
    commonMistakes: null,
    checklist: null,
    inlineCta: null,
    readyToUpload: null,
  };

  for (const c of chunks) {
    if (c.title === "__intro__") {
      result.intro = blocksToHtml(c.lines.join("\n")).html;
      continue;
    }

    const kind = classify(c.title);

    if (kind === "procedure") {
      // Split by ### headings into intro + steps.
      const procIntroLines: string[] = [];
      const steps: ParsedStep[] = [];
      let currentStep: { no: string; title: string; lines: string[] } | null = null;
      for (const line of c.lines) {
        const m = /^###\s+(\d+)\s*[—-]\s*(.+?)\s*$/.exec(line);
        if (m) {
          if (currentStep) {
            steps.push({
              no: currentStep.no,
              title: currentStep.title,
              html: blocksToHtml(currentStep.lines.join("\n")).html,
            });
          }
          currentStep = { no: m[1], title: m[2], lines: [] };
        } else if (currentStep) {
          currentStep.lines.push(line);
        } else {
          procIntroLines.push(line);
        }
      }
      if (currentStep) {
        steps.push({
          no: currentStep.no,
          title: currentStep.title,
          html: blocksToHtml(currentStep.lines.join("\n")).html,
        });
      }
      result.procedure = {
        h2Title: c.title,
        intro: blocksToHtml(procIntroLines.join("\n")).html,
        steps,
      };
      continue;
    }

    if (kind === "ready-to-upload") {
      // The "Ready to upload?" section may contain an inline CTA
      // paragraph (a line that starts with **Inline CTA —**) — strip
      // it out into its own slot so we can render it as the bordered
      // pre-CTA card above the dark final section.
      const ctaLines: string[] = [];
      const restLines: string[] = [];
      let inCta = false;
      for (const line of c.lines) {
        if (/^\*\*Inline CTA\s*—/.test(line.trim())) {
          inCta = true;
          ctaLines.push(line.replace(/^\*\*Inline CTA\s*—\*\*\s*/, ""));
          continue;
        }
        if (inCta && line.trim() === "") {
          inCta = false;
          continue;
        }
        if (inCta) ctaLines.push(line);
        else restLines.push(line);
      }
      if (ctaLines.length > 0) {
        result.inlineCta = blocksToHtml(ctaLines.join("\n")).html;
      }
      result.readyToUpload = blocksToHtml(restLines.join("\n")).html;
      continue;
    }

    // Common-mistakes, checklist, and "other" all just render the
    // block content. The inline CTA can also live at the bottom of
    // either of these sections — pull it out if found.
    const { html, bullets } = blocksToHtml(c.lines.join("\n"));
    // Detect an inline CTA paragraph at the end of an arbitrary
    // section (the anchor post has it inside checklist).
    let cleanedHtml = html;
    const inlineCtaMatch =
      /<p>\s*<strong>Inline CTA\s*—\s*<\/strong>\s*([\s\S]*?)<\/p>/i.exec(html);
    if (inlineCtaMatch) {
      result.inlineCta = `<p>${inlineCtaMatch[1].trim()}</p>`;
      cleanedHtml = html.replace(inlineCtaMatch[0], "").trim();
    }

    const section: ParsedSection = {
      title: c.title,
      kind,
      html: cleanedHtml,
      bullets,
    };
    if (kind === "why-this-matters") result.whyThisMatters = section;
    else if (kind === "common-mistakes") result.commonMistakes = section;
    else if (kind === "checklist") result.checklist = section;
  }

  return result;
}

// Helper for the template: split a markdown bullet "**Title.** body
// text…" into its title + description halves, used for the
// common-mistakes grid where each card has a title and a body.
export function splitBoldLeader(line: string): { title: string; rest: string } {
  const m = /^\*\*(.+?)\*\*\.?\s*(.*)$/.exec(line.trim());
  if (m) return { title: m[1].replace(/\.$/, ""), rest: m[2].trim() };
  return { title: line, rest: "" };
}
