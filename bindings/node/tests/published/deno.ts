// The published WebAssembly build under Deno (the runtime Deno Deploy runs). Run from a directory
// where npm installed @phron/image: Deno resolves the bare specifiers from its node_modules.
// `./wasm.wasm` (not `./wasm`) because Deno picks the module type from the file extension.
import source wasm from "@phron/image/wasm.wasm";
import { instantiate } from "@phron/image/workerd";
import v from "./vectors.json" with { type: "json" };

const image = await instantiate(wasm);
const failures: unknown[] = [];
let passed = 0;
const check = (name: string, got: unknown, want: unknown) =>
  got === want ? passed++ : failures.push({ name, got, want });
for (const c of v.sign)
  check(`sign: ${c.name}`, image.signUrl({ key: v.key, salt: v.salt, ...c }), c.url);
for (const c of v.public) check(`public: ${c.name}`, image.publicUrl(c), c.url);
for (const c of v.api) check(`api: ${c.name}`, image.apiUrl(c), c.url);
for (const c of v.info) check(`info: ${c.name}`, image.infoUrl(c), c.url);

console.log(`deno: ${passed} vectors passed, ${failures.length} failed`);
if (failures.length > 0 || passed === 0) {
  console.error(JSON.stringify(failures, null, 2));
  Deno.exit(1);
}
