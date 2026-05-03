// Builds the full Purrtraits documentation set (8 .docx files) in one shot.
// Run: node build-all-docs.cjs
//
// Each doc is self-contained but cross-references the others by filename.

const fs = require("fs");
const path = require("path");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  Header,
  Footer,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  WidthType,
  ShadingType,
  LevelFormat,
  PageNumber,
} = require("docx");

const OUT_DIR = "C:/Users/rjsan/claudeprojects/my-app/docs";

// ============================================================================
// SHARED HELPERS
// ============================================================================

const border = { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" };
const borders = { top: border, bottom: border, left: border, right: border };

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    ...opts,
    children: [new TextRun({ text, ...(opts.run || {}) })],
  });
}

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
}
function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 80 },
    children: [new TextRun(text)],
  });
}

function bulletKV(label, value, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 80 },
    children: [
      new TextRun({ text: label, bold: true }),
      new TextRun({ text: " — " + value }),
    ],
  });
}

function numbered(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "numbers", level },
    spacing: { after: 80 },
    children: [new TextRun(text)],
  });
}

function spacer() {
  return new Paragraph({ spacing: { after: 120 }, children: [new TextRun("")] });
}

function cell(text, opts = {}) {
  const { width = 2000, bold = false, fill, mono = false, align } = opts;
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text,
            bold,
            font: mono ? "Consolas" : undefined,
            size: mono ? 18 : undefined,
          }),
        ],
      }),
    ],
  });
}

function cellMulti(paragraphs, opts = {}) {
  const { width = 2000, fill, mono = false } = opts;
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: paragraphs.map(
      (text) =>
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({
              text,
              font: mono ? "Consolas" : undefined,
              size: mono ? 18 : undefined,
            }),
          ],
        }),
    ),
  });
}

function table(widths, headerLabels, bodyRows) {
  const totalWidth = widths.reduce((a, b) => a + b, 0);
  const headerRow = new TableRow({
    tableHeader: true,
    children: headerLabels.map((label, i) =>
      cell(label, { width: widths[i], bold: true, fill: "EFEFEF" }),
    ),
  });
  const rows = [
    headerRow,
    ...bodyRows.map(
      (row) =>
        new TableRow({
          children: row.map((c, i) => {
            if (typeof c === "string") return cell(c, { width: widths[i] });
            return cell(c.text, { width: widths[i], ...c });
          }),
        }),
    ),
  ];
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: widths,
    rows,
  });
}

function codeBlock(text) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [
      new TableRow({
        children: [
          cellMulti(text.split("\n"), {
            width: 9360,
            fill: "F4F4F4",
            mono: true,
          }),
        ],
      }),
    ],
  });
}

function titleBlock(title, subtitle) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: title, bold: true, size: 44 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
      children: [
        new TextRun({ text: subtitle, italics: true, size: 24, color: "555555" }),
      ],
    }),
  ];
}

function makeDoc(title, subtitle, children) {
  return new Document({
    creator: "Purrtraits",
    title,
    description: subtitle,
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 } } },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 32, bold: true, font: "Calibri", color: "1F3A5F" },
          paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 26, bold: true, font: "Calibri", color: "2F5496" },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 22, bold: true, font: "Calibri", color: "404040" },
          paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
            {
              level: 1,
              format: LevelFormat.BULLET,
              text: "◦",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 1440, hanging: 360 } } },
            },
          ],
        },
        {
          reference: "numbers",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "Purrtraits — " + title,
                    italics: true,
                    color: "808080",
                    size: 18,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Page ", color: "808080", size: 18 }),
                  new TextRun({ children: [PageNumber.CURRENT], color: "808080", size: 18 }),
                  new TextRun({ text: " of ", color: "808080", size: 18 }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], color: "808080", size: 18 }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
}

async function emit(filename, doc) {
  const out = path.join(OUT_DIR, filename);
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(out, buf);
  console.log("Wrote " + out + " (" + buf.length + " bytes)");
}

// ============================================================================
// DOC 1 — System Architecture & Tech Stack
// ============================================================================

function doc1() {
  const title = "System Architecture & Tech Stack";
  const subtitle = "How the Purrtraits app is wired together end-to-end";
  const c = [];

  c.push(...titleBlock(title, subtitle));

  c.push(h1("1. Elevator pitch"));
  c.push(
    p(
      "Purrtraits is a web app that turns a customer's pet photos into AI-generated artistic portraits, sold as digital downloads, posters, framed prints and canvases. The customer uploads photos, takes a short personality quiz, picks 3 art styles, and the app generates 3 portraits in parallel via fal.ai. Physical prints are fulfilled by Gelato; payments go through Stripe; transactional email goes through Brevo.",
    ),
  );

  c.push(h1("2. Top-level architecture"));
  c.push(
    p(
      "The app is a small Astro frontend with a Convex backend. Astro pages are mostly script islands (vanilla TS, not React) that call into Convex queries, mutations and actions directly from the browser. There is no separate Node API layer.",
    ),
  );
  c.push(codeBlock(
    [
      "Browser (Astro pages, vanilla TS islands)",
      "  │",
      "  │  ConvexClient (HTTPS + WebSocket)",
      "  ▼",
      "Convex deployment",
      "  ├── tables: users, sessions, products, orders, + Convex Auth tables",
      "  ├── functions: queries, mutations, actions, internal*",
      "  ├── file storage (pet photos, generated portraits)",
      "  └── HTTP routes:",
      "        /stripe/webhook  → payments.handleStripeWebhook",
      "        /gelato/webhook  → gelato.handleWebhook",
      "        /api/auth/*      → Convex Auth routes",
      "  │",
      "  ├── outbound: fal.ai (Nano Banana edit + Aura SR upscale)",
      "  ├── outbound: Stripe (Checkout sessions, signed webhook in)",
      "  ├── outbound: Gelato (orders + product catalog + webhook in)",
      "  └── outbound: Brevo (transactional email templates)",
      "",
      "Browser → Google: Tag Manager (analytics), AdSense (revenue)",
    ].join("\n"),
  ));

  c.push(h1("3. Tech stack"));
  c.push(h2("Frontend"));
  c.push(
    bulletKV("Astro 6.1.9", "static-first framework, file-based routing under src/pages/"),
    bulletKV("React 19", "added solely so the Convex Auth UI can mount as a client island on /sign-up"),
    bulletKV("Vanilla TypeScript", "every page outside /sign-up is plain Astro markup + a <script> island talking to Convex"),
    bulletKV("Convex browser client", "convex/browser ConvexClient on every page; an authed wrapper (makeAuthedClient) is used where the JWT is required"),
  );
  c.push(h2("Backend"));
  c.push(
    bulletKV("Convex 1.36", "tables, queries, mutations, actions, internal functions, file storage, HTTP routes, scheduler"),
    bulletKV("Convex Auth", "@convex-dev/auth with Password + Google providers; tables auto-injected via authTables"),
    bulletKV("Sharp", "image post-processing inside the fal.ts action (3:4 aspect enforcement via center-crop)"),
    bulletKV("Stripe SDK 22", "Checkout session creation + webhook signature verification"),
  );
  c.push(h2("External services"));
  c.push(
    bulletKV("fal.ai — Nano Banana", "image-edit endpoint at fal-ai/nano-banana/edit. Backed by Gemini 2.5 Flash Image. Takes 1+ reference images + prompt, returns a styled image preserving identity."),
    bulletKV("fal.ai — Aura SR", "fal-ai/aura-sr 4× super-resolution upscaler. Run only after a successful purchase, not at preview time."),
    bulletKV("Stripe Checkout", "hosted checkout. Pre-creates a pending order in Convex, fills it on webhook."),
    bulletKV("Gelato", "print-on-demand fulfilment. Uses both the Order API (v4) and Product API (v3). Receives status webhooks (no signature — URL is the secret)."),
    bulletKV("Brevo", "transactional email (templates 1–6: confirmation, inProduction, inTransit, delivered, cancellation, welcome)."),
    bulletKV("Google Tag Manager (GTM-MHRPN2P3)", "loaded in Layout.astro head; all events flow through window.dataLayer"),
    bulletKV("Google AdSense (ca-pub-5797288699504998)", "ad slots embedded via the AdUnit.astro component"),
    bulletKV("Google OAuth", "Auth.js Google provider (AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET)"),
  );

  c.push(h1("4. Repository layout"));
  c.push(codeBlock(
    [
      "my-app/",
      "├── astro.config.mjs       Astro + React integration",
      "├── package.json           deps: astro, react, convex, @convex-dev/auth, stripe, sharp",
      "├── convex.json            Convex deployment config",
      "├── tsconfig.json",
      "├── public/                static assets, favicon, /samples/styles/* preview tiles",
      "├── scripts/",
      "│   └── download-gallery.mjs   admin-only export script using galleryExport.listAll",
      "├── convex/                BACKEND",
      "│   ├── schema.ts          tables: users, sessions, products, orders + auth tables",
      "│   ├── auth.ts            Convex Auth setup (Password + Google)",
      "│   ├── auth.config.ts     auth provider config (CONVEX_SITE_URL)",
      "│   ├── http.ts            HTTP router: Stripe + Gelato webhooks + auth routes",
      "│   ├── sessions.ts        anon session lifecycle, quiz save, gallery, regen budget",
      "│   ├── users.ts           me query, internal getInternal, welcome-email marker",
      "│   ├── files.ts           generateUploadUrl + getUrl (Convex file storage)",
      "│   ├── styleScoring.ts    quiz-answer → 10 styles ranking algorithm",
      "│   ├── fal.ts             Nano Banana + Aura SR + prompt construction (use node)",
      "│   ├── products.ts        product catalog CRUD + listing",
      "│   ├── productCopy.ts     personalised PDP / Stripe line description",
      "│   ├── seed.ts            seedV1Catalog: wipes products + reseeds 13 SKUs",
      "│   ├── cart.ts            session-scoped cart (add/remove/qty/clear/count)",
      "│   ├── orders.ts          createPending, markPaid, status, email markers",
      "│   ├── payments.ts        createCheckoutSession + handleStripeWebhook (use node)",
      "│   ├── gelato.ts          createOrder, fulfillConvexOrder, handleWebhook (use node)",
      "│   ├── brevo.ts           sendOrderConfirmation, sendStatusEmail, sendWelcome",
      "│   ├── galleryExport.ts   internal paginated export of every generated portrait",
      "│   └── probe.ts           one-off Gelato API probes (not used in production)",
      "└── src/",
      "    ├── layouts/Layout.astro        head, GTM, sticky footer, nav slot, footer slot",
      "    ├── components/",
      "    │   ├── Nav.astro               sticky nav, cart badge, auth widget",
      "    │   ├── Footer.astro",
      "    │   ├── AuthGate.tsx            React island used on /sign-up (Convex Auth UI)",
      "    │   ├── AdUnit.astro            AdSense slot wrapper",
      "    │   ├── ProductPreview.astro    'how it'll look' mock-up on PDP",
      "    │   └── Welcome.astro",
      "    ├── lib/",
      "    │   ├── client.ts               ConvexClient + session-id helpers + image protection",
      "    │   ├── authStorage.ts          vanilla bridge to Convex Auth JWT in localStorage",
      "    │   ├── analytics.ts            track / trackEcommerce / setUserId (GTM dataLayer)",
      "    │   ├── crop.ts                 browser-side 3:4 crop before upload",
      "    │   └── dogBreeds.ts            static list driving the breed autocomplete",
      "    ├── pages/                      file-based routing (see Doc 2)",
      "    │   ├── index.astro       /        landing",
      "    │   ├── upload.astro      /upload",
      "    │   ├── quiz.astro        /quiz",
      "    │   ├── style-pick.astro  /style-pick",
      "    │   ├── sign-up.astro     /sign-up",
      "    │   ├── generate.astro    /generate",
      "    │   ├── reveal.astro      /reveal",
      "    │   ├── pdp.astro         /pdp",
      "    │   ├── cart.astro        /cart",
      "    │   ├── shipping.astro    /shipping",
      "    │   ├── success.astro     /success",
      "    │   ├── gallery.astro     /gallery",
      "    │   ├── privacy.astro     /privacy",
      "    │   └── cookies.astro     /cookies",
      "    └── styles/global.css            tokens + global classes (.btn, .input, .progress, .protected-img, etc.)",
    ].join("\n"),
  ));

  c.push(h1("5. Environment variables"));
  c.push(
    table(
      [2400, 1200, 5760],
      ["Variable", "Where", "Purpose"],
      [
        ["PUBLIC_CONVEX_URL", "Astro/.env", "Convex deployment URL exposed to the browser. Read by client.ts and authStorage.ts."],
        ["CONVEX_SITE_URL", "Convex env", "Used as the Convex Auth provider domain (auth.config.ts)."],
        ["FAL_KEY", "Convex env", "fal.ai API key. Used by every Nano Banana + Aura SR call in fal.ts."],
        ["STRIPE_SECRET_KEY", "Convex env", "Stripe secret. Used for both checkout session creation and webhook signature verification."],
        ["STRIPE_WEBHOOK_SECRET", "Convex env", "Stripe webhook signing secret. Verified before handleStripeWebhook acts on the payload."],
        ["GELATO_API_KEY", "Convex env", "Gelato API key. Used by gelato.ts (orders + catalog) and brevo.ts (tracking lookup)."],
        ["BREVO_API_KEY", "Convex env", "Brevo API key. Used by every transactional email send."],
        ["AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET", "Convex env", "Google OAuth credentials for the Auth.js Google provider in auth.ts."],
        ["JWT_PRIVATE_KEY / SITE_URL etc.", "Convex env", "Standard Convex Auth env vars (set up by `npx @convex-dev/auth` init)."],
      ],
    ),
  );

  c.push(h1("6. Build, dev, and deployment"));
  c.push(
    table(
      [2200, 7160],
      ["Command", "What it does"],
      [
        ["npm run dev", "Start Astro dev server (default: localhost:4321). Run convex dev separately to keep the backend in sync."],
        ["npx convex dev", "Run the Convex deployment in watch mode (regenerates _generated/, syncs schema, hot-reloads functions)."],
        ["npm run build", "Astro production build to ./dist/ (static + script bundles)."],
        ["npm run preview", "Preview the production build locally."],
        ["npx convex run seed:seedV1Catalog", "Wipe and reseed the products table with the 13-SKU V1 catalog."],
        ["npx convex run fal:ping", "Smoke-test the fal connection (cheap, generates a tiny image)."],
        ["npx convex run gelato:ping", "Hit Gelato Order API to confirm key works."],
      ],
    ),
  );

  c.push(h1("7. Conventions"));
  c.push(
    bullet("Pages are Astro markup + a single <script> island. Avoid React unless a third-party UI requires it (currently only the Convex Auth UI on /sign-up)."),
    bullet("Backend code that calls third-party APIs lives in 'use node' files (fal.ts, payments.ts, gelato.ts, brevo.ts, seed.ts, probe.ts). Database-only code (schema mutations, queries) does not."),
    bullet("Public Convex functions are queries/mutations/actions; webhook + scheduler-only code uses internalQuery/internalMutation/internalAction."),
    bullet("All third-party calls are idempotent or guarded by an *At marker on the relevant row (welcomeEmailSentAt, confirmationEmailSentAt, printFileHiResUpscaledAt, etc.). Webhooks can re-fire without doubling work."),
    bullet("Strict server-side pricing and cart re-validation: the client never sends prices to Stripe; payments.ts re-reads each line from the products table."),
    bullet("Identifiers in localStorage: purrtraits.sessionId (Convex session id), __convexAuthJWT_<ns>, __convexAuthRefreshToken_<ns>, purrtraits.pendingAuth (transient, OAuth round trip)."),
  );

  return makeDoc(title, subtitle, c);
}

