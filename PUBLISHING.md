# Publishing

Nothing is published yet (2026-11-12). This is how a release works and what a person must do
once, because the registries have no API for it.

## Release flow

1. Every change that affects a published package adds a changeset: `sampo add`, or a file in
   `.sampo/changesets/` (`npm/@phron/image: minor (Added)`). Use the `sampo-changeset` skill.
2. A push to `main` that carries changesets runs `release.yml`: `sampo release` bumps
   `bindings/node/package.json` and `CHANGELOG.md`, the workflow commits that and pushes the
   `v<version>` tag as the shared GitHub App (a tag pushed with `GITHUB_TOKEN` triggers nothing).
3. The tag runs `publish-npm.yml`: Rust checks, the seven-target build (`build-native.yml`),
   then `napi create-npm-dirs` and `napi artifacts` assemble the platform packages, and
   `npm publish` of `@phron/image` publishes them first (`prepublishOnly: napi prepublish -t npm`)
   and the root package last. The job runs on `ubuntu-latest` because npm refuses self-hosted
   runners for provenance.

The Rust crates (`phron-image`, `phron-image-node`) are listed under `ignore` in
`.sampo/config.toml`: crates.io publishing is not set up (it needs its own trusted publisher
and a version in step with the npm package).

## One-time gates (a person with the registry account and 2FA)

- **npm Trusted Publisher, eight times:** `@phron/image` and `@phron/image-linux-x64-gnu`,
  `-linux-arm64-gnu`, `-linux-x64-musl`, `-linux-arm64-musl`, `-darwin-x64`, `-darwin-arm64`,
  `-win32-x64-msvc`. For each: repository `phron-net/image`, workflow `publish-npm.yml`,
  environment `npm-publish`. A name that does not exist yet takes a _pending_ publisher
  (npmjs.com, account, Trusted Publishers). The match is by exact string; a mismatch is a bare
  403/404.
- **Release secret:** `PROTOS_APP_PRIVATE_KEY` on `phron-net/image`, projected declaratively
  (the `gha-ci` and `cp-github` skills), so `release.yml` can push the tag as the App.
- **First publish** waits for the first CI run on `main` to be green and for the lock file
  (`Cargo.lock`) to be committed.
