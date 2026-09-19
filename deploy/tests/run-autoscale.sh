#!/usr/bin/env bash
# Watches the backend autoscale. Ramps simulated users up, holds, and stops, sampling the replica count
# and the autoscaler's view of load every 5 seconds, then prints when the replica count changed.
# Needs the cluster with autoscaling on (bash deploy/kind/observability.sh up), docker, kubectl and python.
#
#   bash deploy/tests/run-autoscale.sh                      # 220 users, watches the scale-down too
#   bash deploy/tests/run-autoscale.sh --vus 120 --after 60 # smaller, and don't wait for the scale-down
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"
HERE="$(pwd)"

VUS=220
GROUP=10
EDIT_MS=1000
RAMP=30
HOLD=150
AFTER=480   # seconds to keep watching once the users have gone
TAG=latest

while [ $# -gt 0 ]; do
    case "$1" in
        --vus) VUS="$2"; shift 2 ;;
        --group) GROUP="$2"; shift 2 ;;
        --ramp) RAMP="$2"; shift 2 ;;
        --hold) HOLD="$2"; shift 2 ;;
        --after) AFTER="$2"; shift 2 ;;
        --tag) TAG="$2"; shift 2 ;;
        *) echo "unknown option: $1" >&2; exit 2 ;;
    esac
done

kubectl get scaledobject mathboard-backend >/dev/null 2>&1 || {
    echo "Autoscaling isn't on. Run: bash deploy/kind/observability.sh up" >&2
    exit 1
}
kubectl annotate scaledobject mathboard-backend "autoscaling.keda.sh/paused-replicas-" >/dev/null 2>&1 || true

PYTHON="$(command -v python3 || command -v python)"
if [ ! -d .venv ]; then
    "${PYTHON}" -m venv .venv
fi
BIN=.venv/bin
[ -d .venv/Scripts ] && BIN=.venv/Scripts
"${BIN}/python" -m pip install -q -r requirements.txt

WORK="${HERE}/.work"
mkdir -p "${WORK}" results
rm -f "${WORK}/autoscale.csv" "${WORK}/k6-autoscale.log" "${WORK}/summary-autoscale.json"

TOTAL_S=$((RAMP + HOLD + 5))
PER_USER=$(( (TOTAL_S * 1000) / EDIT_MS + 10 ))

echo "==> generating $((VUS * PER_USER)) Yjs updates"
"${BIN}/python" load/gen_updates.py --users "${VUS}" --per-user "${PER_USER}" --out-dir "${WORK}"
cp load/ws-fanout.js "${WORK}/ws-fanout.js"
WORK_FOR_DOCKER="$(cd "${WORK}" && (pwd -W 2>/dev/null || pwd))"

kubectl exec deploy/mathboard-valkey -- sh -c "valkey-cli --scan --pattern 'mb:rl:*' | xargs -r valkey-cli del" >/dev/null 2>&1 || true

echo "==> waiting for the autoscaler to settle at its minimum"
for _ in $(seq 1 90); do
    desired="$(kubectl get hpa keda-hpa-mathboard-backend -o jsonpath='{.status.desiredReplicas}' 2>/dev/null || true)"
    ready="$(kubectl get deploy mathboard-backend -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)"
    [ "${desired:-0}" = "${ready:-x}" ] && [ "${ready:-0}" = "2" ] && break
    sleep 10
done

START="$(date +%s)"
(
    echo "t,replicas,ready,connections_per_replica" > "${WORK}/autoscale.csv"
    while true; do
        now=$(( $(date +%s) - START ))
        replicas="$(kubectl get deploy mathboard-backend -o jsonpath='{.spec.replicas}' 2>/dev/null || echo '')"
        ready="$(kubectl get deploy mathboard-backend -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo '')"
        avg="$(kubectl get hpa keda-hpa-mathboard-backend -o jsonpath='{.status.currentMetrics[0].external.current.averageValue}' 2>/dev/null || echo '')"
        echo "${now},${replicas},${ready:-0},${avg}" >> "${WORK}/autoscale.csv"
        sleep 5
    done
) &
SAMPLER=$!
trap 'kill "${SAMPLER}" 2>/dev/null || true' EXIT

echo "==> ${VUS} users for $((RAMP + HOLD))s, then watching for ${AFTER}s more"
set +e
MSYS_NO_PATHCONV=1 docker run --rm -i --name k6-load \
    --add-host api.localhost:host-gateway \
    -v "${WORK_FOR_DOCKER}:/work" \
    -e "TARGET_VUS=${VUS}" -e "GROUP_SIZE=${GROUP}" -e "EDIT_EVERY_MS=${EDIT_MS}" \
    -e "RAMP_S=${RAMP}" -e "HOLD_S=${HOLD}" -e "PER_USER=${PER_USER}" \
    grafana/k6:latest run --quiet --summary-export "/work/summary-autoscale.json" /work/ws-fanout.js \
    2>&1 | tee "${WORK}/k6-autoscale.log" | tail -12
set -e
LOAD_ENDED=$(( $(date +%s) - START ))

sleep "${AFTER}"
kill "${SAMPLER}" 2>/dev/null || true
wait "${SAMPLER}" 2>/dev/null || true

"${BIN}/python" load/summarize_autoscale.py --csv "${WORK}/autoscale.csv" --k6 "${WORK}/summary-autoscale.json" \
    --vus "${VUS}" --ramp "${RAMP}" --hold "${HOLD}" --load-ended "${LOAD_ENDED}" --out results --tag "${TAG}"