// ============================================================================
// DOC 2 — User Journey & Page Inventory
// ============================================================================

function doc2() {
  const title = "User Journey & Page Inventory";
  const subtitle = "What every page does, what it reads and writes, and how the user moves between them";
  const c = [];
  c.push(...titleBlock(title, subtitle));

  c.push(h1("1. The happy path"));
  c.push(
    p(
      "A first-time visitor lands on / (anonymous, no session). They click \"Create my portrait\" and proceed through the funnel below. The Convex session is created lazily at first photo upload, so a casual homepage visit doesn't pollute the table.",
    ),
  );
  c.push(
    numbered("/ — landing. Hero, how-it-works strip, sample gallery, social proof. Single CTA: Create My Portrait → /upload."),
    numbered("/upload — pet photos. Creates the Convex session on first upload, stores files in Convex storage, captures URLs on the session row. Continue → /quiz."),
    numbered("/quiz — 7-step personality quiz. Saves answers + computes rankedStyles in one mutation. Continue → /style-pick."),
    numbered("/style-pick — picker showing all 10 art styles. Top 3 by quiz score are pre-selected. User must end up with exactly 3. Continue → /sign-up?next=/generate (or → /generate if already authed)."),
    numbered("/sign-up — auth gate. React island (AuthGate.tsx) with Password + Google. Stamps the user's id onto the existing anonymous session. Auto-redirects to ?next= on success."),
    numbered("/generate — calls fal.generatePortraits action. Renders shimmer cards while the 3 styles render in parallel (~30s). On success → /reveal."),
    numbered("/reveal — shows the 3 portraits. Regenerate button (consumes 1 from the regen budget). Pick one → saves selectedStyle → /pdp."),
    numbered("/pdp — product detail page for the selected portrait. Format tabs (digital / poster / framed / canvas), size + frame variants. Add to cart → /cart."),
    numbered("/cart — cart review. Subtotal + flat $30 shipping if any physical line. Proceed to checkout → Stripe-hosted Checkout."),
    numbered("Stripe Checkout (off-site) — collects email, shipping, phone, payment. On success redirects to /success?session_id=<stripe_id>."),
    numbered("/success — polls for the order, shows upscale-in-progress state, then renders the carousel of purchased portraits, downloads list, status tracker (physical orders), and order meta."),
  );

  c.push(spacer());
  c.push(h1("2. Auth gate placement"));
  c.push(
    p(
      "Auth is required only from /generate onward — uploading photos and taking the quiz stay anonymous so the funnel doesn't dead-end on a sign-up wall before the user has invested anything. The gate sits between /style-pick and /generate. The session that was started anonymously is stamped with the new user's id by linkSessionToUser as soon as the AuthGate component sees isAuthenticated flip to true.",
    ),
  );

  c.push(h1("3. Out-of-regens detour"));
  c.push(
    p(
      "Each user has a regenerations budget (default 3, refilled to 3 on every successful purchase). When a signed-in user lands on /upload with regensRemaining = 0, the upload UI is replaced with a card directing them to /gallery to buy from a previous portrait. This block is enforced before any photo is touched so the user can't get partway through the flow only to fail at /generate.",
    ),
  );

  c.push(h1("4. Page reference"));
  c.push(
    p("Each row below summarises one page in src/pages/."),
  );
  c.push(
    table(
      [1500, 1100, 2700, 4060],
      ["Path", "Auth", "Reads from session/user", "Writes / actions"],
      [
        ["/", "anon", "—", "Static. Single CTA → /upload."],
        ["/upload", "anon (gated for authed users at 0 regens)", "user.regensRemaining (if signed in)", "ensureSession; files.generateUploadUrl + sessions.addPhoto per file. Continue → /quiz."],
        ["/quiz", "anon", "—", "Local in-memory state per step. Single mutation sessions.saveQuiz at the end (also computes + stores rankedStyles)."],
        ["/style-pick", "anon", "session.quizAnswers, session.rankedStyles", "sessions.setSelectedStyles (3-style array). Continue → /sign-up?next=/generate."],
        ["/sign-up", "anon → authed", "—", "Convex Auth password or Google. linkSessionToUser stamps user on existing session. Honors ?next=. Fires GA4 sign_up / login events."],
        ["/generate", "authed", "session.petPhotoUrls, session.quizAnswers, session.selectedStyles", "fal.generatePortraits (consumes 1 regen, refunds on failure). Writes generations + galleryItems. → /reveal."],
        ["/reveal", "authed", "session.generations, user.regensRemaining", "Regenerate button → fal.regenerate. Pick one → sessions.selectStyle. Continue → /pdp."],
        ["/pdp", "anon (the cart is per-session, no auth needed)", "session.selectedStyle, session.generations[].imageUrl/printFileUrl, products.list", "cart.addItem. Continue → /cart."],
        ["/cart", "anon", "cart.getWithProducts (joined product info, server-computed totals)", "cart.updateQuantity, cart.removeItem, cart.clear. Checkout → payments.createCheckoutSession → Stripe URL."],
        ["/success", "authed (effectively — order links require it)", "orders.getByStripeSession", "Polls until printFileHiResUpscaledAt is set. Shows downloads + tracker."],
        ["/gallery", "anon OR authed", "session.galleryItems OR sessions.getUserGallery (cross-session for authed)", "sessions.useFromGallery / useFromUserGallery to make a chosen item the 'current' generation, then → /pdp."],
        ["/shipping", "anon", "—", "Static FAQ-style page about Gelato shipping windows and tracking."],
        ["/privacy", "anon", "—", "Static legal."],
        ["/cookies", "anon", "—", "Static legal."],
      ],
    ),
  );

  c.push(spacer());
  c.push(h1("5. Page-level redirect rules"));
  c.push(
    bullet("/upload, /quiz, /style-pick, /generate, /reveal, /pdp, /gallery (anon mode) all use requireOrRedirect from client.ts. Missing prerequisite (e.g. no session, no quiz answers) bounces back to /upload or /quiz."),
    bullet("/generate redirects to /upload if there are no photos, /quiz if there are photos but no answers, /style-pick if there are no selected styles."),
    bullet("/reveal redirects to /sign-up?next=/reveal if a returning visitor lands without an auth token."),
    bullet("/style-pick falls back to scoring on the client if the saved rankedStyles array is missing (handles older sessions whose schema didn't have it)."),
  );

  c.push(h1("6. Cross-page state"));
  c.push(
    p(
      "All multi-page state lives on a single Convex sessions row, keyed by an id kept in localStorage under purrtraits.sessionId. After sign-in, the row is also stamped with userId so the same data is reachable from any device once the user signs in there.",
    ),
  );
  c.push(
    bulletKV("petPhotoUrls", "set on /upload, read by /generate"),
    bulletKV("quizAnswers", "set on /quiz, read by /style-pick, /generate, /pdp, /gallery, /reveal"),
    bulletKV("rankedStyles", "set on /quiz (server-side in saveQuiz), read by /style-pick"),
    bulletKV("selectedStyles", "set on /style-pick, read by /generate"),
    bulletKV("generations", "set by fal.generatePortraits, read by /reveal, /pdp, /generate"),
    bulletKV("selectedStyle", "set on /reveal, read by /pdp"),
    bulletKV("galleryItems", "appended every time a generation lands; read by /gallery"),
    bulletKV("cart", "set on /pdp via cart.addItem; read by /cart and the Stripe Checkout action"),
  );

  c.push(h1("7. Analytics events fired from the funnel"));
  c.push(
    bulletKV("quiz_start", "Once per quiz page load"),
    bulletKV("quiz_step_complete", "On every Next click, with step_number, step_name, answer"),
    bulletKV("quiz_complete", "When the final step is submitted, with activity/mood/lifestyle/room"),
    bulletKV("styles_suggested", "On /style-pick, with the top 3 server-side ranked styles"),
    bulletKV("generation_started", "On /generate before the fal action fires, with the chosen styles"),
    bulletKV("portrait_viewed", "On /reveal, once per style per page load"),
    bulletKV("regen_clicked / regen_limit_reached", "Regen budget telemetry"),
    bulletKV("portrait_selected", "When the user clicks a card on /reveal"),
    bulletKV("view_item / add_to_cart / view_cart / begin_checkout / purchase", "GA4 ecommerce events fired from /pdp, /cart, and /success via trackEcommerce"),
    bulletKV("sign_up / login / user_data", "Fired by AuthGate.tsx and Layout.astro respectively"),
  );

  return makeDoc(title, subtitle, c);
}

