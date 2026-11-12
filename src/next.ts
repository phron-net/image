import { type PublicUrlParams, publicUrl } from "./index.js";

export interface NextImageLoaderProps {
  src: string;
  width: number;
  quality?: number;
}

export type PublicLoaderParams = Omit<PublicUrlParams, "width" | "path">;

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
  // `quality` is ignored on purpose: a preset fixes the quality, and an unsigned URL accepts
  // only a preset and a width.
  return ({ src, width }: NextImageLoaderProps): string =>
    publicUrl({ ...params, width, path: src });
}
