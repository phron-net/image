/** Shared URL building. No crypto here, so every entry point can reuse it. */

const LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i;

/** Default API host for API URLs. */
export const API_BASE_URL = "https://api.phron.net";

/** Resolve the browser-facing base URL, without a trailing slash. */
export function resolveBaseUrl(target: { baseUrl?: string; label?: string }): string {
  if (target.baseUrl !== undefined) {
    if (target.label !== undefined) throw new TypeError("pass either baseUrl or label, not both");
    return target.baseUrl.replace(/\/+$/, "");
  }
  if (target.label === undefined) throw new TypeError("baseUrl or label is required");
  return `https://${assertLabel(target.label)}.phronusercontent.com`;
}

export function assertLabel(label: string): string {
  if (!LABEL.test(label)) throw new TypeError(`invalid source label: ${JSON.stringify(label)}`);
  return label;
}

/**
 * Percent-encode a source path: each segment is encoded, slashes are kept, a leading slash is
 * dropped. `@` is encoded too, because an unescaped `@` starts the output format.
 */
export function encodePath(path: string): string {
  return path
    .replace(/^\/+/, "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/** `plain/<encoded path>[@<format>]` */
export function plainSegment(path: string, format?: string): string {
  const suffix = format ? `@${encodeURIComponent(format)}` : "";
  return `plain/${encodePath(path)}${suffix}`;
}

/** Join option strings and the plain segment into a path with a leading slash. */
export function buildPath(options: readonly string[], path: string, format?: string): string {
  return `/${[...options.filter((o) => o !== ""), plainSegment(path, format)].join("/")}`;
}

/** Decode a hex string (the form keys and salts are shown in). */
export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) {
    throw new TypeError("expected a hex string");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Base64url without padding. */
export function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Options and expiry shared by the signing entry points. */
export interface SignParams {
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

/** The signed path (leading slash, as sent) for a set of params. */
export function signedPathOf(params: SignParams): string {
  const opts = [...(params.options ?? [])];
  if (params.expiresAt !== undefined) {
    if (!Number.isInteger(params.expiresAt)) throw new TypeError("expiresAt must be an integer");
    opts.push(`exp:${params.expiresAt}`);
  }
  return buildPath(opts, params.path, params.format);
}

/** Message the HMAC covers: salt bytes followed by the signed path bytes. */
export function messageOf(salt: string, signedPath: string): Uint8Array<ArrayBuffer> {
  const saltBytes = hexToBytes(salt);
  const pathBytes = new TextEncoder().encode(signedPath);
  const message = new Uint8Array(saltBytes.length + pathBytes.length);
  message.set(saltBytes, 0);
  message.set(pathBytes, saltBytes.length);
  return message;
}
