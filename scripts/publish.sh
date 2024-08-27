#!/bin/bash

node ./scripts/publish.mjs

for package in dist/libs/*; do
  if [ -d "$package" ]; then
    cd "$package" || exit
    cp -rf ../../../LICENSE ./
    yarn publish --provenance --access public
    cd - || exit
  fi
done
