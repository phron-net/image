# @phron/image

## 0.3.0 — 2026-11-13

### Added

- [f08d363](https://github.com/phron-net/image/commit/f08d36345bc10448c24a069c2b49834030e34873) A native binary for Linux arm64 (`@phron/image-linux-arm64-gnu`). Both Linux binaries now load on glibc 2.17 or later; the x64 binary previously needed glibc 2.34, so Amazon Linux 2, RHEL 8, Debian 11 and Ubuntu 20.04 fell back to WebAssembly. — Thanks @envoi-zonhoren!

### Changed

- [f08d363](https://github.com/phron-net/image/commit/f08d36345bc10448c24a069c2b49834030e34873) Requires Node.js 26 or later. — Thanks @envoi-zonhoren!

## 0.2.0 — 2026-11-13

### Changed

- [20733b6](https://github.com/phron-net/image/commit/20733b68afe510fd916fcb89684bf5ddc016f762) Requires Node.js 22.18 or later. Node.js 20 reached end of life on 2026-04-30 and is no longer tested. — Thanks @envoi-zonhoren!

## 0.1.1 — 2026-11-12

### Fixed

- [3bf07bb](https://github.com/phron-net/image/commit/3bf07bb5b8e6a8db66af0e243f58fef4bd025413) The npm package now ships its README and LICENSE, so the package page on npmjs.com shows the usage guide. — Thanks @envoi-zonhoren!

