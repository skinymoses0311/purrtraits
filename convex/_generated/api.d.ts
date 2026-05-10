/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as artistScoring from "../artistScoring.js";
import type * as artworks from "../artworks.js";
import type * as artworksCatalog from "../artworksCatalog.js";
import type * as auth from "../auth.js";
import type * as brevo from "../brevo.js";
import type * as cart from "../cart.js";
import type * as currency from "../currency.js";
import type * as displayLabels from "../displayLabels.js";
import type * as fal from "../fal.js";
import type * as files from "../files.js";
import type * as galleryExport from "../galleryExport.js";
import type * as gelato from "../gelato.js";
import type * as http from "../http.js";
import type * as migrations from "../migrations.js";
import type * as orders from "../orders.js";
import type * as payments from "../payments.js";
import type * as probe from "../probe.js";
import type * as productCopy from "../productCopy.js";
import type * as products from "../products.js";
import type * as seed from "../seed.js";
import type * as seedream from "../seedream.js";
import type * as sessions from "../sessions.js";
import type * as styleScoring from "../styleScoring.js";
import type * as tests from "../tests.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  artistScoring: typeof artistScoring;
  artworks: typeof artworks;
  artworksCatalog: typeof artworksCatalog;
  auth: typeof auth;
  brevo: typeof brevo;
  cart: typeof cart;
  currency: typeof currency;
  displayLabels: typeof displayLabels;
  fal: typeof fal;
  files: typeof files;
  galleryExport: typeof galleryExport;
  gelato: typeof gelato;
  http: typeof http;
  migrations: typeof migrations;
  orders: typeof orders;
  payments: typeof payments;
  probe: typeof probe;
  productCopy: typeof productCopy;
  products: typeof products;
  seed: typeof seed;
  seedream: typeof seedream;
  sessions: typeof sessions;
  styleScoring: typeof styleScoring;
  tests: typeof tests;
  users: typeof users;
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
