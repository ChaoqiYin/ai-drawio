#!/bin/sh

set -eu

APP_BINARY_PATH="${1:-/Applications/AI Drawio.app/Contents/MacOS/ai-drawio}"
COMPLETION_SOURCE_DIR="${2:-/Applications/AI Drawio.app/Contents/SharedSupport/cli-completions}"
BIN_TARGET="/usr/local/bin/ai-drawio"
ZSH_TARGET_DIR="/usr/local/share/zsh/site-functions"
BASH_TARGET_DIR="/usr/local/etc/bash_completion.d"
FISH_TARGET_DIR="/usr/local/share/fish/vendor_completions.d"
COMPLETION_INSTALLED=0

if [ ! -x "$APP_BINARY_PATH" ]; then
  echo "Installed CLI binary was not found at $APP_BINARY_PATH" >&2
  exit 1
fi

mkdir -p /usr/local/bin
mkdir -p "$ZSH_TARGET_DIR"
mkdir -p "$BASH_TARGET_DIR"
mkdir -p "$FISH_TARGET_DIR"

ln -sf "$APP_BINARY_PATH" "$BIN_TARGET"

if [ -f "$COMPLETION_SOURCE_DIR/_ai-drawio" ]; then
  install -m 0644 "$COMPLETION_SOURCE_DIR/_ai-drawio" "$ZSH_TARGET_DIR/_ai-drawio"
  COMPLETION_INSTALLED=1
fi

if [ -f "$COMPLETION_SOURCE_DIR/ai-drawio.bash" ]; then
  install -m 0644 "$COMPLETION_SOURCE_DIR/ai-drawio.bash" "$BASH_TARGET_DIR/ai-drawio"
  COMPLETION_INSTALLED=1
fi

if [ -f "$COMPLETION_SOURCE_DIR/ai-drawio.fish" ]; then
  install -m 0644 "$COMPLETION_SOURCE_DIR/ai-drawio.fish" "$FISH_TARGET_DIR/ai-drawio.fish"
  COMPLETION_INSTALLED=1
fi

echo "COMMAND_INSTALLED=1"
echo "COMPLETION_INSTALLED=$COMPLETION_INSTALLED"
