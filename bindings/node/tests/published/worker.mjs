// The README's Cloudflare Workers snippet, run against the published package's `./wasm` and
// `./workerd` exports (`napi prepublish` writes them at publish time, so only an installed
// package has them). Bundled and run in workerd by ../workerd/run.mjs.
import wasm from "@phron/image/wasm";
import { instantiate } from "@phron/image/workerd";
import v from "./vectors.json";

export default {
  async fetch() {
    const image = await instantiate(wasm);
    const failures = [];
    let passed = 0;
    const check = (name, got, want) =>
      got === want ? passed++ : failures.push({ name, got, want });
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
