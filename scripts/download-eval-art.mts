// One-off download helper for the 20-artwork evaluation cohort.
// Uses the same DNS override as matrix-render.ts to dodge OS-resolver
// timeouts, plus a Wikimedia-friendly User-Agent and per-request delays
// to avoid the 429 rate-limiter. Skips files already on disk.
import { writeFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dns from "node:dns";
import { promisify } from "node:util";

dns.setServers(["1.1.1.1", "8.8.8.8", "1.0.0.1"]);
const resolve4 = promisify(dns.resolve4.bind(dns));
const resolve6 = promisify(dns.resolve6.bind(dns));
const systemLookup = dns.lookup;
// @ts-expect-error overriding built-in
dns.lookup = (hostname: string, options: any, callback: any): void => {
  const cb = typeof options === "function" ? options : callback;
  const opts = (typeof options === "function" ? {} : options) ?? {};
  (async () => {
    try {
      let v4: string[] = [];
      let v6: string[] = [];
      try { v4 = await resolve4(hostname); } catch { /* none */ }
      try { v6 = await resolve6(hostname); } catch { /* none */ }
      const all = [
        ...v4.map((address) => ({ address, family: 4 })),
        ...v6.map((address) => ({ address, family: 6 })),
      ];
      if (all.length === 0) throw new Error(`no DNS records for ${hostname}`);
      if (opts.all) cb(null, all);
      else cb(null, all[0].address, all[0].family);
    } catch {
      systemLookup(hostname, options, callback);
    }
  })();
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEST = join(__dirname, "artwork-refs");

// Wikimedia rate-limits more aggressively without a meaningful UA.
const UA = "PurrtraitsCatalogSeeder/1.0 (https://purrtraits.app; eval-cohort)";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const targets: Array<[string, string[]]> = [
  ["wanderer_sea_of_fog", ["Caspar_David_Friedrich_-_Wanderer_above_the_Sea_of_Fog.jpeg"]],
  ["raft_medusa", ["JEAN_LOUIS_THÉODORE_GÉRICAULT_-_La_Balsa_de_la_Medusa_(Museo_del_Louvre,_1818-19).jpg"]],
  ["liberty_leading_people", ["Eugène_Delacroix_-_Le_28_Juillet._La_Liberté_guidant_le_peuple.jpg"]],
  ["ninth_wave", ["Hovhannes_Aivazovsky_-_The_Ninth_Wave_-_Google_Art_Project.jpg"]],
  ["sleeping_gypsy", ["Henri_Rousseau_-_The_Sleeping_Gypsy.jpg"]],
  ["tiger_tropical_storm", ["Henri_Rousseau_005.jpg"]],
  ["card_players", ["Paul_Cézanne,_The_Card_Players,_1892-93.jpg", "Cezanne_The_Card_Players_Pennsylvania.jpg"]],
  ["cypresses", ["Vincent_van_Gogh_-_Cypresses_-_Google_Art_Project.jpg"]],
  ["night_watch", ["The_Night_Watch_-_HD.jpg"]],
  ["little_street", ["Johannes_Vermeer_-_Gezicht_op_huizen_in_Delft,_bekend_als_'Het_straatje'_-_Google_Art_Project.jpg"]],
  ["mill_wijk", ["Jacob_van_Ruisdael_-_The_Windmill_at_Wijk_bij_Duurstede_-_Google_Art_Project.jpg"]],
  ["heart_of_andes", ["Frederic_Edwin_Church_-_The_Heart_of_the_Andes_-_Metropolitan_Museum_of_Art.jpg", "Heart_of_the_Andes.jpg"]],
  ["sierra_nevada", ["Albert_Bierstadt_-_Among_the_Sierra_Nevada,_California_-_Google_Art_Project.jpg"]],
  ["lady_of_shalott", ["John_William_Waterhouse_-_The_Lady_of_Shalott_-_Google_Art_Project_edit.jpg", "John_William_Waterhouse_-_The_Lady_of_Shalott_-_Tate_1894.jpg"]],
  ["ophelia", ["John_Everett_Millais_-_Ophelia_-_Google_Art_Project.jpg"]],
  ["childrens_games", ["Pieter_Bruegel_the_Elder_-_Children’s_Games_-_Google_Art_Project.jpg", "Pieter_Bruegel_d._Ä._037.jpg"]],
  ["netherlandish_proverbs", ["Pieter_Brueghel_the_Elder_-_The_Dutch_Proverbs_-_Google_Art_Project.jpg"]],
  ["the_gleaners", ["Jean-François_Millet_-_Gleaners_-_Google_Art_Project_2.jpg"]],
  ["gulf_stream", ["Winslow_Homer_-_The_Gulf_Stream_-_Metropolitan_Museum_of_Art.jpg", "Winslow_Homer_-_The_Gulf_Stream.jpg"]],
  ["las_meninas", ["Las_Meninas_01.jpg"]],
];

async function fetchWithRetry(url: string, attempts = 4): Promise<Response | null> {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": UA },
    });
    if (res.status !== 429 && res.status !== 503) return res;
    const delay = 4000 * (i + 1);
    process.stdout.write(`  ↻ ${res.status} backing off ${delay / 1000}s\n`);
    await sleep(delay);
  }
  return null;
}

let ok = 0, fail = 0, skip = 0;
for (const [slug, candidates] of targets) {
  const dest = join(DEST, `${slug}.jpg`);
  if (existsSync(dest) && statSync(dest).size > 100_000) {
    console.log(`· ${slug.padEnd(28)} skip (already ${statSync(dest).size.toLocaleString()} bytes)`);
    skip++;
    continue;
  }
  let success = false;
  for (const filename of candidates) {
    const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=1600`;
    try {
      const res = await fetchWithRetry(url);
      if (!res || !res.ok) {
        console.log(`  ${slug.padEnd(28)} ${res?.status ?? "ERR"} ${filename.slice(0, 60)}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(dest, buf);
      console.log(`✓ ${slug.padEnd(28)} ${buf.length.toString().padStart(8)} bytes`);
      success = true;
      ok++;
      break;
    } catch (err) {
      console.log(`  ${slug.padEnd(28)} EXC ${(err as Error).message}`);
    }
  }
  if (!success) { fail++; console.log(`✗ ${slug.padEnd(28)} ALL CANDIDATES FAILED`); }
  await sleep(1500); // polite per-request delay
}
console.log(`\n${ok} downloaded, ${skip} skipped, ${fail} failed.`);
