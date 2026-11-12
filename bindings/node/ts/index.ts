import { native } from "./native.js";

export type { Gravity, ResizeType } from "./options.js";
export { options } from "./options.js";

/** Where a browser URL points: pass `baseUrl` (a custom domain) or `label`, never both. */
export interface Target {
  baseUrl?: string;
  /** Source label: `https://<label>.phronusercontent.com`. */
  label?: string;
}

export interface SignUrlParams extends Target {
  /** Hex signing key, as shown once in the console. Server-side only. */
  key: string;
  /** Hex salt, as shown once in the console. Server-side only. */
  salt: string;
  /** Processing options, for example `[options.width(800), options.quality(80)]`. */
  options?: readonly string[];
  /** Source path, not yet encoded. */
  path: string;
  /** Output format, written as `@<format>`. */
  format?: string;
  /** Unix seconds. Adds an `exp:<n>` option, which is part of the signed path. */
  expiresAt?: number;
}

const list = (options: readonly string[] | undefined): string[] | undefined =>
  options ? [...options] : undefined;

/**
 * Build a signed browser URL: `<base>/<signature>/<options>/plain/<path>[@<format>]`.
 * The signing is done by the Rust core. Server-side only: `key` and `salt` must never reach a
 * browser. Throws if an input is invalid.
 */
export function signUrl(params: SignUrlParams): string {
  return native.signUrl({ ...params, options: list(params.options) });
}

export interface PublicUrlParams extends Target {
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
  return native.publicUrl(params);
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
  return native.apiUrl({ ...params, options: list(params.options) });
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
  return native.infoUrl({ ...params, options: list(params.options) });
}

/**
 * Percent-encode a source path: each segment is encoded, slashes are kept, a leading slash is
 * dropped. `@` is encoded too, because an unescaped `@` starts the output format.
 */
export function encodePath(path: string): string {
  return native.encodePath(path);
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
  return native.roundedExpiry(nowMs / 1000, ttlSeconds, bucketSeconds);
}

/** Build a `srcset` value: `<url> <width>w, ...`, one URL per width. */
export function srcset(builder: (width: number) => string, widths: readonly number[]): string {
  return widths.map((w) => `${builder(w)} ${w}w`).join(", ");
}
