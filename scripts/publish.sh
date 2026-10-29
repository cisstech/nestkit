#!/bin/bash
# A failed publish must fail the workflow step, so nothing gets tagged or released.
set -euo pipefail

node ./scripts/publish.mjs

for package in dist/libs/*; do
  if [ -d "$package" ]; then
    cd "$package" || exit
    cp -rf ../../../LICENSE ./
    npm publish --provenance --access public
    cd - || exit
  fi
done