// ============================================================================
// DOC 3 — Convex Backend Reference
// ============================================================================

function doc3() {
  const title = "Convex Backend Reference";
  const subtitle = "Every function in convex/, by file";
  const c = [];
  c.push(...titleBlock(title, subtitle));

  c.push(h1("1. Reading this doc"));
  c.push(
    p(
      "Each file gets its own section. Functions are listed in source order. \"Kind\" tells you whether it's exposed to the browser (query / mutation / action) or only callable from other server code (internalQuery / internalMutation / internalAction). \"Use node\" indicates the file uses the Node runtime (necessary for npm packages like sharp and stripe).",
    ),
  );

  function fnTable(rows) {
    return table(
      [2200, 1500, 5660],
      ["Function", "Kind", "What it does"],
      rows,
    );
  }

  c.push(h1("2. convex/sessions.ts"));
  c.push(
    p("Owns the anonymous session row and everything attached to it (photos, quiz, generations, gallery, cart). Heavily indexed by_userId so a logged-in user can fan out across every session they own."),
  );
  c.push(
    fnTable([
      ["create", "mutation", "Inserts a new sessions row. If a user is already signed in, stamps userId immediately so downstream rows belong to them."],
      ["get", "query", "Public single-session read. The page-level data fetcher."],
      ["getInternal", "internalQuery", "Server-side read used by fal.ts and other actions."],
      ["linkSessionToUser", "mutation", "Stamps the calling user onto an anonymous session. Idempotent. No-op if the session already belongs to a different user (defensive)."],
      ["linkSessionToUserInternal", "internalMutation", "Same as above, callable from actions where userId was already resolved via getAuthUserId."],
      ["getMyRegensRemaining", "query", "Returns the calling user's regen budget (default 3 if unset). null if not signed in."],
      ["getUserGallery", "query", "Returns every gallery item across every session the user owns, stamped with sourceSessionId + per-session index, sorted newest-first."],
      ["addPhoto", "mutation", "Appends a storageId + URL to the session's photo arrays."],
      ["removePhoto", "mutation", "Removes a photo by index and best-effort deletes the underlying storage object."],
      ["saveQuiz", "mutation", "Saves quizAnswers AND computes + stores rankedStyles in the same transaction."],
      ["selectStyle", "mutation", "Sets the single selectedStyle (used after the user picks a portrait on /reveal)."],
      ["setSelectedStyles", "mutation", "Sets the 3-style selection from /style-pick. Throws if the array isn't exactly length 3."],
      ["setGenerationStatus", "internalMutation", "Updates generationStatus + generationError. Driven by the fal action."],
      ["setGenerations", "internalMutation", "Writes the array of { style, imageUrl, printFileUrl } and flips status to 'ready'."],
      ["consumeRegen", "internalMutation", "Atomic check-and-deduct. Throws OUT_OF_REGENS if the user is at zero. Returns the new remaining count."],
      ["refundRegen", "internalMutation", "Adds 1 back to the budget. Called when generation throws."],
      ["resetRegens", "internalMutation", "Resets to 3. Called from the Stripe webhook on every successful purchase."],
      ["appendGalleryItems", "internalMutation", "Adds the latest generations (with activity/mood/petName context) to galleryItems for permanent recall."],
      ["useFromGallery", "mutation", "Promotes a single gallery item back into 'current' generations + selectedStyle. Same-session variant."],
      ["useFromUserGallery", "mutation", "Cross-session variant. Verifies user owns both source and target sessions, then copies the item across."],
      ["clearCurrentFlow", "mutation", "Resets photos, quiz, generations, selections back to empty so the user can start fresh from /upload without losing the gallery."],
      ["deletePetPhotos", "internalMutation", "Frees Convex storage for the originals. Called once a user has run out of regens — the photos can't be reused, no point paying for storage."],
    ]),
  );

  c.push(h1("3. convex/users.ts"));
  c.push(
    fnTable([
      ["me", "query", "Cheap 'who am I' lookup returning { _id, email, name, image }. Used by Nav and /gallery."],
      ["getInternal", "internalQuery", "Full user doc for server-side use by brevo.sendWelcome."],
      ["markWelcomeEmailSent", "internalMutation", "Stamps welcomeEmailSentAt so a retried createOrUpdateUser can't double-send."],
    ]),
  );

  c.push(h1("4. convex/auth.ts and convex/auth.config.ts"));
  c.push(
    p(
      "Wires up Convex Auth with two providers: Password (no email verification step — deliberate, for a frictionless end-of-quiz signup) and Google OAuth (Auth.js Google provider). Exports the canonical { auth, signIn, signOut, store, isAuthenticated }.",
    ),
  );
  c.push(
    bullet("createOrUpdateUser callback initializes regensRemaining = 3 the first time a user is seen, and schedules brevo.sendWelcome (fire-and-forget so a Brevo outage doesn't block sign-up)."),
    bullet("auth.config.ts exposes the deployment URL as a JWT issuer domain so the auth library can verify tokens it issued."),
  );

  c.push(h1("5. convex/http.ts"));
  c.push(
    fnTable([
      ["/api/auth/* (via auth.addHttpRoutes)", "httpAction (Convex Auth)", "Sign-in, OAuth callback, refresh token routes."],
      ["/stripe/webhook POST", "httpAction", "Reads the raw body + signature header, hands off to internal payments.handleStripeWebhook for verification + processing. 400 on missing header, 400 on processing failure (so Stripe retries)."],
      ["/gelato/webhook POST", "httpAction", "Parses JSON, hands off to internal gelato.handleWebhook. Authenticity relies on URL secrecy — Gelato does not currently sign webhooks."],
    ]),
  );

  c.push(h1("6. convex/files.ts"));
  c.push(
    fnTable([
      ["generateUploadUrl", "mutation", "Returns a one-time signed URL the browser POSTs the file to."],
      ["getUrl", "query", "Resolves a storageId to a public URL Gelato can fetch."],
    ]),
  );

  c.push(h1("7. convex/styleScoring.ts"));
  c.push(
    p(
      "Pure module: no Convex functions, just exports. ALL_STYLES, STYLE_LABELS, STYLE_BLURBS, QuizAnswers type, and scoreStyles(answers). See the Quiz doc and the AI Pipeline doc for the scoring tables.",
    ),
  );

  c.push(h1("8. convex/fal.ts ('use node')"));
  c.push(
    p("All AI generation goes through here. See the AI Pipeline doc for prompt construction and pipeline detail."),
  );
  c.push(
    fnTable([
      ["generatePortraits", "action", "Top-level entry from /generate. Requires auth. Consumes 1 regen, fans out 3 parallel Nano Banana calls, persists outputs, refunds on failure."],
      ["regenerate", "action", "Same as generatePortraits but defaults to re-painting the same styles the user just saw. Driven by /reveal."],
      ["upscaleAndFulfil", "internalAction", "Order-time pipeline. Walks the order's lineItems, 4×-upscales each unique source image via Aura SR, persists to Convex storage, then fires the confirmation email + Gelato dispatch. Idempotent on order.printFileHiResUpscaledAt."],
      ["ping", "action", "Smoke test: generates one tiny image to confirm FAL_KEY works."],
    ]),
  );

  c.push(h1("9. convex/products.ts"));
  c.push(
    fnTable([
      ["list", "query", "All active products. Drives /pdp."],
      ["getInternal", "internalQuery", "Single product by id. Used by gelato.ts."],
      ["listInternalForMockups", "internalQuery", "All products (incl. inactive). Stays around for mockup tooling."],
      ["insertInternal", "internalMutation", "Insert one product. Called by the seed action."],
      ["wipeAllInternal", "internalMutation", "Deletes every product row. Called by the seed action."],
      ["setPrintFileForAll", "mutation", "Dev-only: stamps the same printFileUrl onto every product (used during the early single-artwork prototype)."],
    ]),
  );

  c.push(h1("10. convex/productCopy.ts"));
  c.push(
    p(
      "Pure module exporting formatProductDescription(product, petName, breed). The PDP and the Stripe Checkout line item both call this so on-site and on-Stripe copy stays in lockstep. Includes the dimension table and per-format hand-written marketing copy.",
    ),
  );

  c.push(h1("11. convex/seed.ts ('use node')"));
  c.push(
    fnTable([
      ["seedV1Catalog", "action", "Wipes products and re-inserts the V1 catalog: 1 digital SKU + 3 posters + 6 framed posters (3 sizes × 2 frame colours) + 3 canvas SKUs = 13 SKUs total. For each physical SKU it queries Gelato Product API to resolve the productUid by attribute filters."],
    ]),
  );

  c.push(h1("12. convex/cart.ts"));
  c.push(
    fnTable([
      ["addItem", "mutation", "Adds or merges a line into session.cart. Merges on (productId, printFileUrl). Digital lines pinned to qty 1."],
      ["updateQuantity", "mutation", "Sets quantity for line at index. Refuses to update digital lines."],
      ["removeItem", "mutation", "Splices the line out by index."],
      ["clear", "mutation", "Empties session.cart."],
      ["getWithProducts", "query", "Returns cart joined with product docs, plus server-computed subtotalCents/shippingCents/totalCents/unitCount/physicalCount. Drops orphaned lines whose product was deleted/deactivated."],
      ["getInternalForCheckout", "internalQuery", "Server-side equivalent for payments.createCheckoutSession. Each item carries petName + breed inline for per-line description rendering."],
      ["clearInternal", "internalMutation", "Clears the cart from the Stripe webhook on successful payment."],
      ["count", "query", "Cheap badge count for the nav (sums quantities, not lines)."],
    ]),
  );

  c.push(h1("13. convex/orders.ts"));
  c.push(
    fnTable([
      ["createPending", "internalMutation", "Pre-creates a 'pending' order keyed off the Stripe session id at checkout-creation time. Cart is snapshotted into lineItems so the webhook can rely on it even if the cart later changed. Inherits userId from the originating session."],
      ["markPaid", "internalMutation", "Webhook fills in amountTotal/currency/customerEmail/shipping and flips status from 'pending' to 'paid'. Idempotent on stripeSessionId — already-paid orders short-circuit."],
      ["getInternal / getInternalWithProducts", "internalQuery", "Single order; the second variant joins each line with its product doc for the confirmation email."],
      ["hasPhysicalLines", "internalQuery", "Webhook helper — does this order need Gelato fulfilment?"],
      ["getByStripeSession", "query", "Public read used by /success."],
      ["setFulfilling", "internalMutation", "Stamps gelatoOrderId + status='fulfilling' once the Gelato order create returns."],
      ["setStatus / setStatusByGelatoId", "internalMutation", "Direct status patches; the latter looks up by Gelato id (used by the Gelato webhook)."],
      ["setUpscaledLineItems / setUpscaledLegacyPrintUrl", "internalMutation", "After fal.upscaleAndFulfil swaps each printFileUrl to the high-res file, also stamps printFileHiResUpscaledAt for idempotency."],
      ["list", "query", "Most-recent 50 orders (admin/debug)."],
      ["getByGelatoIdInternal", "internalQuery", "Used by the Gelato webhook to find the matching order before sending status emails."],
      ["markEmailSent", "internalMutation", "Stamps {stage}EmailSentAt so duplicate webhooks don't re-fire emails."],
    ]),
  );

  c.push(h1("14. convex/payments.ts ('use node')"));
  c.push(
    fnTable([
      ["createCheckoutSession", "action", "Builds a Stripe Checkout session from the cart. Server re-prices every line. Pre-creates a pending order via orders.createPending. Returns the Stripe URL the browser should redirect to."],
      ["handleStripeWebhook", "internalAction", "Verifies the signature, on checkout.session.completed: marks the order paid (markPaid), refills the buyer's regen budget, clears the cart, then schedules upscaleAndFulfil (which in turn schedules confirmation email + Gelato dispatch)."],
    ]),
  );

  c.push(h1("15. convex/gelato.ts ('use node')"));
  c.push(
    fnTable([
      ["ping / listCatalogs / searchCatalog / getProduct", "action", "Catalog tooling. Used during dev to look up Gelato productUids."],
      ["createOrder", "internalAction", "Generic helper for creating a Gelato order from explicit args (not currently used in the live flow)."],
      ["fulfillConvexOrder", "internalAction", "Production order fulfilment. Walks the order's physical lineItems, builds the Gelato payload (skipping digital lines), POSTs to /v4/orders, and stamps the resulting gelatoOrderId on our order."],
      ["handleWebhook", "internalAction", "Routes incoming Gelato events. On order_status_updated maps the fulfillmentStatus to one of inProduction / inTransit / delivered / canceled, fetches tracking info for inTransit, and schedules the matching Brevo email."],
    ]),
  );

  c.push(h1("16. convex/brevo.ts ('use node')"));
  c.push(
    fnTable([
      ["sendOrderConfirmation", "internalAction", "Fired right after Stripe webhook marks the order paid. Renders Brevo template 1 with the line items, dedupes digital download URLs, and stamps confirmationEmailSentAt."],
      ["sendStatusEmail", "internalAction", "Fires templates 2/3/4/5 for inProduction/inTransit/delivered/canceled. Reads the per-stage *EmailSentAt to short-circuit duplicates."],
      ["sendWelcome", "internalAction", "Template 6. Scheduled (not awaited) from auth.createOrUpdateUser the first time a user signs up."],
      ["fetchGelatoTracking", "internalAction", "GET /v4/orders/{id} on Gelato; pulls tracking URL/code/carrier from the order shipment or first item fulfillment. Used by handleWebhook for inTransit."],
    ]),
  );

  c.push(h1("17. convex/galleryExport.ts and convex/probe.ts"));
  c.push(
    bullet("galleryExport.listAll — paginated internalQuery walking every session and flattening every generated portrait into one row stamped with activity/mood/petName. Used by scripts/download-gallery.mjs as a one-off admin export."),
    bullet("probe.ts — three actions that hit Gelato e-commerce endpoints (gelatoStoreFlow, gelatoCreateProduct, gelatoListProducts, gelatoGetProduct). Not used by the live flow; kept around for poking the API."),
  );

  c.push(h1("18. Function visibility cheat-sheet"));
  c.push(
    table(
      [2400, 6960],
      ["Visibility", "When to use"],
      [
        ["query / mutation / action", "Browser-callable. Always validate input via v.* validators."],
        ["internalQuery / internalMutation / internalAction", "Only callable from other server code via ctx.runQuery / ctx.runMutation / ctx.runAction or ctx.scheduler. Used for webhook handlers, cron-style schedules, and helpers that should not be exposed publicly (e.g. setGenerations, consumeRegen, markPaid)."],
        ["httpAction (in http.ts)", "External webhook entry points (Stripe, Gelato) and the auth library's HTTP routes."],
      ],
    ),
  );

  return makeDoc(title, subtitle, c);
}

