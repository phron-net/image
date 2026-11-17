#!/usr/bin/env bash
# Writes the SDK reference artifact for @phron/image: TypeDoc's JSON for both entry points
# (the package root and ./next). Phron's docs site reads this file and writes the reference
# pages from it, so the reference cannot drift from the code.
#
# Usage: scripts/reference.sh <output file> [git revision for source links]
#
# TypeDoc runs through npx with its own TypeScript: the workspace builds with TypeScript 7,
# which TypeDoc 0.28 cannot load. The pinned versions are what Publier's TypeDoc reader accepts
# (JSON schemaVersion 2.0, TypeDoc 0.28).
set -euo pipefail

out=$(realpath -m "${1:?usage: scripts/reference.sh <output file> [revision]}")
rev=${2:-$(git rev-parse HEAD)}

cd "$(dirname "$0")/../bindings/node"
npx --yes -p typedoc@0.28.20 -p typescript@6.0.3 typedoc \
  --options typedoc.json --json "$out" --gitRevision "$rev"

# The file is published, so check it is the shape the reader takes and carries nothing private.
node --input-type=module - "$out" <<'JS'
import { readFileSync } from "node:fs";
const path = process.argv[2];
const text = readFileSync(path, "utf8");
const doc = JSON.parse(text);
if (doc.schemaVersion !== "2.0") throw new Error(`schemaVersion ${doc.schemaVersion}, expected 2.0`);
const modules = (doc.children ?? []).map((m) => m.name);
for (const want of ["@phron/image", "@phron/image/next"]) {
  if (!modules.includes(want)) throw new Error(`module ${want} missing; found ${modules.join(", ")}`);
}
const leak = text.match(/\/home\/|\/Users\/|\/runner\/|cluster\.local|prod-euc|zonhoren/i);
if (leak) throw new Error(`the artifact mentions ${leak[0]}`);
console.log(`ok: ${modules.join(", ")} (${text.length} bytes)`);
JS
