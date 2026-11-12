/**
 * Typed helpers for the common processing options. Each returns the option as a string, so
 * they mix freely with raw strings in an `options` array. The rules live in the Rust core.
 */
import { native } from "./native.js";

export type ResizeType = "fit" | "fill" | "fill-down" | "force" | "auto";

export type Gravity = "no" | "so" | "ea" | "we" | "noea" | "nowe" | "soea" | "sowe" | "ce" | "sm";

export const options = {
  /** `rs:<type>:<width>:<height>` */
  resize: (type: ResizeType, width: number, height: number): string =>
    native.optionResize(type, width, height),
  /** `w:<width>` */
  width: (width: number): string => native.optionWidth(width),
  /** `h:<height>` */
  height: (height: number): string => native.optionHeight(height),
  /** `q:<quality>` (1 to 100). */
  quality: (quality: number): string => native.optionQuality(quality),
  /** `f:<format>`. A URL can also carry the format as an `@<format>` suffix. */
  format: (format: string): string => native.optionFormat(format),
  /** `g:<gravity>[:<x offset>:<y offset>]` */
  gravity: (gravity: Gravity, xOffset?: number, yOffset?: number): string =>
    native.optionGravity(gravity, xOffset, yOffset),
  /** `pr:<preset>` */
  preset: (name: string): string => native.optionPreset(name),
  /** `exp:<unix seconds>` */
  expires: (unixSeconds: number): string => native.optionExpires(unixSeconds),
  /** Escape hatch: an option written exactly as it should appear in the URL. */
  raw: (option: string): string => native.optionRaw(option),
} as const;