// ============================================================================
// DOC 4 — Data Model & Schema
// ============================================================================

function doc4() {
  const title = "Data Model & Schema";
  const subtitle = "Tables, fields, indexes, and how rows relate to each other";
  const c = [];
  c.push(...titleBlock(title, subtitle));

  c.push(h1("1. Overview"));
  c.push(
    p(
      "Four app tables (users, sessions, products, orders) plus the Convex Auth tables (authAccounts, authSessions, authVerificationCodes, etc.) injected via authTables. The full definition lives in convex/schema.ts. Every document is validated against its table validator at write time, so app-level fields must be declared in the schema rather than just patched in.",
    ),
  );

  c.push(h1("2. Entity-relationship overview"));
  c.push(codeBlock(
    [
      "users  ─────────┐",
      "  _id, email     │ 1 — many",
      "  regensRemaining│",
      "                 ▼",
      "             sessions ◄──────── localStorage purrtraits.sessionId",
      "               _id                              (anonymous client key)",
      "               userId  (optional, stamped on sign-up or session create)",
      "               petPhotoStorageIds[]   ──► _storage",
      "               quizAnswers {…}",
      "               rankedStyles[]  (style-pick pre-selection)",
      "               selectedStyles[] (3 chosen styles)",
      "               generations[]   (current 3 portraits)",
      "               galleryItems[]  (history across regens)",
      "               cart[]          (in-progress cart lines)",
      "                 │ each cart line:",
      "                 │   productId  ──► products._id",
      "                 ▼",
      "             orders",
      "               _id, stripeSessionId (unique)",
      "               sessionId  ──► sessions._id",
      "               userId     ──► users._id",
      "               lineItems[] each with productId ──► products",
      "               gelatoOrderId (stamped after fulfillment dispatch)",
      "",
      "products (catalog)",
      "  _id, format ∈ {digital, poster, framed, canvas}",
      "  size ∈ {small, medium, large}, frame ∈ {natural-wood, dark-wood}",
      "  gelatoProductUid (resolved at seed time via Gelato Product API)",
      "  priceCents, currency, active",
    ].join("\n"),
  ));

  c.push(h1("3. users"));
  c.push(
    p(
      "Standard Convex Auth shape (name, image, email, emailVerificationTime, phone, phoneVerificationTime, isAnonymous) plus two app-specific fields:",
    ),
  );
  c.push(
    table(
      [2200, 1500, 5660],
      ["Field", "Type", "Notes"],
      [
        ["regensRemaining", "number?", "Generation budget. Default 3 on createOrUpdateUser, reset to 3 on every successful purchase."],
        ["welcomeEmailSentAt", "number?", "Timestamp stamped the moment Brevo welcome email send succeeds. Idempotency guard."],
      ],
    ),
  );
  c.push(p("Indexes: by email, by phone."));

  c.push(h1("4. sessions"));
  c.push(
    p(
      "Anonymous client session — created lazily on first photo upload, id kept in localStorage. Stamped with userId on sign-up.",
    ),
  );
  c.push(
    table(
      [2400, 1700, 5260],
      ["Field", "Type", "Notes"],
      [
        ["userId", "Id<\"users\">?", "Set at session creation if a user is already signed in, or by linkSessionToUser at the auth gate."],
        ["petPhotoStorageIds", "Id<\"_storage\">[]?", "Parallel to petPhotoUrls. Multiple photos = better likeness from Nano Banana."],
        ["petPhotoUrls", "string[]?", "Public URLs for the uploaded photos. What's actually sent to fal."],
        ["quizAnswers", "object?", "{ name?, breed?, age?, lifestyle?, activity, mood, room }. activity/mood/room required at save time."],
        ["generations", "object[]?", "Current set of generated portraits: { style, imageUrl, printFileUrl? }. Replaced on every regenerate. Updated again at order time when printFileUrl is patched to the high-res Aura SR output."],
        ["generationStatus", "literal union?", "idle | generating | ready | failed."],
        ["generationError", "string?", "Last error message. Surfaced on /generate."],
        ["selectedStyle", "string?", "Single chosen style (set on /reveal, used by /pdp)."],
        ["rankedStyles", "string[]?", "All 10 style IDs, sorted highest score first. Computed by saveQuiz."],
        ["selectedStyles", "string[]?", "The 3 styles to render — set by /style-pick, consumed by /generate."],
        ["regensRemaining", "number?", "Legacy: budget used to live here. Now lives on users; this column is kept optional for old rows."],
        ["galleryItems", "object[]?", "Append-only history. Each item: { style, imageUrl, printFileUrl?, activity?, mood?, petName?, createdAt }."],
        ["cart", "object[]?", "Anonymous cart, scoped to this session. Each line: { productId, printFileUrl, displayUrl?, style, petName?, quantity, addedAt }. Lines merge by (productId, printFileUrl)."],
      ],
    ),
  );
  c.push(p("Indexes: by_userId."));

  c.push(h1("5. products"));
  c.push(
    p(
      "Static-ish catalog. Seeded by convex/seed.ts → seedV1Catalog with 13 SKUs. Re-runnable; wipes and reseeds.",
    ),
  );
  c.push(
    table(
      [2200, 2400, 4760],
      ["Field", "Type", "Notes"],
      [
        ["name", "string", "User-facing name, e.g. 'Framed Poster (Natural Wood) — Medium'."],
        ["description", "string?", "Currently unused at runtime — descriptions are rendered per-customer by productCopy.formatProductDescription so they can interpolate pet name + breed."],
        ["format", "'digital' | 'poster' | 'framed' | 'canvas'", "Drives PDP tab grouping and whether shipping is collected."],
        ["size", "'small' | 'medium' | 'large'", "Maps to dimensions in productCopy.ts: 12×16, 18×24, 24×32 inches. Digital uses 'small' as a placeholder."],
        ["frame", "'natural-wood' | 'dark-wood' (optional)", "Set only on framed SKUs."],
        ["gelatoProductUid", "string?", "Resolved at seed time via Gelato Product API search. Optional because digital SKUs don't have one."],
        ["priceCents", "number", "Always in cents (USD). See seed.ts PRICES table."],
        ["currency", "string", "Always 'usd' currently."],
        ["printFileUrl", "string?", "Legacy — used in the early single-artwork prototype. Modern flow stores the print URL on the order line, not the product."],
        ["active", "boolean", "Hide deactivated SKUs from /pdp without deleting them."],
      ],
    ),
  );
  c.push(p("Indexes: by_format, by_active."));

  c.push(h1("6. orders"));
  c.push(
    p(
      "One row per Stripe Checkout session. Pre-created in 'pending' status when the user clicks Checkout, filled in by the Stripe webhook on payment success.",
    ),
  );
  c.push(
    table(
      [2400, 2000, 4960],
      ["Field", "Type", "Notes"],
      [
        ["userId", "Id<\"users\">?", "Inherited from the originating session at createPending."],
        ["productId", "Id<\"products\">?", "Legacy single-product field. New orders use lineItems."],
        ["sessionId", "Id<\"sessions\">?", "Source session."],
        ["stripeSessionId", "string", "Idempotency key for the webhook. Indexed by_session."],
        ["amountTotal", "number", "Stripe-confirmed total in cents."],
        ["currency", "string", "Lowercase ISO code (Stripe convention)."],
        ["customerEmail", "string?", "From Stripe customer_details.email."],
        ["printFileUrl", "string?", "Legacy single-product print URL."],
        ["selectedStyle", "string?", "Convenience copy (also present per-line on lineItems)."],
        ["lineItems", "object[]?", "Snapshot of cart at checkout time: { productId, printFileUrl, displayUrl?, style, petName?, quantity, unitPriceCents }. Patched by upscaleAndFulfil to swap printFileUrl for the high-res version."],
        ["petName", "string?", "Collapsed onto the order itself for support refs."],
        ["shipping", "object?", "{ name, phone?, addressLine1, addressLine2?, city, postCode, state?, country }."],
        ["status", "string", "pending | paid | fulfilling | fulfilled | failed | (Gelato-passed string)."],
        ["gelatoOrderId", "string?", "Stamped after Gelato order create. Indexed by_gelato."],
        ["printFileHiResUpscaledAt", "number?", "Idempotency marker. Set by upscaleAndFulfil after the 4× Aura SR + Convex storage round-trip."],
        ["confirmationEmailSentAt etc.", "number?", "Per-stage idempotency markers (confirmation, inProduction, inTransit, delivered, canceled)."],
      ],
    ),
  );
  c.push(p("Indexes: by_session (stripeSessionId), by_gelato (gelatoOrderId), by_userId."));

  c.push(h1("7. Convex Auth tables"));
  c.push(
    p(
      "Injected by `...authTables` in schema.ts. The relevant ones from app code are users (overridden above to add app fields) and the standard authAccounts / authSessions / authVerificationCodes / authVerifiers / authRefreshTokens — used by Convex Auth internally and not touched directly by app code. Sign-in flows write through @convex-dev/auth's helpers; the only app-level write to users.* is in createOrUpdateUser (auth.ts).",
    ),
  );

  c.push(h1("8. Lifecycle of a session row"));
  c.push(
    numbered("Created in sessions.create on first photo upload (or on landing if a user is already signed in)."),
    numbered("petPhotoUrls populated by sessions.addPhoto (one mutation per file)."),
    numbered("quizAnswers + rankedStyles set together in sessions.saveQuiz."),
    numbered("selectedStyles set by sessions.setSelectedStyles on /style-pick."),
    numbered("userId stamped by sessions.linkSessionToUser at the /sign-up gate (or at create time for already-signed-in users)."),
    numbered("generations + generationStatus updated by fal.generatePortraits (and again by fal.regenerate)."),
    numbered("galleryItems appended by every successful generation (sessions.appendGalleryItems)."),
    numbered("selectedStyle set by sessions.selectStyle on /reveal."),
    numbered("cart accumulated by cart.addItem etc."),
    numbered("petPhotoStorageIds and the underlying _storage entries deleted by sessions.deletePetPhotos once the user has used all their regens."),
  );

  c.push(h1("9. Lifecycle of an order row"));
  c.push(
    numbered("payments.createCheckoutSession runs orders.createPending: a row is inserted with status='pending', stripeSessionId, lineItems snapshot, sessionId, userId."),
    numbered("Customer pays on Stripe-hosted Checkout."),
    numbered("Stripe POSTs /stripe/webhook → payments.handleStripeWebhook → orders.markPaid sets status='paid', amountTotal, customerEmail, shipping."),
    numbered("Same webhook schedules fal.upscaleAndFulfil. That action upscales each unique source image, patches lineItems via orders.setUpscaledLineItems, and stamps printFileHiResUpscaledAt."),
    numbered("Then upscaleAndFulfil schedules brevo.sendOrderConfirmation (sets confirmationEmailSentAt) and, for physical orders, gelato.fulfillConvexOrder."),
    numbered("fulfillConvexOrder POSTs /v4/orders to Gelato and stores the resulting id via orders.setFulfilling (status='fulfilling')."),
    numbered("Gelato POSTs /gelato/webhook with order_status_updated. handleWebhook updates status, then schedules brevo.sendStatusEmail (with tracking for inTransit)."),
    numbered("Each email send sets the matching {stage}EmailSentAt so duplicate webhooks no-op."),
  );

  return makeDoc(title, subtitle, c);
}

