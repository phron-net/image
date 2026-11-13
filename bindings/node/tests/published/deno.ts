// The published WebAssembly build under Deno (the runtime Deno Deploy runs), type-checked by Deno
// (`deno run --check`). Run from a directory where npm installed @phron/image: Deno resolves the
// bare specifiers from its node_modules. The module is compiled from the file's bytes, which Deno
// allows (Workers do not); a source-phase import (`import source`) runs too, but Deno's
// TypeScript cannot parse it, so it cannot be type-checked.
import { instantiate } from "@phron/image/workerd";
import v from "./vectors.json" with { type: "json" };

type Binding = Awaited<ReturnType<typeof instantiate>>;
type Params<K extends "signUrl" | "publicUrl" | "apiUrl" | "infoUrl"> = Parameters<Binding[K]>[0];

const wasm = await WebAssembly.compile(
  await Deno.readFile(new URL(import.meta.resolve("@phron/image/wasm.wasm"))),
);
const image = await instantiate(wasm);
const failures: { name: string; got: unknown; want: unknown }[] = [];
let passed = 0;
const check = (name: string, got: unknown, want: unknown): void => {
  if (got === want) passed++;
  else failures.push({ name, got, want });
};
for (const c of v.sign)
  check(
    `sign: ${c.name}`,
    image.signUrl({ ...c, key: v.key, salt: v.salt } as Params<"signUrl">),
    c.url,
  );
for (const c of v.public)
  check(`public: ${c.name}`, image.publicUrl(c as Params<"publicUrl">), c.url);
for (const c of v.api) check(`api: ${c.name}`, image.apiUrl(c as Params<"apiUrl">), c.url);
for (const c of v.info) check(`info: ${c.name}`, image.infoUrl(c as Params<"infoUrl">), c.url);

console.log(`deno: ${passed} vectors passed, ${failures.length} failed`);
if (failures.length > 0 || passed === 0) {
  console.error(JSON.stringify(failures, null, 2));
  Deno.exit(1);
}
