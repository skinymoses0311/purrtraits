# Deployment & environment topology

This document describes how Purrtraits is deployed across local dev, staging,
and production, and how to promote changes between them.

## Environments at a glance

| Env | Domain | Convex deployment | Stripe | Gelato | Vercel project | Git branch |
|---|---|---|---|---|---|---|
| Local dev | `localhost:4321` | each dev's own (or shared staging) | sandbox | sandbox | n/a | feature branches |
| **Staging** | `staging.purrtraits.shop` | `lovely-warthog-649` | **Sandbox** `acct_1TNpR7Lb2TARjPdq` ("Purrtraits sandbox") | **sandbox** | `my-app-staging` | `staging` |
| **Production** | `www.purrtraits.shop` | `prod:<slug>` (TBD) | **Live mode** on `acct_1TNpQnQ43vNtjczK` ("Purrtraits") | **production** | `my-app` | `master` |

### Stripe CLI access

Two CLI projects pair to the relevant accounts so we can manage each from terminal:

```bash
stripe --project-name purrtraits …            # main account (live + test mode of main account)
stripe --project-name purrtraits-sandbox …    # the staging sandbox
```

### Known state (verified 2026-06-03)

- Staging webhook on the sandbox: `we_1TQCeILb2TARjPdqBpCOwpdZ` at `https://lovely-warthog-649.convex.site/stripe/webhook`, status enabled.
  - Subscribed to **236 events** — overbroad. The Convex handler only acts on `checkout.session.completed` (`convex/payments.ts`) and returns `{ received: true }` for the rest. Not breaking, just noisy. Worth tightening when we set up the prod webhook.
- Main Purrtraits Stripe account is empty (no products, no webhooks) in both test and live mode — ready for production setup from a clean slate.

## Promotion flow

```
feature branch  →  merge to `staging`  →  staging.purrtraits.shop auto-deploys
                                         ↓
                              test on staging, iterate
                                         ↓
                   open PR: staging → master
                                         ↓
                       merge  →  www.purrtraits.shop auto-deploys
                                         ↓
                       Vercel build runs `npx convex deploy`
                                         ↓
                       Convex prod backend code syncs
```

There is **no manual key swapping per release.** Each Vercel project carries
its own `CONVEX_DEPLOY_KEY` and `PUBLIC_CONVEX_URL`, and each Convex
deployment carries its own per-service secrets.

## Where each credential lives