// ============================================================================
// DOC 5 — AI Generation Pipeline
// ============================================================================

function doc5() {
  const title = "AI Generation Pipeline";
  const subtitle = "How a quiz answer + a photo become a print-ready portrait";
  const c = [];
  c.push(...titleBlock(title, subtitle));

  c.push(h1("1. Models in use"));
  c.push(
    table(
      [2200, 1700, 5460],
      ["Model", "Endpoint", "Role"],
      [
        ["Nano Banana (Gemini 2.5 Flash Image — edit mode)", "fal-ai/nano-banana/edit on fal.ai", "The actual style transfer. Takes 1+ reference images + a text prompt + aspect_ratio:'3:4' and returns one styled image (~1024px long edge) preserving the pet's identity."],
        ["Aura SR", "fal-ai/aura-sr on fal.ai", "Fast 4× super-resolution. Output ~4096px on the long edge — enough for ~13\" at 300 DPI or 27\" at 150 DPI (Gelato's minimum for art prints). ~$0.02/image, run only after a successful purchase."],
      ],
    ),
  );

  c.push(h1("2. End-to-end flow"));
  c.push(
    numbered("/upload — browser side: cropToAspect (src/lib/crop.ts) center-crops every uploaded file to 3:4 and caps the long edge at 1536px before POSTing to a Convex storage signed URL. Matching the input aspect to the desired output is the cheapest reliability win."),
    numbered("/quiz — answers saved to session. Activity + mood will become prompt fragments later."),
    numbered("/style-pick — user picks 3 styles out of 10. Top 3 are pre-selected by scoreStyles (see Quiz doc)."),
    numbered("/sign-up gate — fal.generatePortraits requires auth (defense in depth)."),
    numbered("/generate — the action runs: consumeRegen (atomic check-and-deduct), then 3 parallel Nano Banana calls via Promise.allSettled, then aspect enforcement + persistence on each success."),
    numbered("/reveal — user sees the 3 portraits. Regenerate available (consumes regen, refunds on failure)."),
    numbered("/pdp → /cart → Stripe Checkout. Up to this point the printFileUrl on each generation is the same ~1024px file as imageUrl."),
    numbered("Stripe webhook → fal.upscaleAndFulfil. For each unique printFileUrl in the order's lineItems, run Aura SR + persist to Convex storage, patch lineItems with the high-res URL, stamp printFileHiResUpscaledAt."),
    numbered("upscaleAndFulfil then schedules brevo.sendOrderConfirmation and (for physical orders) gelato.fulfillConvexOrder."),
  );

  c.push(h1("3. Prompt construction"));
  c.push(
    p(
      "buildPrompt(style, activity, mood) concatenates four pieces in this exact order:",
    ),
  );
  c.push(codeBlock("[STYLE_PROMPT][ACTIVITY_PROMPT][MOOD_HINT][IDENTITY_GUARD]"));
  c.push(
    bullet("STYLE_PROMPT — driven by which style was chosen on /style-pick. One of 10 hand-tuned strings."),
    bullet("ACTIVITY_PROMPT — driven by quiz Q5. Sets the scene (pose, what the pet is doing, background). One of 4 strings."),
    bullet("MOOD_HINT — driven by quiz Q6. One short sentence about expression. One of 4 strings."),
    bullet("IDENTITY_GUARD — always identical. Pins the pet's likeness and forces 3:4 portrait orientation."),
  );
  c.push(
    p(
      "Full text of every prompt fragment, plus the table of which quiz answers do/don't reach the model, is in the Quiz doc.",
    ),
  );

  c.push(h1("4. The fal call"));
  c.push(codeBlock(
    [
      "POST https://fal.run/fal-ai/nano-banana/edit",
      "Authorization: Key <FAL_KEY>",
      "Content-Type: application/json",
      "",
      "{",
      "  prompt: <buildPrompt output>,",
      "  image_urls: <session.petPhotoUrls — all of them>,",
      "  num_images: 1,",
      "  output_format: \"jpeg\",",
      "  aspect_ratio: \"3:4\"",
      "}",
    ].join("\n"),
  ));
  c.push(
    p(
      "fal returns { images: [{ url }] } where url points at fal's CDN. URLs typically expire ~24h, so we never link them directly — every image is fetched, processed, and re-stored on Convex storage immediately.",
    ),
  );

  c.push(h1("5. Output handling — enforce3by4AndStore"));
  c.push(
    p(
      "Every Nano Banana output goes through a sharp-based pass that:",
    ),
  );
  c.push(
    numbered("Fetches the image bytes from the fal URL."),
    numbered("Reads width/height with sharp."),
    numbered("If the actual aspect is more than 1% off 3:4, center-crops to exactly 3:4 and re-encodes as JPEG quality 92."),
    numbered("Writes the resulting blob to Convex file storage and returns the persisted URL."),
  );
  c.push(
    p(
      "Belt-and-braces: aspect_ratio:'3:4' is also passed to fal. The center-crop step exists because the model occasionally drifts. An off-aspect file would otherwise leak all the way to Gelato, which rejects it.",
    ),
  );

  c.push(h1("6. Parallel fan-out"));
  c.push(
    p(
      "generateAllStyles fires the 3 styles in parallel via Promise.allSettled. If 1 fails the other 2 still ship — a partial gallery beats a blank screen. If all 3 fail the action throws and the regen is refunded.",
    ),
  );

  c.push(h1("7. Regen budget"));
  c.push(
    p(
      "Each user starts with 3 regenerations. Both generatePortraits and regenerate run consumeRegen at the start (atomic check-and-deduct, throws OUT_OF_REGENS at zero). On any error in the AI pipeline they call refundRegen so the user isn't charged for a failure.",
    ),
  );
  c.push(
    bullet("Successful purchase: payments.handleStripeWebhook calls sessions.resetRegens to put it back to 3."),
    bullet("Pre-flight gate: /upload checks getMyRegensRemaining for signed-in users and replaces the upload UI with a 'go to gallery' card if the budget is 0, so the user can't waste effort only to fail at /generate."),
    bullet("After the user hits zero, sessions.deletePetPhotos is called from the action — the originals can't be re-used so freeing storage saves bytes."),
  );

  c.push(h1("8. resolveSelectedStyles — defensive validation"));
  c.push(
    p(
      "Before fanning out, the action validates the caller-supplied style array against ALL_STYLES, dedupes, takes at most 3, and backfills from the saved rankedStyles if fewer than 3 valid styles were given. This is a defense-in-depth check; the picker UI prevents bad submissions, but anyone hitting the action directly can't request a non-existent style or accidentally generate 0 portraits.",
    ),
  );

  c.push(h1("9. Order-time upscale (upscaleAndFulfil)"));
  c.push(
    p(
      "Triggered from the Stripe webhook. Walks the order's lineItems, dedupes by printFileUrl (so a 'Poster + Digital of the same artwork' cart only upscales once), runs Aura SR with upscaling_factor: 4, persists each result to Convex storage, and patches the lineItems on the order. Falls back to the input URL if Aura SR fails — fulfilment must not block on a transient fal outage.",
    ),
  );
  c.push(
    p("After the patch, the same action schedules:"),
  );
  c.push(
    bullet("brevo.sendOrderConfirmation (idempotent on confirmationEmailSentAt) — the email's downloadUrl now points at the upscaled file."),
    bullet("gelato.fulfillConvexOrder, but only if hasPhysicalLines is true. Digital-only orders skip Gelato and flip status straight to 'fulfilled'."),
  );
  c.push(
    p(
      "Idempotency on order.printFileHiResUpscaledAt means a duplicate Stripe webhook will skip the upscale and re-fire the (also-idempotent) downstream emails + Gelato dispatch, so retries are safe.",
    ),
  );

  c.push(h1("10. Cost shape"));
  c.push(
    bullet("Per generation: 3 × Nano Banana calls. Most generations don't convert to a sale, so deferring the upscale is a meaningful saving."),
    bullet("Per purchase: N × Aura SR calls (N = unique images in the order, typically 1–3). Roughly $0.02 each."),
    bullet("Convex storage: every result is persisted twice over the lifetime of an order (low-res after generation; high-res after purchase). The originals are deleted when the user runs out of regens."),
  );

  c.push(h1("11. Error surfaces"));
  c.push(
    bullet("FAL_KEY missing → throw at call time, generation_status='failed', regen refunded."),
    bullet("fal non-2xx → text body propagated through the error message; regen refunded."),
    bullet("All 3 styles fail → one error message bubbles to /generate, regen refunded."),
    bullet("Aura SR failure → swallowed; the 1024px low-res file is used as a placeholder for the print URL. The print would be lower quality, but the order doesn't fail."),
    bullet("sharp parse failure → original bytes are stored, no center-crop applied."),
  );

  return makeDoc(title, subtitle, c);
}

