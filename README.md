# @phron/image

Build and sign [Phron Image](https://phron.net) URLs from TypeScript and JavaScript.

- One Rust implementation of the URL format, bound through napi-rs. On Linux x64 (glibc),
  Node.js (20+) loads a prebuilt native binary. Everywhere else (macOS, arm64, Alpine, Windows)
  it loads the same Rust code compiled to WebAssembly, with the same API and results. No
  install-time compile.
- Cloudflare Workers: supported through the WebAssembly build (see below). Vercel Edge and Deno
  Deploy are not tested yet. `@phron/image/next` builds public URLs in plain TypeScript and runs
  in the browser.
- Signed URLs, unsigned public URLs, API URLs, `srcset`, and a Next.js loader for public sources.

```sh
npm install @phron/image
```

## Security: keys and salts stay on the server

A signing key and salt can mint a valid URL for any image in the source. Keep them in server-side
code and server-side environment variables. **Never ship them to a browser**: not in a client
component, not in a `NEXT_PUBLIC_*` variable, not in a bundle. The same goes for API keys.

## Signed URLs

For a source whose access is "API key and signed URLs". Key and salt are the hex strings shown
once in the [console](https://console.phron.net).

```ts
import { options, roundedExpiry, signUrl } from "@phron/image";

const url = signUrl({
  label: "my-source", // https://my-source.phronusercontent.com
  key: process.env.PHRON_IMAGE_KEY!,
  salt: process.env.PHRON_IMAGE_SALT!,
  options: [options.resize("fit", 800, 800), options.quality(80)],
  path: "photos/my cat.jpg", // not yet encoded; the SDK percent-encodes it before signing
  format: "webp", // optional, written as @webp
  expiresAt: roundedExpiry(24 * 3600), // optional
});
```

The signature is the base64url (no padding) HMAC-SHA256, keyed with the hex-decoded key, over the
hex-decoded salt followed by the path exactly as sent. The SDK encodes the path first and signs
the encoded string.

Use `baseUrl` instead of `label` for a custom domain: `baseUrl: "https://img.example.com"`.

### Expiry and caching

`expiresAt` adds an `exp:<unix seconds>` option, which is part of the signed path. A browser keeps
a result for up to a day (or until `exp`, if that comes sooner). If every render computes `exp`
as "now plus an hour", the URL changes every second and the browser can never reuse a cached
result. `roundedExpiry(ttlSeconds, bucketSeconds = 3600)` rounds the expiry **up** to a bucket
boundary, so the URL is identical for every render in the same bucket.

## Public URLs

For a source whose access is "public". No secret, and only a preset and one optional width from
the source's list of public widths are accepted:

```ts
import { publicUrl } from "@phron/image";

publicUrl({
  label: "my-source",
  preset: "card",
  width: 640,
  path: "photos/cat.jpg",
  format: "webp",
});
// https://my-source.phronusercontent.com/_/pr:card/w:640/plain/photos/cat.jpg@webp
```

## API URLs

The API takes the same options, unsigned, with your API key as a bearer token. The SDK returns
the URL; you add the header and make the request (server-side).

```ts
import { apiUrl, infoUrl, options } from "@phron/image";

const url = apiUrl({ label: "my-source", options: [options.width(800)], path: "photos/cat.jpg" });
const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.PHRON_API_KEY}` } });

const info = infoUrl({ label: "my-source", options: ["size:1"], path: "photos/cat.jpg" });
```

## Options

`options.resize`, `width`, `height`, `quality`, `format`, `gravity`, `preset` and `expires`
cover the common cases. Anything else goes in as a raw string: `options.raw("blur:3")` or just
`"blur:3"` in the array.

## srcset

```ts
import { options, signUrl, srcset } from "@phron/image";

const widths = [320, 640, 960, 1280];
const value = srcset(
  (w) => signUrl({ label: "my-source", key, salt, options: [options.width(w)], path, expiresAt }),
  widths,
);
// "https://… 320w, https://… 640w, …"
```

## Next.js

### Public sources: `publicLoader`

A custom loader runs in the browser, so it can only build URLs that need no secret. For a public
source:

```js
// next.config.js
module.exports = {
  images: {
    loader: "custom",
    loaderFile: "./phron-loader.ts",
    // Use the source's list of public widths.
    deviceSizes: [320, 640, 960, 1280],
    imageSizes: [64, 128],
  },
};
```

```ts
// phron-loader.ts
"use client";
import { publicLoader } from "@phron/image/next";

export default publicLoader({ label: "my-source", preset: "card", format: "webp" });
```

`quality` is ignored: a preset fixes the quality.

### Signed sources: sign on the server

A client-side loader can never hold the signing key, so it cannot produce signed URLs. For a
signed source, build the URLs in a Server Component and pass the result down:

```tsx
// app/page.tsx (Server Component)
import { options, roundedExpiry, signUrl, srcset } from "@phron/image";

export default function Page() {
  const expiresAt = roundedExpiry(24 * 3600);
  const sign = (width: number) =>
    signUrl({
      label: "my-source",
      key: process.env.PHRON_IMAGE_KEY!,
      salt: process.env.PHRON_IMAGE_SALT!,
      options: [options.width(width)],
      path: "photos/cat.jpg",
      format: "webp",
      expiresAt,
    });

  return (
    // biome-ignore lint/performance/noImgElement: pre-signed srcset
    <img
      src={sign(640)}
      srcSet={srcset(sign, [320, 640, 960, 1280])}
      sizes="(min-width: 960px) 960px, 100vw"
      alt=""
    />
  );
}
```

## Cloudflare Workers

Workers cannot load a native binary, so they use the WebAssembly build. Import the module and
instantiate it once; the functions are the same Rust core (`signUrl`, `publicUrl`, `apiUrl`,
`infoUrl`, and `optionWidth`, `optionQuality` and so on for the option helpers):

```ts
import wasm from "@phron/image/wasm";
import { instantiate } from "@phron/image/workerd";

export default {
  async fetch(_req: Request, env: { PHRON_KEY: string; PHRON_SALT: string }) {
    const image = await instantiate(wasm); // resolves to the same instance after the first call
    const url = image.signUrl({
      key: env.PHRON_KEY,
      salt: env.PHRON_SALT,
      baseUrl: "https://acme.phronusercontent.com",
      options: ["w:640"],
      path: "photos/cat.jpg",
    });
    return Response.json({ url });
  },
};
```

## Other languages

This repository holds every Phron Image SDK. The URL format is implemented once, in the Rust
crate [`crates/phron-image`](crates/phron-image); each language package binds it, and
[`conformance/vectors.json`](conformance/vectors.json) pins the output every language must
reproduce. See [docs/adr/0001-rust-core-multi-language.md](docs/adr/0001-rust-core-multi-language.md).

## License

MIT