| Credential | Set on | Read by |
|---|---|---|
| `PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY`, `PUBLIC_GTM_ID` | Vercel project env vars | Astro build + browser |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Convex deployment env | `convex/payments.ts`, `convex/http.ts` |
| `GELATO_API_KEY` | Convex deployment env | `convex/gelato.ts`, `convex/seed.ts`, `convex/brevo.ts` |
| `FAL_KEY` | Convex deployment env | `convex/fal.ts`, `convex/seedream.ts` |
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` | Convex deployment env | `convex/brevo.ts` |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Convex deployment env | `convex/auth.ts` (via Convex Auth) |
| `SITE_URL`, `CONVEX_SITE_URL`, `JWT_PRIVATE_KEY*` | Convex deployment env | Convex Auth runtime |
| `ARTWORKS_SEED_TOKEN` | Convex deployment env + local `.env.staging` / `.env.production` | `convex/artworks.ts`, `scripts/*.ts` |

Convex env vars are managed via the Convex CLI, not through this repo:

```bash
# Staging
npx convex env set STRIPE_SECRET_KEY sk_test_…

# Production (note the --prod flag)
npx convex env set STRIPE_SECRET_KEY sk_live_… --prod
```

List everything currently set: `npx convex env list [--prod]`.

## First-time production setup

A condensed runbook. The full plan with rationale lives in your project chat
history; this is the do-it-once recipe.

### 1. Convex production deployment

```bash
npx convex deploy --prod                  # creates prod:<slug>
npx @convex-dev/auth                       # sets JWT_PRIVATE_KEY, SITE_URL, …
                                           # answer SITE_URL = https://www.purrtraits.shop
npx convex env set CONVEX_SITE_URL https://<prod-slug>.convex.site --prod
npx convex env set ARTWORKS_SEED_TOKEN $(uuidgen) --prod
```

### 2. Per-service credentials (set on the *production* Convex deployment)

| Service | What you do in the UI |
|---|---|
| **Stripe** | Toggle dashboard to **Live mode**. Create a new webhook endpoint at `https://<prod-slug>.convex.site/stripe/webhook` subscribing to `checkout.session.completed`. Copy `sk_live_…` and the new `whsec_…`. |
| **Gelato** | Production-tier account → API settings → grab production key. Register webhook URL `https://<prod-slug>.convex.site/gelato/webhook`. Top up account balance. |
| **fal.ai** | (Recommended) separate prod sub-key with its own billing cap. |
| **Brevo** | Verify `purrtraits.shop` domain with SPF + DKIM + DMARC. Upgrade off free tier. Confirm templates 1–7 exist with matching IDs. |
| **Google OAuth** | Create a *separate* "Purrtraits" OAuth client. Add redirect URI `https://<prod-slug>.convex.site/api/auth/callback/google`. Submit for Google verification (unverified clients are capped at 100 users). |

Then on the prod Convex deployment:

```bash
npx convex env set STRIPE_SECRET_KEY sk_live_…           --prod
npx convex env set STRIPE_WEBHOOK_SECRET whsec_…         --prod
npx convex env set GELATO_API_KEY <prod_key>             --prod
npx convex env set FAL_KEY <prod_key>                    --prod
npx convex env set BREVO_API_KEY <key>                   --prod
npx convex env set BREVO_SENDER_EMAIL orders@purrtraits.shop --prod
npx convex env set BREVO_SENDER_NAME Purrtraits          --prod
npx convex env set AUTH_GOOGLE_ID <id>                   --prod
npx convex env set AUTH_GOOGLE_SECRET <secret>           --prod
```

### 3. Seed production data

```bash
npx convex run seed:seedV1Catalog --prod
# Then for artworks (run locally, against prod):
PUBLIC_CONVEX_URL=https://<prod-slug>.convex.cloud \
ARTWORKS_SEED_TOKEN=<prod-token> \
  npm run seed:artworks

# Smoke test:
npx convex run tests:runAll --prod
```

### 4. Two Vercel projects

**Production project** (the existing `my-app`):

- Production Branch: `master`
- Domains: `www.purrtraits.shop`, `purrtraits.shop` (redirect)
- Build command: `npx convex deploy --cmd 'npm run build'`
- Ignored Build Step: `bash scripts/vercel-ignore-build.sh master`
- Env vars (Production scope): see `.env.production.example`

**Staging project** (new — `my-app-staging`):

- Production Branch: `staging`  (yes, `staging` is the "production" branch for *this* project)
- Domains: `staging.purrtraits.shop`
- Build command: `npx convex deploy --cmd 'npm run build'`
- Ignored Build Step: `bash scripts/vercel-ignore-build.sh staging`
- Env vars (Production scope): see `.env.staging.example`

DNS: add a CNAME `staging.purrtraits.shop → cname.vercel-dns.com`.

### 5. Branch protection

GitHub repo settings → Branches → add a rule on `master`:
- Require pull requests before merging
- (Optional) Require status checks: Vercel staging deploy must succeed

This is what enforces the "staging first, then prod" workflow.

## Day-to-day promotion

```bash
# develop
git checkout -b feature/whatever
# … work …
git push -u origin feature/whatever
gh pr create --base staging

# merge to staging → staging.purrtraits.shop rebuilds automatically
# verify on staging

gh pr create --base master --head staging
# merge → www.purrtraits.shop rebuilds + Convex prod syncs
```

## Verification checklists

### After every push to staging
1. Sign-up flow (email + Google) — welcome email lands
2. Full funnel — `/upload` → `/quiz` → `/generate` → `/reveal` → `/cart`
3. Test-mode Stripe checkout with `4242 4242 4242 4242`
4. Confirmation email + order in Convex dashboard
5. `npx convex run tests:runAll`

### Before first production launch
Same as staging plus:
- Real Stripe charge (use a £0.50 SKU or a 100% Stripe coupon)
- GA4 / GTM events firing on the live domain
- `/api/geo` returns sensible country/currency from the Vercel edge
- Brevo deliverability test — orders@ email to gmail, outlook, yahoo (no spam folder)

## Incident response

- **Production is broken; need to roll back**: revert the merge commit on `master`. Vercel auto-redeploys the previous build. Convex schema migrations may not auto-roll-back — check `convex/migrations.ts` history if a recent migration is suspect.
- **Stripe webhook stops working**: check webhook signing secret hasn't been rotated in Stripe Dashboard. Endpoint must be `https://<prod-slug>.convex.site/stripe/webhook`.
- **Auth users can't sign in**: most likely `SITE_URL` or `CONVEX_SITE_URL` drift, or Google OAuth redirect URI not whitelisted. Check Convex deployment logs.
- **fal budget blown**: cap is set on the fal account, not in code. Adjust on fal.ai dashboard.
