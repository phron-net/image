// Runs the conformance vectors inside workerd (the Cloudflare Workers runtime), through the
// threadless WebAssembly build and napi-rs's deferred loader. Bundled by run.mjs with esbuild,
// which leaves the `.wasm` import for workerd to load as a precompiled module.

import v from "../../../../conformance/vectors.json";
import { instantiate } from "../../phron-image.wasip1-deferred.js";
import wasmModule from "../../phron-image.wasm32-wasip1.wasm";

export default {
  async fetch() {
    const image = await instantiate(wasmModule);
    const failures = [];
    let passed = 0;
    const check = (name, got, want) => {
      if (got === want) passed++;
      else failures.push({ name, got, want });
    };
    for (const c of v.sign)
      check(`sign: ${c.name}`, image.signUrl({ key: v.key, salt: v.salt, ...c }), c.url);
    for (const c of v.public) check(`public: ${c.name}`, image.publicUrl(c), c.url);
    for (const c of v.api) check(`api: ${c.name}`, image.apiUrl(c), c.url);
    for (const c of v.info) check(`info: ${c.name}`, image.infoUrl(c), c.url);
    for (const c of v.errors) {
      const run = { sign: image.signUrl, public: image.publicUrl, api: image.apiUrl }[c.kind];
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
