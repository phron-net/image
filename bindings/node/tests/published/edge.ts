// The published WebAssembly build in Vercel's Edge Runtime emulator (the `edge-runtime` package).
// Bundled with the `edge-light` condition as Next.js does for the edge, and given the compiled
// module the way Vercel's `import wasm from "...wasm?module"` does. Run from a directory where npm
// installed @phron/image, esbuild and edge-runtime, with vectors.json beside it:
// node edge.ts
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { EdgeRuntime } from "edge-runtime";
import { build } from "esbuild";

// The code that runs inside the edge VM. esbuild strips its types when it bundles it.
const entry = `
import { instantiate } from "@phron/image/workerd";
import v from "./vectors.json" with { type: "json" };
(globalThis as Record<string, unknown>).__run = async (wasm: WebAssembly.Module): Promise<string> => {
  const image = await instantiate(wasm);
  const failures: { name: string; got: unknown; want: unknown }[] = [];
  let passed = 0;
  const check = (name: string, got: unknown, want: unknown): void => {
    if (got === want) passed++;
    else failures.push({ name, got, want });
  };
  const call = (fn: (arg: never) => string, arg: unknown): string => fn(arg as never);
  for (const c of v.sign) check("sign: " + c.name, call(image.signUrl, { ...c, key: v.key, salt: v.salt }), c.url);
  for (const c of v.public) check("public: " + c.name, call(image.publicUrl, c), c.url);
  for (const c of v.api) check("api: " + c.name, call(image.apiUrl, c), c.url);
  for (const c of v.info) check("info: " + c.name, call(image.infoUrl, c), c.url);
  return JSON.stringify({ passed, failures });
};
`;

const out = await build({
  stdin: { contents: entry, resolveDir: process.cwd(), loader: "ts" },
  bundle: true,
  format: "iife",
  platform: "neutral",
  target: "es2025",
  conditions: ["edge-light", "worker", "browser"],
  mainFields: ["module", "main"],
  write: false,
  logLevel: "warning",
});
const bundle = out.outputFiles[0];
if (!bundle) throw new Error("esbuild produced no output");

const require = createRequire(`${process.cwd()}/`);
const wasm = await WebAssembly.compile(readFileSync(require.resolve("@phron/image/wasm.wasm")));
const runtime = new EdgeRuntime({
  initialCode: bundle.text,
  extend: (context) => Object.assign(context, { __WASM__: wasm }),
});
const body = JSON.parse(await runtime.evaluate<string>("__run(__WASM__)")) as {
  passed: number;
  failures: unknown[];
};

console.log(`edge-runtime: ${body.passed} vectors passed, ${body.failures.length} failed`);
if (body.failures.length > 0 || body.passed === 0) {
  console.error(JSON.stringify(body.failures, null, 2));
  process.exit(1);
}
