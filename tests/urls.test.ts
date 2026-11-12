import { describe, expect, it } from "vitest";
import { apiUrl, infoUrl, options, publicUrl, roundedExpiry, srcset } from "../src/index.js";
import { publicLoader } from "../src/next.js";

describe("options", () => {
  it("builds option strings", () => {
    expect(options.resize("fill", 100, 50)).toBe("rs:fill:100:50");
    expect(options.width(10)).toBe("w:10");
    expect(options.height(20)).toBe("h:20");
    expect(options.quality(75)).toBe("q:75");
    expect(options.format("webp")).toBe("f:webp");
    expect(options.gravity("sm")).toBe("g:sm");
    expect(options.gravity("noea", 5, 10)).toBe("g:noea:5:10");
    expect(options.preset("card")).toBe("pr:card");
    expect(options.expires(1798761600)).toBe("exp:1798761600");
    expect(options.raw("blur:3")).toBe("blur:3");
  });
  it("validates numbers", () => {
    expect(() => options.quality(0)).toThrow();
    expect(() => options.width(-1)).toThrow();
    expect(() => options.width(1.5)).toThrow();
  });
});

describe("publicUrl", () => {
  it("preset only", () => {
    expect(publicUrl({ label: "acme", preset: "card", path: "photos/cat.jpg" })).toBe(
      "https://acme.phronusercontent.com/_/pr:card/plain/photos/cat.jpg",
    );
  });
  it("width, format and custom domain", () => {
    expect(
      publicUrl({
        baseUrl: "https://img.example.com/",
        preset: "card",
        width: 640,
        path: "/my photo.jpg",
        format: "webp",
      }),
    ).toBe("https://img.example.com/_/pr:card/w:640/plain/my%20photo.jpg@webp");
  });
});

describe("apiUrl and infoUrl", () => {
  it("api url", () => {
    expect(
      apiUrl({
        label: "acme",
        options: [options.resize("fit", 800, 800), options.quality(80)],
        path: "photos/cat.jpg",
        format: "webp",
      }),
    ).toBe("https://api.phron.net/v1/image/acme/_/rs:fit:800:800/q:80/plain/photos/cat.jpg@webp");
  });
  it("api url without options", () => {
    expect(apiUrl({ label: "acme", path: "a.jpg" })).toBe(
      "https://api.phron.net/v1/image/acme/_/plain/a.jpg",
    );
  });
  it("info url", () => {
    expect(infoUrl({ label: "acme", options: ["size:1", "format:1"], path: "a b.jpg" })).toBe(
      "https://api.phron.net/v1/image/acme/info/size:1/format:1/plain/a%20b.jpg",
    );
    expect(infoUrl({ label: "acme", path: "a.jpg" })).toBe(
      "https://api.phron.net/v1/image/acme/info/plain/a.jpg",
    );
  });
});

describe("roundedExpiry", () => {
  const now = Date.UTC(2026, 0, 1, 10, 20, 30);
  it("rounds up to the bucket", () => {
    const t = roundedExpiry(3600, 3600, now);
    expect(t % 3600).toBe(0);
    expect(t).toBe(Date.UTC(2026, 0, 1, 12, 0, 0) / 1000);
  });
  it("is stable within a bucket and never earlier than now + ttl", () => {
    expect(roundedExpiry(600, 3600, now)).toBe(roundedExpiry(600, 3600, now + 60_000));
    expect(roundedExpiry(600, 3600, now)).toBeGreaterThanOrEqual(now / 1000 + 600);
  });
  it("keeps an exact boundary", () => {
    const boundary = Date.UTC(2026, 0, 1, 11, 0, 0);
    expect(roundedExpiry(3600, 3600, boundary - 3_600_000)).toBe(boundary / 1000);
  });
});

describe("srcset", () => {
  it("joins sync and async builders", async () => {
    const out = await srcset(async (w) => `https://x/${w}`, [320, 640]);
    expect(out).toBe("https://x/320 320w, https://x/640 640w");
    expect(await srcset((w) => `u${w}`, [1])).toBe("u1 1w");
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
