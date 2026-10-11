#!/usr/bin/env node
// Regenerate Convex Auth signing keys (JWT_PRIVATE_KEY + its matching JWKS) on
// a Convex deployment. Fixes the "invalid RSA PrivateKeyInfo" failure that
// leaves OAuth sign-in stuck on "Completing sign-in…" — that error means the
// deployment's JWT_PRIVATE_KEY can't be parsed by `importPKCS8` (tokens.ts).
//
// Usage (from repo root, after `npm install`):
//   node scripts/fix-convex-auth-keys.mjs                  # STAGING (default)
//   node scripts/fix-convex-auth-keys.mjs --target prod --yes
//
// Deploy keys are read from the environment, never hard-coded:
//   staging -> CONVEX_DEPLOY_KEY_STAGING   (deployment: lovely-warthog-649)
//   prod    -> CONVEX_DEPLOY_KEY_PROD       (deployment: wry-marten-771)
//
// SAFETY: before writing anything, the script confirms the deploy key actually
// points at the expected deployment (it reads that deployment's CONVEX_SITE_URL
// and checks it contains the expected slug). Any mismatch aborts the run, so a
// mislabeled key can never silently rewrite the wrong backend. Targeting prod
// additionally requires an explicit --yes.

import { exportJWK, exportPKCS8, generateKeyPair, importPKCS8 } from "jose";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TARGETS = {
  staging: { keyVar: "CONVEX_DEPLOY_KEY_STAGING", slug: "lovely-warthog-649" },
  prod: { keyVar: "CONVEX_DEPLOY_KEY_PROD", slug: "wry-marten-771" },
};

const args = process.argv.slice(2);
const flagValue = (name) => {
  const i = args.indexOf(name);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : undefined;
};
const target = flagValue("--target") ?? "staging";
const confirmed = args.includes("--yes");

const cfg = TARGETS[target];
if (!cfg) {
  console.error(`Unknown --target "${target}". Use "staging" or "prod".`);
  process.exit(1);
}
if (target === "prod" && !confirmed) {
  console.error("Refusing to touch PRODUCTION without --yes.");
  console.error("Only do this if prod itself shows the same sign-in error.");
  console.error("Re-run with: --target prod --yes");
  process.exit(1);
}

const deployKey = process.env[cfg.keyVar];
if (!deployKey) {
  console.error(`Missing ${cfg.keyVar} in the environment.`);
  process.exit(1);
}

// Every child `convex` call targets this deployment via its own deploy key.
const env = { ...process.env, CONVEX_DEPLOY_KEY: deployKey };
const convex = (cliArgs) =>
  execFileSync("npx", ["convex", ...cliArgs], { env, encoding: "utf8" });

// --- SAFETY GUARD: confirm we are pointed at the expected deployment --------
console.log(`Target: ${target} — expecting deployment "${cfg.slug}".`);
let siteUrl;
try {
  siteUrl = convex(["env", "get", "CONVEX_SITE_URL"]).trim();
} catch (e) {
  console.error("\nCould not read CONVEX_SITE_URL from the deployment. Check:");
  console.error("  1. Network Allowed domains include *.convex.dev, *.convex.cloud, *.convex.site");
  console.error(`  2. ${cfg.keyVar} is a valid deploy key for ${cfg.slug}`);
  console.error(String(e.stderr || e.message || e));
  process.exit(1);
}
if (!siteUrl.includes(cfg.slug)) {
  console.error(`\nABORT: this deploy key resolves to "${siteUrl}",`);
  console.error(`which is NOT the expected "${cfg.slug}". Refusing to write.`);
  process.exit(1);
}
console.log(`Confirmed deployment: ${siteUrl}`);

// --- Generate a fresh RS256 keypair (private PKCS#8 + public JWKS) ----------
const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
// Single line (newlines -> spaces) is exactly how Convex Auth stores the key;
// jose strips whitespace when base64-decoding, so it re-imports cleanly.
const JWT_PRIVATE_KEY = (await exportPKCS8(privateKey)).trimEnd().replace(/\n/g, " ");
const jwk = await exportJWK(publicKey);
const JWKS = JSON.stringify({ keys: [{ use: "sig", ...jwk }] });

// Self-check: this is the precise call that is failing on staging today.
await importPKCS8(JWT_PRIVATE_KEY, "RS256");

// --- Write both as a matched pair ------------------------------------------
// The PEM value starts with "-----", which the Convex CLI's option parser would
// treat as a flag if passed as a positional argv. Feed each value through a
// temp file with `--from-file` so the raw bytes are stored verbatim. The temp
// dir is created with restrictive perms and removed even if a set call throws.
const tmp = mkdtempSync(join(tmpdir(), "convex-auth-keys-"));
try {
  const setEnv = (name, value) => {
    const file = join(tmp, name);
    writeFileSync(file, value, { mode: 0o600 });
    convex(["env", "set", name, "--from-file", file]);
  };
  setEnv("JWT_PRIVATE_KEY", JWT_PRIVATE_KEY);
  setEnv("JWKS", JWKS);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n✓ Set JWT_PRIVATE_KEY + JWKS on ${cfg.slug}.`);
console.log(`  Verify the public key is now served:`);
console.log(`    curl -s ${siteUrl}/.well-known/jwks.json`);
console.log(`  Then retry Google sign-in — it should pass "Completing sign-in…".`);
