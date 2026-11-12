/**
 * Typed helpers for the common processing options. Each returns the option as a string, so
 * they mix freely with raw strings in an `options` array.
 */

export type ResizeType = "fit" | "fill" | "fill-down" | "force" | "auto";

export type Gravity = "no" | "so" | "ea" | "we" | "noea" | "nowe" | "soea" | "sowe" | "ce" | "sm";

const int = (name: string, n: number): string => {
  if (!Number.isInteger(n) || n < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return String(n);
};

export const options = {
  /** `rs:<type>:<width>:<height>` */
  resize: (type: ResizeType, width: number, height: number): string =>
    `rs:${type}:${int("width", width)}:${int("height", height)}`,
  /** `w:<width>` */
  width: (width: number): string => `w:${int("width", width)}`,
  /** `h:<height>` */
  height: (height: number): string => `h:${int("height", height)}`,
  /** `q:<quality>` (1 to 100). */
  quality: (quality: number): string => {
    if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
      throw new TypeError("quality must be an integer from 1 to 100");
    }
    return `q:${quality}`;
  },
  /** `f:<format>`. A URL can also carry the format as an `@<format>` suffix. */
  format: (format: string): string => `f:${format}`,
  /** `g:<gravity>[:<x offset>:<y offset>]` */
  gravity: (gravity: Gravity, xOffset?: number, yOffset?: number): string =>
    xOffset === undefined || yOffset === undefined
      ? `g:${gravity}`
      : `g:${gravity}:${xOffset}:${yOffset}`,
  /** `pr:<preset>` */
  preset: (name: string): string => `pr:${name}`,
  /** `exp:<unix seconds>` */
  expires: (unixSeconds: number): string => `exp:${int("expires", unixSeconds)}`,
  /** Escape hatch: an option written exactly as it should appear in the URL. */
  raw: (option: string): string => option,
} as const;
