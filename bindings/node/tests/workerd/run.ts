// Bundles worker.ts the way wrangler does (esbuild, `.wasm` kept as a module import), runs it
// in workerd through miniflare, and fails unless every conformance vector passed.
// Needs the wasm32-wasip1 build in bindings/node (`napi build --target wasm32-wasip1`).
// `node run.ts <worker.ts>` runs another worker instead (verify-published.yml passes
// ../published/worker.ts, copied beside an installed @phron/image).
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { Miniflare } from "miniflare";

const here = dirname(fileURLToPath(import.meta.url));
const entry = process.argv[2] ? resolve(process.argv[2]) : join(here, "worker.ts");
const outdir = join(dirname(entry), "dist");
mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2025",
  conditions: ["workerd", "worker", "browser"],
  mainFields: ["module", "main"],
  outdir,
  // Copy the .wasm beside the bundle and keep the import, as wrangler's CompiledWasm rule does.
  loader: { ".wasm": "copy" },
  // Node built-ins come from workerd's nodejs_compat, as under wrangler.
  external: ["buffer", "node:*"],
  logLevel: "warning",
});

// Miniflare 4, the latest stable: the 5.x pre-release (5.20261110.2-beta, 2026-11-13) replaced
// these options with an undocumented `workers[].config` schema.
const mf = new Miniflare({
  modules: true,
  scriptPath: join(outdir, "worker.js"),
  // Module names are relative to this root; the default (the cwd) breaks a bundle outside it.
  modulesRoot: outdir,
  modulesRules: [{ type: "CompiledWasm", include: ["**/*.wasm"] }],
  compatibilityDate: "2026-07-30",
  compatibilityFlags: ["nodejs_compat"],
});

try {
  const res = await mf.dispatchFetch("http://localhost/");
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`worker did not return JSON (status ${res.status}): ${text.slice(0, 2000)}`);
  }
  console.log(`workerd: ${body.passed} vectors passed, ${body.failures.length} failed`);
  if (body.failures.length > 0 || body.passed === 0) {
    console.error(JSON.stringify(body.failures, null, 2));
    process.exitCode = 1;
  }
} finally {
  await mf.dispose();
}
