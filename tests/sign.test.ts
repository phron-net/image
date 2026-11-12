import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { options, signUrl } from "../src/index.js";
import { signUrlSync } from "../src/node.js";

const KEY = "5c8a1f0e9b7d4a3c2e6f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5";
const SALT = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const BASE = "https://acme.phronusercontent.com";

/** The customer docs' Node sample, written independently of the SDK. */
function reference(signedPath: string): string {
  const signature = createHmac("sha256", Buffer.from(KEY, "hex"))
    .update(Buffer.from(SALT, "hex"))
    .update(signedPath)
    .digest("base64url");
  return `${BASE}/${signature}${signedPath}`;
}

const cases = [
  {
    name: "plain ascii",
    input: {
      options: [options.resize("fit", 800, 800), options.quality(80)],
      path: "photos/cat.jpg",
    },
    signedPath: "/rs:fit:800:800/q:80/plain/photos/cat.jpg",
  },
  {
    name: "format suffix",
    input: { options: [options.width(640)], path: "photos/cat.jpg", format: "webp" },
    signedPath: "/w:640/plain/photos/cat.jpg@webp",
  },
  {
    name: "spaces and non-ASCII",
    input: { options: [options.width(300)], path: "my photos/café ☕/été 2026.jpg" },
    signedPath: "/w:300/plain/my%20photos/caf%C3%A9%20%E2%98%95/%C3%A9t%C3%A9%202026.jpg",
  },
  {
    name: "expiry",
    input: { options: [options.width(300)], path: "a.png", expiresAt: 1798761600, format: "avif" },
    signedPath: "/w:300/exp:1798761600/plain/a.png@avif",
  },
  {
    name: "no options, leading slash, at sign in path",
    input: { path: "/team@home/x.jpg" },
    signedPath: "/plain/team%40home/x.jpg",
  },
];

describe("signature known answer", () => {
  for (const c of cases) {
    it(`${c.name}: signUrl and signUrlSync match node:crypto`, async () => {
      const expected = reference(c.signedPath);
      const params = { baseUrl: BASE, key: KEY, salt: SALT, ...c.input };
      expect(await signUrl(params)).toBe(expected);
      expect(signUrlSync(params)).toBe(expected);
    });
  }

  it("accepts a label and trailing slash in baseUrl", async () => {
    const expected = reference("/w:1/plain/a.jpg");
    const common = { key: KEY, salt: SALT, options: ["w:1"], path: "a.jpg" };
    expect(await signUrl({ label: "acme", ...common })).toBe(expected);
    expect(await signUrl({ baseUrl: `${BASE}//`, ...common })).toBe(expected);
  });

  it("rejects bad input", async () => {
    await expect(signUrl({ key: KEY, salt: SALT, path: "a" })).rejects.toThrow(TypeError);
    await expect(signUrl({ label: "a.b/c", key: KEY, salt: SALT, path: "a" })).rejects.toThrow(
      TypeError,
    );
    await expect(signUrl({ label: "acme", key: "zz", salt: SALT, path: "a" })).rejects.toThrow(
      TypeError,
    );
  });
});
