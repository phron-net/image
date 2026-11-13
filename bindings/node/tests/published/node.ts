// Runs the conformance vectors against @phron/image as installed from the npm registry (not the
// repo build). Usage: node node.ts <native|wasm> <vectors.json>
// native: this machine's Linux platform package (x64 or arm64) must be installed and load on its
// own.
// wasm: it must be absent, so the loader falls back to @phron/image-wasm32-wasip1.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { apiUrl, infoUrl, options, publicUrl, roundedExpiry, signUrl } from "@phron/image";

type Case = Record<string, unknown> & { name: string; url: string };
interface Vectors {
  key: string;
  salt: string;
  sign: Case[];
  public: Case[];
  api: Case[];
  info: Case[];
  options: { call: string; args: unknown[]; out: string }[];
  optionErrors: { call: string; args: unknown[] }[];
  roundedExpiry: { nowSeconds: number; ttl: number; bucket: number; out: number }[];
  errors: (Record<string, unknown> & { name: string; kind: "sign" | "public" | "api" })[];
}

const [mode, vectorsPath] = process.argv.slice(2);
const require = createRequire(import.meta.url);
const has = (name: string): boolean => {
  try {
    require.resolve(name);
    return true;
  } catch {
    return false;
  }
};

const nativePackage = `@phron/image-linux-${process.arch}-gnu`;
if (mode === "native") {
  if (!has(nativePackage)) throw new Error(`${nativePackage} not installed`);
  // Loads the .node file directly: a broken binary throws here rather than silently falling back.
  require(nativePackage);
} else if (mode === "wasm") {
  if (has(nativePackage)) throw new Error(`${nativePackage} still installed`);
  if (!has("@phron/image-wasm32-wasip1")) throw new Error("wasm package not installed");
} else {
  throw new Error(`mode must be native or wasm, got ${mode}`);
}
if (!vectorsPath) throw new Error("usage: node node.ts <native|wasm> <vectors.json>");

const v = JSON.parse(readFileSync(vectorsPath, "utf8")) as Vectors;
// The vectors carry inputs as plain JSON; each call site states the parameter type it feeds.
type Params<F extends (arg: never) => unknown> = Parameters<F>[0];
const helper = options as unknown as Record<string, (...args: unknown[]) => string>;
const failures: { name: string; got: unknown; want: unknown }[] = [];
let passed = 0;
const check = (name: string, got: unknown, want: unknown): void => {
  if (got === want) passed++;
  else failures.push({ name, got, want });
};
const throws = (fn: () => unknown): boolean => {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
};

for (const c of v.sign)
  check(
    `sign: ${c.name}`,
    signUrl({ ...c, key: v.key, salt: v.salt } as unknown as Params<typeof signUrl>),
    c.url,
  );
for (const c of v.public)
  check(`public: ${c.name}`, publicUrl(c as unknown as Params<typeof publicUrl>), c.url);
for (const c of v.api)
  check(`api: ${c.name}`, apiUrl(c as unknown as Params<typeof apiUrl>), c.url);
for (const c of v.info)
  check(`info: ${c.name}`, infoUrl(c as unknown as Params<typeof infoUrl>), c.url);
for (const c of v.options) check(`option ${c.call}`, helper[c.call]?.(...c.args), c.out);
for (const c of v.optionErrors)
  check(
    `option error ${c.call}`,
    throws(() => helper[c.call]?.(...c.args)),
    true,
  );
for (const c of v.roundedExpiry)
  check(`roundedExpiry ${c.ttl}`, roundedExpiry(c.ttl, c.bucket, c.nowSeconds * 1000), c.out);
for (const c of v.errors) {
  const run = { sign: signUrl, public: publicUrl, api: apiUrl }[c.kind] as (arg: unknown) => string;
  check(
    `error: ${c.name}`,
    throws(() => run(c)),
    true,
  );
}

console.log(`${mode}: ${passed} vectors passed, ${failures.length} failed`);
if (failures.length > 0 || passed === 0) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