// ============================================================================
// DOC 6 — Commerce & Fulfilment
// ============================================================================

function doc6() {
  const title = "Commerce & Fulfilment";
  const subtitle = "Catalog, cart, Stripe Checkout, Gelato fulfilment, transactional email";
  const c = [];
  c.push(...titleBlock(title, subtitle));

  c.push(h1("1. The product catalog"));
  c.push(
    p(
      "13 SKUs total, all created by convex/seed.ts → seedV1Catalog. Re-running the action wipes products and re-inserts. Each physical SKU's gelatoProductUid is resolved at seed time by querying Gelato Product API with the right attribute filters.",
    ),
  );
  c.push(
    table(
      [2400, 1100, 1600, 4260],
      ["Format", "Size", "Frame", "Notes"],
      [
        ["digital", "—", "—", "$9.99. No Gelato UID. No shipping. Always bundled free with any physical purchase."],
        ["poster", "small", "—", "12×16\" on 200gsm uncoated. $19.99."],
        ["poster", "medium", "—", "18×24\". $29.99."],
        ["poster", "large", "—", "24×32\". $39.99."],
        ["framed", "small", "natural-wood", "12×16\" on 80lb coated silk, natural wood frame. $59.99."],
        ["framed", "medium", "natural-wood", "18×24\". $79.99."],
        ["framed", "large", "natural-wood", "24×32\". $99.99."],
        ["framed", "small", "dark-wood", "12×16\" on 80lb coated silk, dark wood frame. $59.99."],
        ["framed", "medium", "dark-wood", "18×24\". $79.99."],
        ["framed", "large", "dark-wood", "24×32\". $99.99."],
        ["canvas", "small", "—", "12×16\" canvas on slim 2cm wood frame. $49.99."],
        ["canvas", "medium", "—", "18×24\". $69.99."],
        ["canvas", "large", "—", "24×32\". $89.99."],
      ],
    ),
  );
  c.push(
    p(
      "All prices are in USD cents on the row. Currency is hard-coded to 'usd'. The 24×32 size was deliberately chosen over 24×36 so all four frame colours stay available at every size (24×36 has gaps in Gelato's catalog).",
    ),
  );

  c.push(h1("2. Personalised copy (productCopy.ts)"));
  c.push(
    p(
      "The static description column on products is unused at runtime. Instead, formatProductDescription(product, petName, breed) renders the description per-customer so it can interpolate the pet's name and (lower-cased) breed. The PDP and the Stripe Checkout line item both call this function, keeping on-site and on-Stripe copy in lockstep.",
    ),
  );
  c.push(
    p(
      "Hand-written copy variants exist for: digital, poster, framed-natural-wood, framed-dark-wood, canvas. Falls back to 'your pet' / 'dog' if the quiz answers are missing.",
    ),
  );

  c.push(h1("3. Cart"));
  c.push(
    p(
      "Cart is stored on the session row (session.cart). It survives across page navigations within a session and is wiped by the Stripe webhook on successful payment.",
    ),
  );
  c.push(
    bullet("Lines merge by (productId, printFileUrl) — adding the same product+image twice bumps quantity instead of duplicating the line."),
    bullet("Digital lines are pinned to quantity 1. updateQuantity is a no-op on digital."),
    bullet("Quantity is clamped to >= 1."),
    bullet("getWithProducts returns the cart joined with each product doc and computes subtotal/shipping/total server-side. Orphaned lines (whose product was deleted/deactivated) are silently dropped."),
    bullet("Shipping: flat $30 USD if any physical line is present, $0 if digital-only."),
    bullet("count is a cheap badge query that sums quantities across all lines (used by the nav)."),
  );

  c.push(h1("4. Checkout via Stripe"));
  c.push(
    p(
      "/cart's 'Proceed to checkout' calls payments.createCheckoutSession with successUrl + cancelUrl. The action does the following in order:",
    ),
  );
  c.push(
    numbered("Reads the cart via internal query — re-prices everything from the products table. The client never sends prices."),
    numbered("Builds Stripe line_items: name, description (via formatProductDescription with petName + breed), unit_amount, quantity."),
    numbered("If the cart has any physical line: enables shipping_address_collection (allowed_countries is a hard-coded list of ~200 ISO codes), enables phone_number_collection, attaches a single $30 worldwide standard shipping option (5–14 business days)."),
    numbered("Embeds metadata.convexSessionId so the webhook knows which session to clear."),
    numbered("Calls stripe.checkout.sessions.create."),
    numbered("Pre-creates the order via orders.createPending — snapshotting lineItems so the webhook can rely on it even if the cart later changed. Order id is keyed off the Stripe session id."),
    numbered("Returns the Stripe URL."),
  );

  c.push(h1("5. Stripe webhook"));
  c.push(
    p(
      "Endpoint: POST /stripe/webhook. Reads the raw body + stripe-signature header, verifies via stripe.webhooks.constructEventAsync(STRIPE_WEBHOOK_SECRET).",
    ),
  );
  c.push(
    p("On checkout.session.completed:"),
  );
  c.push(
    numbered("orders.markPaid: idempotent on stripeSessionId. Fills in amountTotal, customerEmail, shipping, flips status to 'paid'."),
    numbered("sessions.resetRegens for the buyer's userId — every purchase grants 3 fresh regens."),
    numbered("cart.clearInternal for the originating session so refreshing the app doesn't show stale lines."),
    numbered("Schedules fal.upscaleAndFulfil with the order id (deferred upscale + email + Gelato dispatch)."),
  );

  c.push(h1("6. Gelato fulfilment"));
  c.push(
    p(
      "fal.upscaleAndFulfil schedules gelato.fulfillConvexOrder once the upscale is done — but only if the order has any physical line. Digital-only orders skip Gelato entirely and flip status to 'fulfilled'.",
    ),
  );
  c.push(
    p("fulfillConvexOrder builds a single Gelato order payload from the order's lineItems:"),
  );
  c.push(
    bullet("Skips lines whose product has no gelatoProductUid (i.e. digital lines)."),
    bullet("Each item gets the line's printFileUrl (now the upscaled high-res file) under files: [{ type: 'default', url }]."),
    bullet("Splits the shipping name on whitespace into firstName + lastName."),
    bullet("orderReferenceId is the Convex order id; customerReferenceId is the customer email or order id."),
    bullet("shipmentMethodUid: 'normal' (no expedited shipping currently)."),
  );
  c.push(
    p(
      "On success the returned Gelato id is stamped via orders.setFulfilling (status='fulfilling'). On failure the order goes to status='failed'.",
    ),
  );

  c.push(h1("7. Gelato webhook"));
  c.push(
    p(
      "Endpoint: POST /gelato/webhook. Gelato does not currently sign webhooks, so the URL secrecy is the only authenticator — treat the URL itself as a credential.",
    ),
  );
  c.push(
    p(
      "Only one event type is acted on: order_status_updated. handleWebhook updates the order status by gelatoOrderId, then maps fulfillmentStatus to one of four email stages and schedules brevo.sendStatusEmail.",
    ),
  );
  c.push(
    table(
      [2400, 2400, 4560],
      ["Gelato fulfillmentStatus", "Maps to email stage", "Notes"],
      [
        ["in_production", "inProduction", "First customer-visible status. We deliberately ignore 'passed_to_print_provider' so the customer only gets one notice for the production phase."],
        ["in_transit", "inTransit", "Triggers fetchGelatoTracking which reads the shipment's tracking URL/code/carrier so the email can include them."],
        ["delivered", "delivered", "Final happy-path stage."],
        ["canceled", "canceled", "Cancellation email; includes the comment from Gelato as 'reason' if present."],
      ],
    ),
  );

  c.push(h1("8. Brevo transactional email"));
  c.push(
    p(
      "All sends go through sendTemplate(templateId, to, params). Templates are managed in the Brevo dashboard; only the IDs are referenced from code. Sender is fixed: 'Purrtraits <orders@purrtraits.shop>'.",
    ),
  );
  c.push(
    table(
      [1500, 1300, 6560],
      ["Template", "ID", "Trigger / params"],
      [
        ["confirmation", "1", "sendOrderConfirmation. Right after Stripe webhook marks the order paid (via upscaleAndFulfil so links point at the upscaled file). Params: firstName, petName, orderNumber, lineItems[], total, currency, shippingAddress, hasDigital, digitalDownloads[], downloadUrl. Idempotent on confirmationEmailSentAt."],
        ["inProduction", "2", "From Gelato webhook in_production. Params: firstName, petName, orderNumber. Idempotent on inProductionEmailSentAt."],
        ["inTransit", "3", "From Gelato webhook in_transit. Params include trackingUrl, trackingCarrier, trackingCode (resolved via fetchGelatoTracking). Idempotent on inTransitEmailSentAt."],
        ["delivered", "4", "From Gelato webhook delivered. Idempotent on deliveredEmailSentAt."],
        ["cancellation", "5", "From Gelato webhook canceled. Includes reason. Idempotent on canceledEmailSentAt."],
        ["welcome", "6", "Scheduled (not awaited) from auth.createOrUpdateUser the first time a user is seen. Params: firstName (defaults 'there'), homepageUrl. Idempotent on welcomeEmailSentAt."],
      ],
    ),
  );

  c.push(h1("9. Idempotency strategy"));
  c.push(
    p(
      "Every fan-out from Stripe and Gelato webhooks can fire multiple times — Stripe explicitly retries on non-2xx and either provider can deliver duplicates. Each side-effecting operation has an *At marker on the row that's checked first:",
    ),
  );
  c.push(
    bulletKV("Order paid", "orders.markPaid short-circuits if status is already paid/fulfilling/fulfilled."),
    bulletKV("Upscale", "upscaleAndFulfil checks order.printFileHiResUpscaledAt — if set, it skips the upscale and just re-fires the (also-idempotent) email + Gelato dispatch."),
    bulletKV("Confirmation email", "Skipped if confirmationEmailSentAt is set."),
    bulletKV("Status emails", "Each checks {stage}EmailSentAt on the order before sending."),
    bulletKV("Welcome email", "Skipped if welcomeEmailSentAt is set on the user."),
  );

  c.push(h1("10. Order status values"));
  c.push(
    table(
      [1900, 7460],
      ["Status", "Meaning"],
      [
        ["pending", "Created at checkout, payment not yet confirmed."],
        ["paid", "Stripe webhook has fired; awaiting fulfilment."],
        ["fulfilling", "Gelato has accepted the order; awaiting status updates."],
        ["fulfilled", "Digital-only order, or final state once everything has shipped."],
        ["in_production / in_transit / delivered / canceled", "Pass-throughs from Gelato (set by setStatusByGelatoId on webhook receipt)."],
        ["failed", "Either: shipping address missing, no fulfillable items, or Gelato create returned non-2xx."],
      ],
    ),
  );

  return makeDoc(title, subtitle, c);
}

