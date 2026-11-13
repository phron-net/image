// Runs the conformance vectors inside workerd (the Cloudflare Workers runtime), through the
// threadless WebAssembly build and napi-rs's deferred loader. Bundled by run.ts with esbuild,
// which leaves the `.wasm` import for workerd to load as a precompiled module.

import v from "../../../../conformance/vectors.json" with { type: "json" };
import { instantiate } from "../../phron-image.wasip1-deferred.js";
import wasmModule from "../../phron-image.wasm32-wasip1.wasm";

type Binding = Awaited<ReturnType<typeof instantiate>>;
type Params<K extends "signUrl" | "publicUrl" | "apiUrl" | "infoUrl"> = Parameters<Binding[K]>[0];

export default {
  async fetch(): Promise<Response> {
    const image = await instantiate(wasmModule);
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
    for (const c of v.errors) {
      const run = { sign: image.signUrl, public: image.publicUrl, api: image.apiUrl }[
        c.kind as "sign" | "public" | "api"
      ] as (arg: unknown) => string;
      let threw = false;
      try {
        run(c);
      } catch {
        threw = true;
      }
      check(`error: ${c.name}`, threw, true);
    }
    return Response.json({ passed, failures });
  },
};
