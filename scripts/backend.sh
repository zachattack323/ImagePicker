#!/bin/sh
# Use the semantic-search environment (Python 3.12 with SQLite extension support).
set -eu
PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$PROJECT_DIR"
if [ ! -x backend/.venv-search/bin/python ]; then
  echo 'Run the backend setup in README.txt first.' >&2
  exit 1
fi
exec backend/.venv-search/bin/python -m flask --app backend/app.py run --port 5001 "$@"