// ============================================================================
// DOC 7 — Auth & User Management
// ============================================================================

function doc7() {
  const title = "Auth & User Management";
  const subtitle = "Convex Auth setup, the React/vanilla split, and the regen budget";
  const c = [];
  c.push(...titleBlock(title, subtitle));

  c.push(h1("1. Why auth lives where it does"));
  c.push(
    p(
      "Auth is required only from /generate onward. Uploading photos and taking the quiz stay anonymous so the funnel doesn't dead-end on a sign-up wall before the user has invested anything. The gate sits between /style-pick and /generate — once the user has chosen 3 styles and clicked 'generate', they're sent to /sign-up?next=/generate, and the existing anonymous session is stamped with the new user's id on success.",
    ),
  );

  c.push(h1("2. Providers"));
  c.push(
    bulletKV("Password", "@convex-dev/auth/providers/Password — email + password, no email verification step. Deliberate, for frictionless end-of-quiz signup."),
    bulletKV("Google OAuth", "@auth/core/providers/google. Requires AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET on the Convex deployment."),
  );

  c.push(h1("3. The React/vanilla split"));
  c.push(
    p(
      "The rest of the app is plain Astro + vanilla TypeScript script islands. React is added solely so the Convex Auth UI (which is React-only in @convex-dev/auth) can mount as a client island on /sign-up. Every other page reads/writes the auth tokens directly from localStorage via lib/authStorage.ts.",
    ),
  );
  c.push(
    table(
      [2400, 6960],
      ["Surface", "Implementation"],
      [
        ["/sign-up.astro", "Renders <AuthGate client:load /> from src/components/AuthGate.tsx."],
        ["AuthGate.tsx", "Mounts ConvexAuthProvider + ConvexReactClient. Has tabs for sign-up vs sign-in, plus a Google button. Uses useAuthActions().signIn from @convex-dev/auth/react. After authentication flips to true, calls linkAndContinue → sessions.linkSessionToUser → window.location.href = next."],
        ["lib/authStorage.ts", "Vanilla bridge. Mirrors the storage keys @convex-dev/auth uses (__convexAuthJWT_<ns>, __convexAuthRefreshToken_<ns>) so a user signed in via the React island stays signed in across vanilla pages without re-auth."],
        ["lib/client.ts → makeAuthedClient()", "Builds a ConvexClient with setAuth(getValidJwt) wired up. Pages that call authed actions (e.g. /reveal regenerate, /generate, /upload's regen check) use this instead of makeClient()."],
      ],
    ),
  );

  c.push(h1("4. Token lifecycle"));
  c.push(
    bulletKV("JWT", "Short-lived (~1h). Stored at __convexAuthJWT_<namespace>."),
    bulletKV("Refresh token", "Longer-lived. Stored at __convexAuthRefreshToken_<namespace>."),
    bulletKV("Namespace", "PUBLIC_CONVEX_URL with non-alphanumerics stripped — matches the @convex-dev/auth scheme."),
    bulletKV("getValidJwt()", "Returns a usable JWT, refreshing via auth.signIn({ refreshToken }) if the stored one is missing or within REFRESH_LEEWAY_SECONDS (60s) of expiry. In-flight refresh is deduped via a module-level promise."),
    bulletKV("isSignedIn()", "Treats presence of either token as 'signed in' so an expired JWT doesn't lock the user out — getValidJwt will refresh on demand."),
    bulletKV("Sign-out", "clearAuthLocalStorage() removes both keys. Convex Auth's signOut action also revokes server-side."),
  );

  c.push(h1("5. createOrUpdateUser callback"));
  c.push(
    p(
      "Lives in convex/auth.ts. Convex Auth fires this on every sign-in / sign-up. For a brand-new user (existingUserId is null) it inserts the users row with regensRemaining: 3 and schedules brevo.sendWelcome (fire-and-forget so a Brevo outage can't block sign-up). For a returning user it just returns the existing id.",
    ),
  );
  c.push(
    p(
      "The welcome action is idempotent on welcomeEmailSentAt, so a retried sign-up flow won't double-send.",
    ),
  );

  c.push(h1("6. Linking anonymous sessions to users"));
  c.push(
    p(
      "Two paths to attach a session to a user, both idempotent:",
    ),
  );
  c.push(
    numbered("sessions.linkSessionToUser — public mutation. Called from AuthGate.tsx after authentication flips to true. Errors if not authed."),
    numbered("sessions.linkSessionToUserInternal — internal counterpart used by fal.generatePortraits (which has already resolved the userId via getAuthUserId on the action ctx). Same idempotent semantics."),
  );
  c.push(
    p(
      "Both no-op if the session already belongs to the calling user, and refuse to overwrite a session that belongs to a different user.",
    ),
  );

  c.push(h1("7. The regen budget"));
  c.push(
    p(
      "Each user has user.regensRemaining (default 3 on first sign-up). Driven exclusively from the server side via consumeRegen / refundRegen / resetRegens — the client never writes to it.",
    ),
  );
  c.push(
    table(
      [2400, 1700, 5260],
      ["Function", "When called", "Effect"],
      [
        ["consumeRegen", "Top of fal.generatePortraits and fal.regenerate", "Atomic check-and-deduct. Throws OUT_OF_REGENS if 0. Returns new remaining."],
        ["refundRegen", "On exception in those actions", "Adds 1 back. Ensures users aren't charged for failures."],
        ["resetRegens", "Stripe webhook on checkout.session.completed", "Resets to 3. Every purchase grants 3 fresh."],
        ["getMyRegensRemaining", "Read by /upload (gating) and /reveal (button label)", "Returns the user's current count. null if not signed in."],
      ],
    ),
  );
  c.push(
    p(
      "When a user hits 0, sessions.deletePetPhotos is called from the action — the originals can't be reused so the storage bytes can be freed. /upload then shows a 'go to gallery' card instead of the upload UI.",
    ),
  );

  c.push(h1("8. Analytics tie-in"));
  c.push(
    bullet("Layout.astro fires user_data with the JWT's sub claim on every page load via lib/analytics.setUserId — stitches GA4 sessions to a stable userId."),
    bullet("AuthGate.tsx fires sign_up or login at completion (uses purrtraits.pendingAuth in localStorage to remember intent across the OAuth round trip)."),
  );

  c.push(h1("9. OAuth callback handling"));
  c.push(
    p(
      "The Google flow returns to /sign-up?code=… ConvexAuthProvider auto-exchanges the code for tokens on mount. AuthGate.tsx tracks hadOauthCode so it can render a 'Completing sign-in…' state instead of an empty form during the exchange. If the exchange finishes without isAuthenticated flipping true, the code was bad — we surface 'Sign-in didn't complete. Please try again.' rather than spinning.",
    ),
  );

  c.push(h1("10. Open-redirect protection"));
  c.push(
    p(
      "Both the SSR-baked next prop and the client-side ?next= URL parameter are validated with: candidate.startsWith('/') && !candidate.startsWith('//') — so only same-origin relative paths are honored. A malicious next=//evil.com is rejected and falls back to '/'.",
    ),
  );

  return makeDoc(title, subtitle, c);
}

// ============================================================================
// DOC 8 — Frontend Conventions & Lib
// ============================================================================

