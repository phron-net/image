# Publishing

Nothing is published yet (2026-11-12). This is how a release works and what a person must do
once, because the registries have no API for it.

## Release flow

1. Every change that affects a published package adds a changeset: `sampo add`, or a file in
   `.sampo/changesets/` (`npm/@phron/image: minor (Added)`). Use the `sampo-changeset` skill.
2. A push to `main` that carries changesets runs `release.yml`: `sampo release` bumps
   `bindings/node/package.json` and `CHANGELOG.md`, the workflow commits that and pushes the
   `v<version>` tag, then dispatches `publish-npm.yml` on it (a tag pushed with `GITHUB_TOKEN`
   triggers nothing, a `workflow_dispatch` does; no GitHub App key is involved).
3. `publish-npm.yml` runs on that tag: Rust checks, the two-target build (`build-native.yml`:
   Linux x64 native and `wasm32-wasip1`), then `napi create-npm-dirs` and `napi artifacts`
   assemble `@phron/image-linux-x64-gnu` and `@phron/image-wasm32-wasip1`, and `npm publish` of
   `@phron/image` publishes them first (`prepublishOnly: napi prepublish -t npm
   --no-gh-release`) and the root package last. CI's `package` job runs the same assembly and a
   prepublish dry run on every push. The job runs on `ubuntu-latest` because npm refuses self-hosted
   runners for provenance.

The Rust crates (`phron-image`, `phron-image-node`) are listed under `ignore` in
`.sampo/config.toml`: crates.io publishing is not set up (it needs its own trusted publisher
and a version in step with the npm package).

## One-time gates (a person with the registry account and 2FA)

- **npm Trusted Publisher, three times:** `@phron/image`, `@phron/image-linux-x64-gnu` and
  `@phron/image-wasm32-wasip1`. For each: repository `phron-net/image`, workflow `publish-npm.yml`,
  environment `npm-publish`. Set under npmjs.com, Packages, the package, Settings, Trusted
  publishing, so the package must already exist: npm's docs (checked 2026-11-12) describe no
  pending publisher for a free name, so a name is claimed once by a first manual publish. A new
  configuration expires unless its first publish succeeds within 2 days, so set it just before
  the first tag. The match is by exact string; a mismatch is a bare 403/404.
- **First publish** waits for the first CI run on `main` to be green.
