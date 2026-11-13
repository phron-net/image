#!/usr/bin/env bash
# Waits until @phron/image and every platform package it names are on npm at the given version.
# npm publishes asynchronously ("Your package is being processed"): 0.2.0 appeared about seven
# minutes after `npm publish` returned, and each package finishes on its own clock. An install
# that runs before a platform package is visible skips that optional dependency without an
# error (0.3.0's WebAssembly package), so wait for all of them, up to 20 minutes.
set -euo pipefail
version="$1"
for i in $(seq 1 40); do
  pending=()
  if ! npm view "@phron/image@$version" version --prefer-online >/dev/null 2>&1; then
    pending+=("@phron/image")
  else
    for dep in $(npm view "@phron/image@$version" optionalDependencies --json --prefer-online | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(Object.keys(JSON.parse(s)).join(" ")))'); do
      npm view "$dep@$version" version --prefer-online >/dev/null 2>&1 || pending+=("$dep")
    done
  fi
  [ ${#pending[@]} -eq 0 ] && { echo "all packages at $version are on npm"; exit 0; }
  echo "waiting for: ${pending[*]}"
  sleep 30
done
echo "not on npm after 20 minutes: ${pending[*]}"
exit 1
