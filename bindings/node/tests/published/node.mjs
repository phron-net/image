// Runs the conformance vectors against @phron/image as installed from the npm registry (not the
// repo build). Usage: node node.mjs <native|wasm> <vectors.json>
// native: the Linux x64 platform package must be installed and load on its own.
// wasm: it must be absent, so the loader falls back to @phron/image-wasm32-wasip1.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { apiUrl, infoUrl, options, publicUrl, roundedExpiry, signUrl } from "@phron/image";

const [mode, vectorsPath] = process.argv.slice(2);
const require = createRequire(import.meta.url);
const has = (name) => {
  try {
    require.resolve(name);
    return true;
  } catch {
    return false;
  }
};

if (mode === "native") {
  if (!has("@phron/image-linux-x64-gnu")) throw new Error("native package not installed");
  // Loads the .node file directly: a broken binary throws here rather than silently falling back.
  require("@phron/image-linux-x64-gnu");
} else if (mode === "wasm") {
  if (has("@phron/image-linux-x64-gnu")) throw new Error("native package still installed");
  if (!has("@phron/image-wasm32-wasip1")) throw new Error("wasm package not installed");
} else {
  throw new Error(`mode must be native or wasm, got ${mode}`);
}

const v = JSON.parse(readFileSync(vectorsPath, "utf8"));
const failures = [];
let passed = 0;
const check = (name, got, want) => (got === want ? passed++ : failures.push({ name, got, want }));
const throws = (fn) => {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
};

for (const c of v.sign)
  check(`sign: ${c.name}`, signUrl({ key: v.key, salt: v.salt, ...c }), c.url);
for (const c of v.public) check(`public: ${c.name}`, publicUrl(c), c.url);
for (const c of v.api) check(`api: ${c.name}`, apiUrl(c), c.url);
for (const c of v.info) check(`info: ${c.name}`, infoUrl(c), c.url);
for (const c of v.options) check(`option ${c.call}`, options[c.call](...c.args), c.out);
for (const c of v.optionErrors)
  check(
    `option error ${c.call}`,
    throws(() => options[c.call](...c.args)),
    true,
  );
for (const c of v.roundedExpiry)
  check(`roundedExpiry ${c.ttl}`, roundedExpiry(c.ttl, c.bucket, c.nowSeconds * 1000), c.out);
for (const c of v.errors) {
  const run = { sign: signUrl, public: publicUrl, api: apiUrl }[c.kind];
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