function doc8() {
  const title = "Frontend Conventions & Lib";
  const subtitle = "How Astro pages, layouts, components, and shared helpers fit together";
  const c = [];
  c.push(...titleBlock(title, subtitle));

  c.push(h1("1. Architecture choice"));
  c.push(
    p(
      "Astro 6 with file-based routing under src/pages/. Every page is statically rendered Astro markup plus a single client-side <script> island that does the work — no React, no SSR data fetching, no API routes. The Convex browser client connects directly from the script island. This keeps the bundle tiny and the build trivial.",
    ),
  );
  c.push(
    p(
      "React is only present so that <AuthGate client:load /> on /sign-up can mount the Convex Auth UI (which is React-only in @convex-dev/auth/react). It is NOT used elsewhere.",
    ),
  );

  c.push(h1("2. The page recipe"));
  c.push(codeBlock(
    [
      "---",
      "import Layout from '../layouts/Layout.astro';",
      "// any Astro components",
      "---",
      "",
      "<Layout title=\"…\">",
      "  <main class=\"page container\">",
      "    <!-- static skeleton: empty containers with stable ids -->",
      "  </main>",
      "</Layout>",
      "",
      "<script>",
      "  import { makeClient, getSessionId, requireOrRedirect } from \"../lib/client.ts\";",
      "  import { api } from \"../../convex/_generated/api.js\";",
      "  // …grab DOM ids…",
      "  // guard prerequisites",
      "  if (!requireOrRedirect(sessionId, \"/upload\")) { /* redirected */ }",
      "  else { /* fetch via convex client + render */ }",
      "</script>",
      "",
      "<style is:global>",
      "  /* page-scoped CSS. is:global is needed when innerHTML emits cards at runtime */",
      "</style>",
    ].join("\n"),
  ));

  c.push(h1("3. Layout.astro"));
  c.push(
    bullet("Defines a sticky-footer scaffold (body flex column, main flex:1, footer at end)."),
    bullet("Loads Google Tag Manager (GTM-MHRPN2P3) inline at the top of <head> + the noscript iframe at the top of <body>."),
    bullet("Preconnects to AdSense CDNs and loads the AdSense script with the publisher id ca-pub-5797288699504998."),
    bullet("Renders <Nav /> (unless hideNav prop is set) and <Footer />."),
    bullet("On every page load, decodes the JWT's sub claim via lib/authStorage.getCurrentUserId and pushes a user_data event with user_id into the dataLayer (lib/analytics.setUserId). Non-authed visits are a no-op."),
    bullet("Loads /favicon.svg with a cache-bust query (?v=3)."),
  );

  c.push(h1("4. Components"));
  c.push(
    table(
      [2200, 7160],
      ["Component", "Role"],
      [
        ["Nav.astro", "Sticky top nav. Logo, How-it-works, My gallery, Create Portrait CTA, auth widget (replaced at runtime once we know whether the user is signed in — hidden by default to avoid flashing 'Sign in' for an authed user), cart badge, mobile menu."],
        ["Footer.astro", "Standard footer with legal links."],
        ["AuthGate.tsx", "React island for /sign-up. Wraps ConvexAuthProvider, renders sign-up/sign-in tabs + Google button, handles the OAuth callback, links the anonymous session to the new user, fires sign_up / login events, redirects to ?next."],
        ["AdUnit.astro", "Reusable AdSense slot wrapper. Reserves the exact pixel box up-front to protect CLS. Per-viewport visibility (desktop/mobile), optional sticky positioning hint (top/bottom/rail). Each slot push is matchMedia-gated so we don't request fill on the device class we're not showing."],
        ["ProductPreview.astro", "'How it'll look' mock-up that appears on the PDP under the hero image (not always rendered)."],
        ["Welcome.astro", "Vestigial component from the Astro starter, not used in the live flow."],
      ],
    ),
  );

  c.push(h1("5. lib/client.ts"));
  c.push(
    p("The shared browser bridge. Every page imports from here."),
  );
  c.push(
    bulletKV("makeClient()", "Returns a fresh ConvexClient pointing at PUBLIC_CONVEX_URL. Anonymous (no JWT)."),
    bulletKV("getSessionId / setSessionId / clearSessionId", "localStorage helpers under purrtraits.sessionId."),
    bulletKV("ensureSession(client)", "Returns a session id, validating the existing one against Convex first. Lazily creates a new sessions row if needed. This is what /upload calls before the first photo write."),
    bulletKV("requireOrRedirect(condition, redirectTo)", "If condition is falsy, navigates to redirectTo and returns false. Used at the top of every gated page's script."),
    bulletKV("disableImageGrabbers(root?)", "On every <img class=\"protected-img\"> within root: prevents context menu, drag-start, and sets draggable=false. Real protection requires a server watermark; this stops casual save attempts. Idempotent."),
    bulletKV("attachImageLoading(root?)", "Wires every <img class=\"protected-img\">/<img data-loadable>/<img inside .img-loading-wrap> to a loading-skeleton class. Watches src attribute changes via MutationObserver so the skeleton reappears on regenerate. Idempotent."),
  );

  c.push(h1("6. lib/authStorage.ts"));
  c.push(
    p(
      "Vanilla bridge to Convex Auth. Allows non-React pages to read and refresh the JWT that the React island wrote to localStorage. See the Auth doc for token lifecycle detail. Public surface:",
    ),
  );
  c.push(
    bulletKV("isSignedIn()", "True if either the JWT or refresh token is present."),
    bulletKV("getStoredJwt() / getStoredRefreshToken()", "Direct localStorage reads."),
    bulletKV("getCurrentUserId()", "Decodes sub claim from the JWT for analytics stitching."),
    bulletKV("getValidJwt()", "Returns a usable JWT, refreshing via the auth.signIn action if needed. In-flight refresh deduped."),
    bulletKV("makeAuthedClient()", "Builds a ConvexClient with setAuth(getValidJwt) wired up — so every authed call automatically gets a current token."),
    bulletKV("clearAuthLocalStorage()", "Wipes both keys."),
  );

  c.push(h1("7. lib/analytics.ts"));
  c.push(
    p(
      "Thin wrapper around the GTM dataLayer. Defensive: SSR-safe (no-ops when window is undefined) and try/catch'd so a malformed payload can never break user-facing flows.",
    ),
  );
  c.push(
    bulletKV("track(event, params?)", "Pushes { event, ...params } to dataLayer. Used everywhere for non-ecommerce events."),
    bulletKV("trackEcommerce(event, payload)", "GA4-compliant ecommerce push. Wraps payload in { ecommerce: {…} } and emits a { ecommerce: null } reset push first (canonical Google pattern — without the reset, two back-to-back add_to_cart events can leak items between them)."),
    bulletKV("setUserId(userId)", "Pushes user_data event with user_id. Called once per page load by Layout.astro for authed users."),
    bulletKV("toGa4Item(src)", "Maps an internal cart-line/product-like into the GA4 Ga4Item shape. Centralises the item_id / item_name / portrait_style mapping so every event emits the same shape."),
  );

  c.push(h1("8. lib/crop.ts"));
  c.push(
    p(
      "Browser-side image cropper. Center-crops an uploaded File to 3:4 and caps the long edge at 1536px before upload. Why: Nano Banana inherits aspect from its reference images, so feeding it 3:4 inputs is the strongest signal we can give the model. We also pass aspect_ratio: '3:4' to fal and validate server-side (see fal.ts), but matching input to desired output is the cheapest reliability win.",
    ),
  );

  c.push(h1("9. lib/dogBreeds.ts"));
  c.push(
    p(
      "Static array of dog breed names (Title Case) that drives the breed autocomplete on /quiz step 2. Match is case-insensitive on submit; only an exact match counts as a valid answer.",
    ),
  );

  c.push(h1("10. styles/global.css"));
  c.push(
    p(
      "Global styles + design tokens. Custom properties such as --c-cream, --c-pink, --c-pink-light, --c-stroke, --c-stroke-light, --c-text, --c-dark, --c-muted, --c-white, --r-sm, --r-md, --r-lg, --font-display. Reusable classes: .container, .page, .btn / .btn--primary / .btn--lg / .btn--block, .input, .progress / .progress__track / .progress__fill, .protected-img, .is-loading-img, .img-loading-wrap, .display, .muted, .selectable, .chip, .tag, .card-soft, .stepper, .shimmer, .back-link, .ad-band / .ad-unit / .ad-unit--{viewport}.",
    ),
  );

  c.push(h1("11. Image protection strategy"));
  c.push(
    bullet("Every <img> showing a generated portrait gets class='protected-img' and lives inside a .protected-wrap container."),
    bullet("disableImageGrabbers(root) is called after every dynamic render to disable context menu, drag-start, and the draggable attribute."),
    bullet("This is intentionally a soft guard — anyone determined can still get the image bytes. Real protection requires a server-side watermark applied at print-file generation time. Not currently implemented."),
  );

  c.push(h1("12. Loading-state pattern"));
  c.push(
    bullet("Pages render with empty containers (id'd but no content). The script island fetches via Convex and replaces innerHTML."),
    bullet("attachImageLoading(root) wires every dynamic <img> to a brand-aligned skeleton (.is-loading on the wrapper, .is-loading-img on the img). The skeleton reappears between generations — a MutationObserver on the img's src attribute re-triggers the loading state when /reveal regenerate swaps in a new URL."),
    bullet("On /generate, sample tiles for each chosen style are pre-rendered as the loading state from a build-time scan of public/samples/styles/*.{jpg,png,webp}. The picker keys by `${activity}_${mood}_${style}` and falls back to the always-generated `adventuring_playful_*` set."),
  );

  c.push(h1("13. AdSense conventions"));
  c.push(
    bullet("Single AdSense script tag in Layout.astro <head> (with preconnect) — never per-component."),
    bullet("Every slot uses the AdUnit.astro wrapper which sets explicit pixel dimensions on the wrapper to protect CLS, gates adsbygoogle.push by matchMedia so we don't fire fill on hidden viewports, and emits a /* ad: <label> */ HTML comment for debugging in the rendered DOM."),
    bullet("Per-viewport variants are written as separate <AdUnit viewport=\"desktop\" /> + <AdUnit viewport=\"mobile\" /> in the page; CSS media queries hide the wrong one."),
    bullet("Sticky placement is signaled via the `sticky` prop (\"top\", \"bottom\", \"rail\") and styled by the parent page (e.g. .gen-anchor on /generate)."),
  );

  c.push(h1("14. Page-script idioms worth knowing"));
  c.push(
    bullet("`escapeHtml(s)` is reimplemented inline in pages that build innerHTML strings (style-pick, generate, etc). Same shape everywhere: replaces & < > \" ' with entities. Avoid concatenating user input into innerHTML without it."),
    bullet("Style classes injected via innerHTML must use Astro's `is:global` flag on the <style> block — Astro's scope class only attaches to elements present at compile time."),
    bullet("Per-page event tracking dedupe: pages keep a Set of already-fired keys (e.g. viewedStyles on /reveal) so re-renders don't double-count."),
    bullet("/quiz fires its track('quiz_start') call once at top of script (not in an effect) — the page is a script-only entry, so a single call is sufficient with no React-style dedupe needed."),
  );

  return makeDoc(title, subtitle, c);
}

// ============================================================================
// DRIVER
// ============================================================================

(async () => {
  const tasks = [
    ["01-System-Architecture.docx", doc1()],
    ["02-User-Journey-and-Pages.docx", doc2()],
    ["03-Convex-Backend-Reference.docx", doc3()],
    ["04-Data-Model-and-Schema.docx", doc4()],
    ["05-AI-Generation-Pipeline.docx", doc5()],
    ["06-Commerce-and-Fulfilment.docx", doc6()],
    ["07-Auth-and-User-Management.docx", doc7()],
    ["08-Frontend-Conventions.docx", doc8()],
  ];
  for (const [filename, doc] of tasks) {
    await emit(filename, doc);
  }
  console.log("Done. " + tasks.length + " documents written to " + OUT_DIR);
})();
