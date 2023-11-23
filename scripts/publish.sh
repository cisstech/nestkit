#!/bin/bash

node ./scripts/publish.mjs

for package in dist/libs/*; do
  if [ -d "$package" ]; then
    cd "$package" || exit
    cp -rf ../../../LICENSE ./
    npm publish --access public
    cd - || exit
  fi
done
