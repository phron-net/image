/**
 * `next/image` loader for public sources. It runs in the browser, where the native addon cannot
 * load, so it builds the unsigned public URL itself instead of calling the Rust core. This is
 * the one URL builder written outside the core: the `public` cases of `conformance/vectors.json`
 * pin it to the core's output (tests/conformance.test.ts). Retire it when a WebAssembly build of
 * the core can serve browsers (docs/adr/0001-rust-core-multi-language.md).
 */

export interface NextImageLoaderProps {
  src: string;
  width: number;
  quality?: number;
}

export interface PublicLoaderParams {
  /** A custom domain, for example `https://img.example.com`. Pass this or `label`. */
  baseUrl?: string;
  /** Source label: `https://<label>.phronusercontent.com`. */
  label?: string;
  /** Preset name. */
  preset: string;
  format?: string;
}

const LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i;

const encodePath = (path: string): string =>
  path
    .replace(/^\/+/, "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

function baseOf({ baseUrl, label }: Pick<PublicLoaderParams, "baseUrl" | "label">): string {
  if (baseUrl !== undefined && label !== undefined)
    throw new TypeError("pass either baseUrl or label, not both");
  if (baseUrl !== undefined) return baseUrl.replace(/\/+$/, "");
  if (label === undefined) throw new TypeError("baseUrl or label is required");
  if (!LABEL.test(label)) throw new TypeError(`invalid source label: ${JSON.stringify(label)}`);
  return `https://${label}.phronusercontent.com`;
}

/**
 * A `next/image` custom loader for a source whose access is "public". It builds unsigned
 * URLs, so it holds no secret and is safe in client code.
 *
 * Next.js asks for the widths in `images.deviceSizes` and `images.imageSizes`; set those to
 * the source's list of public widths.
 *
 * ```ts
 * "use client";
 * import { publicLoader } from "@phron/image/next";
 * export default publicLoader({ label: "my-source", preset: "card" });
 * ```
 */
export function publicLoader(params: PublicLoaderParams) {
  const base = baseOf(params);
  const suffix = params.format ? `@${encodeURIComponent(params.format)}` : "";
  // `quality` is ignored on purpose: a preset fixes the quality, and an unsigned URL accepts
  // only a preset and a width.
  return ({ src, width }: NextImageLoaderProps): string => {
    if (!Number.isInteger(width) || width <= 0)
      throw new TypeError("width must be a positive integer");
    return `${base}/_/pr:${encodeURIComponent(params.preset)}/w:${width}/plain/${encodePath(src)}${suffix}`;
  };
}
