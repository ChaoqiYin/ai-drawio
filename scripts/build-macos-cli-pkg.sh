#!/bin/sh

set -eu

if [ "$(uname -s)" != "Darwin" ]; then
  echo "This packaging script only runs on macOS." >&2
  exit 1
fi

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
APP_NAME="AI Drawio.app"
APP_PATH="$ROOT_DIR/src-tauri/target/release/bundle/macos/$APP_NAME"
PKG_DIR="$ROOT_DIR/src-tauri/target/release/bundle/pkg"
SCRIPT_DIR="$ROOT_DIR/src-tauri/pkg/macos/scripts"
PKG_PATH="$PKG_DIR/ai-drawio-installer.pkg"
PKG_IDENTIFIER="com.example.ai-drawio.installer"
PKG_VERSION=$(
  node -e "const fs=require('node:fs'); const config=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); process.stdout.write(config.version);" \
    "$ROOT_DIR/src-tauri/tauri.conf.json"
)

cd "$ROOT_DIR"

npm run build -- --bundles app

if [ ! -d "$APP_PATH" ]; then
  echo "Expected app bundle was not produced at $APP_PATH" >&2
  exit 1
fi

mkdir -p "$PKG_DIR"

pkgbuild \
  --identifier "$PKG_IDENTIFIER" \
  --version "$PKG_VERSION" \
  --component "$APP_PATH" \
  --install-location /Applications \
  --scripts "$SCRIPT_DIR" \
  "$PKG_PATH"

echo "Created macOS installer at $PKG_PATH"
