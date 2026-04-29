/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as brevo from "../brevo.js";
import type * as cart from "../cart.js";
import type * as fal from "../fal.js";
import type * as files from "../files.js";
import type * as gelato from "../gelato.js";
import type * as http from "../http.js";
import type * as messages from "../messages.js";
import type * as orders from "../orders.js";
import type * as payments from "../payments.js";
import type * as probe from "../probe.js";
import type * as products from "../products.js";
import type * as seed from "../seed.js";
import type * as sessions from "../sessions.js";
import type * as styleScoring from "../styleScoring.js";
import type * as tests from "../tests.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  brevo: typeof brevo;
  cart: typeof cart;
  fal: typeof fal;
  files: typeof files;
  gelato: typeof gelato;
  http: typeof http;
  messages: typeof messages;
  orders: typeof orders;
  payments: typeof payments;
  probe: typeof probe;
  products: typeof products;
  seed: typeof seed;
  sessions: typeof sessions;
  styleScoring: typeof styleScoring;
  tests: typeof tests;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
