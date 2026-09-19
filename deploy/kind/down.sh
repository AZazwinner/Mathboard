#!/usr/bin/env bash
# Deletes the local kind cluster and everything in it, including the database.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"
source versions.env

kind delete cluster --name "${CLUSTER_NAME}"
