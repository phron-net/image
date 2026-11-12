import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { apiUrl, infoUrl, options, publicUrl, roundedExpiry, signUrl } from "../ts/index.js";
import { publicLoader } from "../ts/next.js";

// The cases every language binding runs; the Rust core's own test reads the same file.
const v = JSON.parse(
  readFileSync(new URL("../../../conformance/vectors.json", import.meta.url), "utf8"),
);

describe("conformance vectors", () => {
  for (const c of v.sign) {
    it(`sign: ${c.name}`, () => {
      expect(signUrl({ key: v.key, salt: v.salt, ...c })).toBe(c.url);
    });
  }
  for (const c of v.public) it(`public: ${c.name}`, () => expect(publicUrl(c)).toBe(c.url));
  // The browser-side loader is written outside the core; the vectors with a width pin it.
  for (const c of v.public.filter((c: { width?: number }) => c.width !== undefined)) {
    it(`next loader: ${c.name}`, () => {
      const loader = publicLoader({
        baseUrl: c.baseUrl,
        label: c.label,
        preset: c.preset,
        format: c.format,
      });
      expect(loader({ src: c.path, width: c.width })).toBe(c.url);
    });
  }
  for (const c of v.api) it(`api: ${c.name}`, () => expect(apiUrl(c)).toBe(c.url));
  for (const c of v.info) it(`info: ${c.name}`, () => expect(infoUrl(c)).toBe(c.url));

  const helper = (call: string, args: unknown[]): string => (options as any)[call](...args);
  for (const c of v.options) {
    it(`option ${c.call}(${c.args.join(", ")})`, () => expect(helper(c.call, c.args)).toBe(c.out));
  }
  for (const c of v.optionErrors) {
    it(`option error ${c.call}(${c.args.join(", ")})`, () =>
      expect(() => helper(c.call, c.args)).toThrow());
  }
  for (const c of v.roundedExpiry) {
    it(`roundedExpiry now=${c.nowSeconds} ttl=${c.ttl}`, () =>
      expect(roundedExpiry(c.ttl, c.bucket, c.nowSeconds * 1000)).toBe(c.out));
  }
  for (const c of v.errors) {
    it(`error: ${c.name}`, () => {
      const run = { sign: signUrl, public: publicUrl, api: apiUrl }[c.kind as "sign"];
      expect(() => run(c)).toThrow();
    });
  }
});
