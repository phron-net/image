import { describe, expect, it } from "vitest";
import { roundedExpiry, srcset } from "../ts/index.js";
import { publicLoader } from "../ts/next.js";

describe("roundedExpiry", () => {
  const now = Date.UTC(2026, 0, 1, 10, 20, 30);
  it("is stable within a bucket and never earlier than now + ttl", () => {
    expect(roundedExpiry(600, 3600, now)).toBe(roundedExpiry(600, 3600, now + 60_000));
    expect(roundedExpiry(600, 3600, now)).toBeGreaterThanOrEqual(now / 1000 + 600);
  });
  it("rejects non-positive input", () => {
    expect(() => roundedExpiry(0)).toThrow();
    expect(() => roundedExpiry(60, 0)).toThrow();
  });
});

describe("srcset", () => {
  it("joins one URL per width", () => {
    expect(srcset((w) => `https://x/${w}`, [320, 640])).toBe(
      "https://x/320 320w, https://x/640 640w",
    );
  });
});

describe("next publicLoader", () => {
  it("builds public urls and ignores quality", () => {
    const loader = publicLoader({ label: "acme", preset: "card", format: "webp" });
    expect(loader({ src: "/photos/cat.jpg", width: 640, quality: 50 })).toBe(
      "https://acme.phronusercontent.com/_/pr:card/w:640/plain/photos/cat.jpg@webp",
    );
  });
});
