// Thin wrapper around the GTM dataLayer. All tracking calls go through
// `track()` so we get a single defensive surface — SSR-safe (no-ops when
// `window` is undefined) and try/catch'd so a malformed payload can never
// break user-facing flows. GTM listens on `window.dataLayer.push`.

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function track(event: string, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...params });
  } catch {
    // Swallow — analytics must never break the app.
  }
}

// GA4-compliant ecommerce push. Wraps the payload in `ecommerce: {...}` so
// GTM's built-in Enhanced Ecommerce variable picks it up directly, and emits
// a `ecommerce: null` push first to clear any prior ecommerce object on the
// dataLayer (the canonical pattern from Google's GA4 docs — without the
// reset, two back-to-back add_to_cart events can leak items between them).
export function trackEcommerce(
  event: string,
  payload: { currency?: string; value?: number; items: Ga4Item[] } & Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push({ event, ecommerce: payload });
  } catch {
    // Swallow — analytics must never break the app.
  }
}

export function setUserId(userId: string | null | undefined): void {
  if (typeof window === "undefined") return;
  if (!userId) return;
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "user_data", user_id: userId });
  } catch {
    // Swallow.
  }
}

// GA4 ecommerce item shape used by view_item / add_to_cart / view_cart /
// begin_checkout / purchase. Mirrors the GA4 spec — extra fields like
// `portrait_style` are passed through as custom item params and surface in
// GA4 reports as item-scoped custom dimensions when registered.
export type Ga4Item = {
  item_id: string;
  item_name: string;
  item_category: string;   // format: digital | poster | framed | canvas
  item_variant?: string;   // size: small | medium | large (omitted for digital)
  item_brand: string;      // always 'Purrtraits'
  price: number;           // in major currency units (USD)
  quantity: number;
  portrait_style?: string; // oil | watercolour | pop | …
};

type ProductLike = {
  _id?: string;
  format?: string;
  size?: string;
  frame?: string;
  priceCents?: number;
  description?: string;
};

type ItemSourceLike = {
  product?: ProductLike;
  productId?: string;
  productFormat?: string;
  productSize?: string;
  priceCents?: number;
  quantity?: number;
  style?: string;
  petName?: string;
};

const FORMAT_LABEL: Record<string, string> = {
  digital: "Digital",
  poster: "Poster",
  framed: "Framed",
  canvas: "Canvas",
};

const STYLE_LABEL_FALLBACK: Record<string, string> = {
  oil: "Oil Painting",
  watercolour: "Watercolour",
  pop: "Pop Art",
};

export function toGa4Item(src: ItemSourceLike): Ga4Item {
  const product = src.product ?? {};
  const format = product.format ?? src.productFormat ?? "";
  const size = product.size ?? src.productSize;
  const priceCents = product.priceCents ?? src.priceCents ?? 0;
  const style = src.style ?? "";
  const styleLabel = STYLE_LABEL_FALLBACK[style] ?? style;
  const formatLabel = FORMAT_LABEL[format] ?? format;
  const namePieces = [src.petName, styleLabel, formatLabel].filter(Boolean);
  return {
    item_id: product._id ?? src.productId ?? "",
    item_name: namePieces.join(" · ") || "Purrtrait",
    item_category: format,
    item_variant: format === "digital" ? undefined : size,
    item_brand: "Purrtraits",
    price: Number((priceCents / 100).toFixed(2)),
    quantity: src.quantity ?? 1,
    portrait_style: style || undefined,
  };
}
