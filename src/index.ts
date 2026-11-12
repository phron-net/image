import {
  API_BASE_URL,
  assertLabel,
  base64url,
  buildPath,
  hexToBytes,
  messageOf,
  plainSegment,
  resolveBaseUrl,
  type SignParams,
  signedPathOf,
} from "./core.js";

export { encodePath } from "./core.js";
export type { Gravity, ResizeType } from "./options.js";
export { options } from "./options.js";
export type { SignParams };

export type SignUrlParams = SignParams & { baseUrl?: string; label?: string };

/**
 * Build a signed browser URL: `<base>/<signature>/<options>/plain/<path>[@<format>]`.
 * Uses Web Crypto, so it runs on Node 20+, Deno, Bun and edge runtimes. Server-side only:
 * `key` and `salt` must never reach a browser.
 */
export async function signUrl(params: SignUrlParams): Promise<string> {
  const base = resolveBaseUrl(params);
  const signedPath = signedPathOf(params);
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    hexToBytes(params.key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", hmacKey, messageOf(params.salt, signedPath));
  return `${base}/${base64url(new Uint8Array(mac))}${signedPath}`;
}

export interface PublicUrlParams {
  baseUrl?: string;
  label?: string;
  /** Preset name. */
  preset: string;
  /** One of the source's public widths. */
  width?: number;
  path: string;
  format?: string;
}

/**
 * Build an unsigned browser URL for a source whose access is "public":
 * `<base>/_/pr:<preset>[/w:<width>]/plain/<path>[@<format>]`. No secret involved.
 */
export function publicUrl(params: PublicUrlParams): string {
  const base = resolveBaseUrl(params);
  const opts = [`pr:${encodeURIComponent(params.preset)}`];
  if (params.width !== undefined) {
    if (!Number.isInteger(params.width) || params.width <= 0) {
      throw new TypeError("width must be a positive integer");
    }
    opts.push(`w:${params.width}`);
  }
  return `${base}/_${buildPath(opts, params.path, params.format)}`;
}

export interface ApiUrlParams {
  label: string;
  /** Override the API host (default `https://api.phron.net`). */
  apiBaseUrl?: string;
  options?: readonly string[];
  path: string;
  format?: string;
}

/**
 * Build an API URL: `https://api.phron.net/v1/image/<label>/_/<options>/plain/<path>`.
 * Send it with an `Authorization: Bearer <API key>` header. Not signed.
 */
export function apiUrl(params: ApiUrlParams): string {
  const base = (params.apiBaseUrl ?? API_BASE_URL).replace(/\/+$/, "");
  const opts = (params.options ?? []).filter((o) => o !== "");
  const segments = ["_", ...opts, plainSegment(params.path, params.format)];
  return `${base}/v1/image/${assertLabel(params.label)}/${segments.join("/")}`;
}

export interface InfoUrlParams {
  label: string;
  apiBaseUrl?: string;
  /** Info options, for example `["size:1", "format:1"]`. */
  options?: readonly string[];
  path: string;
}

/** Build an info URL: `https://api.phron.net/v1/image/<label>/info/<info options>/plain/<path>`. */
export function infoUrl(params: InfoUrlParams): string {
  const base = (params.apiBaseUrl ?? API_BASE_URL).replace(/\/+$/, "");
  const opts = (params.options ?? []).filter((o) => o !== "");
  const segments = ["info", ...opts, plainSegment(params.path)];
  return `${base}/v1/image/${assertLabel(params.label)}/${segments.join("/")}`;
}

/**
 * Round an expiry up to a bucket boundary: `now + ttl`, rounded UP to a multiple of
 * `bucketSeconds`. The result is a unix time in seconds.
 *
 * A URL that carries the same `exp` on every render stays byte-identical, so the browser's
 * cache (which may keep a result for up to a day) keeps working. An `exp` of "now plus one
 * hour" changes every second and defeats it.
 */
export function roundedExpiry(
  ttlSeconds: number,
  bucketSeconds = 3600,
  nowMs: number = Date.now(),
): number {
  if (!(ttlSeconds > 0) || !(bucketSeconds > 0)) {
    throw new RangeError("ttlSeconds and bucketSeconds must be positive");
  }
  const target = Math.floor(nowMs / 1000) + Math.ceil(ttlSeconds);
  return Math.ceil(target / bucketSeconds) * bucketSeconds;
}

/** Build a `srcset` value: `<url> <width>w, ...`, one URL per width. */
export async function srcset(
  builder: (width: number) => string | Promise<string>,
  widths: readonly number[],
): Promise<string> {
  const urls = await Promise.all(widths.map((w) => builder(w)));
  return urls.map((url, i) => `${url} ${widths[i]}w`).join(", ");
}
