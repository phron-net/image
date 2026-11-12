// The published WebAssembly build in Vercel's Edge Runtime emulator (the `edge-runtime` package).
// Bundled with the `edge-light` condition as Next.js does for the edge, and given the compiled
// module the way Vercel's `import wasm from "...wasm?module"` does. Run from a directory where npm
// installed @phron/image, esbuild and edge-runtime, with vectors.json beside it.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { EdgeRuntime } from "edge-runtime";
import { build } from "esbuild";

const entry = `
import { instantiate } from "@phron/image/workerd";
import v from "./vectors.json";
globalThis.__run = async (wasm) => {
  const image = await instantiate(wasm);
  const failures = [];
  let passed = 0;
  const check = (name, got, want) => (got === want ? passed++ : failures.push({ name, got, want }));
  for (const c of v.sign) check("sign: " + c.name, image.signUrl({ key: v.key, salt: v.salt, ...c }), c.url);
  for (const c of v.public) check("public: " + c.name, image.publicUrl(c), c.url);
  for (const c of v.api) check("api: " + c.name, image.apiUrl(c), c.url);
  for (const c of v.info) check("info: " + c.name, image.infoUrl(c), c.url);
  return JSON.stringify({ passed, failures });
};
`;

const out = await build({
  stdin: { contents: entry, resolveDir: process.cwd(), loader: "js" },
  bundle: true,
  format: "iife",
  platform: "neutral",
  target: "es2022",
  conditions: ["edge-light", "worker", "browser"],
  mainFields: ["module", "main"],
  write: false,
  logLevel: "warning",
});

const require = createRequire(`${process.cwd()}/`);
const wasm = await WebAssembly.compile(readFileSync(require.resolve("@phron/image/wasm.wasm")));
const runtime = new EdgeRuntime({
  initialCode: out.outputFiles[0].text,
  extend: (context) => Object.assign(context, { __WASM__: wasm }),
});
const body = JSON.parse(await runtime.evaluate("__run(__WASM__)"));

console.log(`edge-runtime: ${body.passed} vectors passed, ${body.failures.length} failed`);
if (body.failures.length > 0 || body.passed === 0) {
  console.error(JSON.stringify(body.failures, null, 2));
  process.exit(1);
}
