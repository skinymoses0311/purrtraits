// One-off export: pull every generated portrait out of Convex and save it
// locally with a filename that encodes activity / mood / style.
//
// Usage (from the my-app/ directory):
//   node scripts/download-gallery.mjs [outputDir]
//
// Defaults to ./gallery-export. Auth comes from your existing
// `npx convex` CLI session (the same one `npx convex dev` uses), so no extra
// env setup is needed as long as you've run convex dev in this repo before.

import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT_DIR = process.argv[2] ?? "./gallery-export";
const PAGE_SIZE = 50;
const FN = "galleryExport:listAll";

function runConvex(args) {
  const out = execFileSync(
    "npx",
    ["convex", "run", FN, JSON.stringify(args)],
    { encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "inherit"] },
  );
  // `npx convex run` prints the function's return value as JSON on stdout.
  // Be tolerant of any leading non-JSON the CLI might emit by locating the
  // first `{` and parsing from there.
  const start = out.indexOf("{");
  if (start === -1) throw new Error(`No JSON in convex run output:\n${out}`);
  return JSON.parse(out.slice(start));
}

function sanitize(s) {
  return (s ?? "unknown")
    .toString()
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "unknown";
}

function extFromUrl(url) {
  try {
    const path = new URL(url).pathname.toLowerCase();
    const m = path.match(/\.(jpg|jpeg|png|webp)(?:$|\?)/);
    if (m) return m[1] === "jpeg" ? "jpg" : m[1];
  } catch {
    // fall through
  }
  return "jpg";
}

async function downloadOne(item, outDir, seenNames) {
  const url = item.printFileUrl ?? item.imageUrl;
  const ext = extFromUrl(url);
  let base = [
    sanitize(item.activity),
    sanitize(item.mood),
    sanitize(item.style),
    item.sessionId,
  ].join("_");
  let filename = `${base}.${ext}`;
  let n = 1;
  while (seenNames.has(filename)) {
    n += 1;
    filename = `${base}_${n}.${ext}`;
  }
  seenNames.add(filename);

  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  skip (HTTP ${res.status}) ${filename}`);
    return false;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(join(outDir, filename), buf);
  console.log(`  saved ${filename}`);
  return true;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const seenNames = new Set();
  let cursor = null;
  let totalSeen = 0;
  let totalSaved = 0;
  let pageIdx = 0;

  while (true) {
    pageIdx += 1;
    console.log(`page ${pageIdx} (cursor=${cursor ? "…" : "null"})`);
    const result = runConvex({
      paginationOpts: { numItems: PAGE_SIZE, cursor },
    });

    for (const item of result.items) {
      totalSeen += 1;
      const ok = await downloadOne(item, OUT_DIR, seenNames);
      if (ok) totalSaved += 1;
    }

    if (result.isDone) break;
    cursor = result.continueCursor;
  }

  console.log(
    `\ndone. ${totalSaved}/${totalSeen} images written to ${OUT_DIR}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
