#!/bin/sh

set -eu

if [ "$(uname -s)" != "Darwin" ]; then
  echo "This packaging script only runs on macOS." >&2
  exit 1
fi

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)

cd "$ROOT_DIR"

npm run build -- --bundles dmg
