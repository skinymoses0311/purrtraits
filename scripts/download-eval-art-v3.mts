// Looks up each remaining artwork's lead image via the Wikipedia
// pageimages API, then downloads from the returned URL. More reliable
// than guessing Commons filenames.
import { writeFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dns from "node:dns";
import { promisify } from "node:util";

dns.setServers(["1.1.1.1", "8.8.8.8"]);
const resolve4 = promisify(dns.resolve4.bind(dns));
const resolve6 = promisify(dns.resolve6.bind(dns));
const systemLookup = dns.lookup;
// @ts-expect-error
dns.lookup = (h: string, o: any, cb: any) => {
  const c = typeof o === "function" ? o : cb; const op = (typeof o === "function" ? {} : o) ?? {};
  (async () => {
    try { let v4: string[] = []; let v6: string[] = [];
      try { v4 = await resolve4(h); } catch {} try { v6 = await resolve6(h); } catch {}
      const a = [...v4.map((x) => ({ address: x, family: 4 })), ...v6.map((x) => ({ address: x, family: 6 }))];
      if (!a.length) throw new Error("no DNS"); if (op.all) c(null, a); else c(null, a[0].address, a[0].family);
    } catch { systemLookup(h, o, cb); }
  })();
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEST = join(__dirname, "artwork-refs");
const UA = "PurrtraitsCatalogSeeder/1.0 (https://purrtraits.app; eval-cohort)";
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// slug → Wikipedia article title (URL-encoded fragment)
const targets: Array<[string, string]> = [
  ["sleeping_gypsy", "The_Sleeping_Gypsy"],
  ["card_players", "The_Card_Players"],
  ["cypresses", "Cypresses_(painting)"],
  ["mill_wijk", "The_Mill_at_Wijk_bij_Duurstede"],
  ["heart_of_andes", "The_Heart_of_the_Andes"],
];

async function leadImageUrl(title: string): Promise<string | null> {
  const api = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=original&titles=${encodeURIComponent(title)}`;
  const res = await fetch(api, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const data = (await res.json()) as any;
  const pages = data?.query?.pages ?? {};
  for (const k of Object.keys(pages)) {
    const orig = pages[k]?.original?.source;
    if (orig) return orig;
  }
  return null;
}

for (const [slug, title] of targets) {
  const dest = join(DEST, `${slug}.jpg`);
  if (existsSync(dest) && statSync(dest).size > 100_000) {
    console.log(`· ${slug.padEnd(28)} skip`);
    continue;
  }
  try {
    const url = await leadImageUrl(title);
    if (!url) {
      console.log(`✗ ${slug.padEnd(28)} no lead image for ${title}`);
      await sleep(1000);
      continue;
    }
    process.stdout.write(`  ${slug.padEnd(28)} → ${url.slice(0, 80)}\n`);
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
    if (!res.ok) {
      console.log(`✗ ${slug.padEnd(28)} ${res.status} fetching image`);
      await sleep(1500);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 20000) {
      console.log(`✗ ${slug.padEnd(28)} too small (${buf.length})`);
      continue;
    }
    writeFileSync(dest, buf);
    console.log(`✓ ${slug.padEnd(28)} ${buf.length.toLocaleString()} bytes`);
  } catch (err) {
    console.log(`✗ ${slug.padEnd(28)} ERR ${(err as Error).message}`);
  }
  await sleep(2000);
}
