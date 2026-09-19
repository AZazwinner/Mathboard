#!/usr/bin/env bash
# Runs the k6 load test against the local kind cluster at several backend replica counts and
# summarizes the results. Needs the cluster up (bash deploy/kind/up.sh), docker, kubectl and python.
#
#   bash deploy/tests/run-load.sh                         # 1, 3 and 5 replicas, 300 users
#   bash deploy/tests/run-load.sh --replicas "1 5" --vus 500
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"
HERE="$(pwd)"

REPLICAS="1 3 5"
VUS=300
GROUP=10
EDIT_MS=1000
RAMP=20
HOLD=60
RESTORE_REPLICAS=3
TAG=latest

while [ $# -gt 0 ]; do
    case "$1" in
        --replicas) REPLICAS="$2"; shift 2 ;;
        --vus) VUS="$2"; shift 2 ;;
        --group) GROUP="$2"; shift 2 ;;
        --edit-every-ms) EDIT_MS="$2"; shift 2 ;;
        --ramp) RAMP="$2"; shift 2 ;;
        --hold) HOLD="$2"; shift 2 ;;
        --restore) RESTORE_REPLICAS="$2"; shift 2 ;;
        --tag) TAG="$2"; shift 2 ;;
        *) echo "unknown option: $1" >&2; exit 2 ;;
    esac
done

PYTHON="$(command -v python3 || command -v python)"
if [ ! -d .venv ]; then
    "${PYTHON}" -m venv .venv
fi
BIN=.venv/bin
[ -d .venv/Scripts ] && BIN=.venv/Scripts
"${BIN}/python" -m pip install -q -r requirements.txt

WORK="${HERE}/.work"
mkdir -p "${WORK}" results
rm -f "${WORK}"/summary-r*.json "${WORK}"/cpu-r*.log "${WORK}"/k6-r*.log "${WORK}"/restarts-r*.txt

TOTAL_S=$((RAMP + HOLD + 5))
PER_USER=$(( (TOTAL_S * 1000) / EDIT_MS + 10 ))

echo "==> generating $((VUS * PER_USER)) Yjs updates"
"${BIN}/python" load/gen_updates.py --users "${VUS}" --per-user "${PER_USER}" --out-dir "${WORK}"
cp load/ws-fanout.js "${WORK}/ws-fanout.js"

WORK_FOR_DOCKER="$(cd "${WORK}" && (pwd -W 2>/dev/null || pwd))"

# With autoscaling on (observability.sh up), KEDA would undo `kubectl scale`, so pin the replica count
# through its documented pause annotation instead, and release it afterwards.
PAUSE_ANNOTATION="autoscaling.keda.sh/paused-replicas"
AUTOSCALED=false
if kubectl get scaledobject mathboard-backend >/dev/null 2>&1; then
    AUTOSCALED=true
fi

set_replicas() {
    if [ "${AUTOSCALED}" = true ]; then
        kubectl annotate scaledobject mathboard-backend "${PAUSE_ANNOTATION}=$1" --overwrite >/dev/null
    else
        kubectl scale deploy/mathboard-backend --replicas="$1" >/dev/null
    fi
}

cleanup() {
    if [ "${AUTOSCALED}" = true ]; then
        kubectl annotate scaledobject mathboard-backend "${PAUSE_ANNOTATION}-" >/dev/null 2>&1 || true
    else
        kubectl scale deploy/mathboard-backend --replicas="${RESTORE_REPLICAS}" >/dev/null 2>&1 || true
    fi
}
trap cleanup EXIT

backend_restarts() {
    kubectl get pods -l app.kubernetes.io/component=backend -o jsonpath='{range .items[*]}{.status.containerStatuses[0].restartCount}{"\n"}{end}' | awk '{s+=$1} END {print s+0}'
}

wait_for_replicas() {
    kubectl rollout status deploy/mathboard-backend --timeout=180s >/dev/null
    for _ in $(seq 1 60); do
        ready="$(kubectl get deploy mathboard-backend -o jsonpath='{.status.readyReplicas}')"
        total="$(kubectl get pods -l app.kubernetes.io/component=backend --no-headers | wc -l | tr -d ' ')"
        [ "${ready:-0}" = "$1" ] && [ "${total}" = "$1" ] && return 0
        sleep 2
    done
    echo "backend did not reach $1 ready replicas" >&2
    return 1
}

for R in ${REPLICAS}; do
    echo
    echo "==> ${R} backend replica(s)"
    set_replicas "${R}"
    wait_for_replicas "${R}"
    sleep 15
    kubectl exec deploy/mathboard-valkey -- sh -c "valkey-cli --scan --pattern 'mb:rl:*' | xargs -r valkey-cli del" >/dev/null 2>&1 || true

    RESTARTS_BEFORE="$(backend_restarts)"

    (
        while true; do
            { docker stats --no-stream --format '{{.Name}} {{.CPUPerc}}' 2>/dev/null | grep -E '^(mathboard-|k6-load)' || true; echo ---; } >> "${WORK}/cpu-r${R}.log"
            sleep 4
        done
    ) &
    SAMPLER=$!

    set +e
    MSYS_NO_PATHCONV=1 docker run --rm -i --name k6-load \
        --add-host api.localhost:host-gateway \
        -v "${WORK_FOR_DOCKER}:/work" \
        -e "TARGET_VUS=${VUS}" -e "GROUP_SIZE=${GROUP}" -e "EDIT_EVERY_MS=${EDIT_MS}" \
        -e "RAMP_S=${RAMP}" -e "HOLD_S=${HOLD}" -e "PER_USER=${PER_USER}" \
        grafana/k6:latest run --quiet --summary-export "/work/summary-r${R}.json" /work/ws-fanout.js \
        2>&1 | tee "${WORK}/k6-r${R}.log" | tail -25
    set -e

    echo $(( $(backend_restarts) - RESTARTS_BEFORE )) > "${WORK}/restarts-r${R}.txt"
    kill "${SAMPLER}" 2>/dev/null || true
    wait "${SAMPLER}" 2>/dev/null || true
done

echo
echo "==> summary"
"${BIN}/python" load/summarize.py --work "${WORK}" --out results --vus "${VUS}" --group "${GROUP}" \
    --edit-every-ms "${EDIT_MS}" --hold "${HOLD}" --replicas "${REPLICAS}" --tag "${TAG}"
