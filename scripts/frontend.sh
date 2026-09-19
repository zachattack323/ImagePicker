#!/bin/sh
# Prefer the user's tools, with a fallback for the current Codex desktop Mac.
set -eu
PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
RUNTIME_DIR="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies"
if ! command -v node >/dev/null 2>&1 && [ -x "$RUNTIME_DIR/node/bin/node" ]; then
  PATH="$RUNTIME_DIR/node/bin:$PATH"
  export PATH
fi
cd "$PROJECT_DIR/frontend"
if command -v pnpm >/dev/null 2>&1; then
  exec pnpm "$@"
elif [ -x "$RUNTIME_DIR/bin/fallback/pnpm" ]; then
  exec "$RUNTIME_DIR/bin/fallback/pnpm" "$@"
else
  echo 'Install Node.js 22.12+ and pnpm, then run this command again.' >&2
  exit 1
fi
