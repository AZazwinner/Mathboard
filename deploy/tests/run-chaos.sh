#!/usr/bin/env bash
# Runs the chaos suite against the local kind cluster (bash deploy/kind/up.sh first).
# Extra arguments go to chaos.py, e.g.:  bash deploy/tests/run-chaos.sh -s hard graceful
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

PYTHON="$(command -v python3 || command -v python)"
if [ ! -d .venv ]; then
    "${PYTHON}" -m venv .venv
fi
BIN=.venv/bin
[ -d .venv/Scripts ] && BIN=.venv/Scripts

"${BIN}/python" -m pip install -q -r requirements.txt

mkdir -p results
"${BIN}/python" -u chaos.py --json results/chaos-latest.json "$@"
