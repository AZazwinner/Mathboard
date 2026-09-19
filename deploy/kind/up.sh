#!/usr/bin/env bash
# Creates (or updates) the local kind cluster and deploys Mathboard onto it.
# Needs docker, kind, kubectl and helm on PATH. Safe to re-run.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"
source versions.env
ROOT="$(cd ../.. && pwd)"

APP_URL="http://app.localhost:${HTTP_PORT}"
API_URL="http://api.localhost:${HTTP_PORT}"
WS_URL="ws://api.localhost:${HTTP_PORT}"

step() { printf '\n==> %s\n' "$1"; }

step "kind cluster '${CLUSTER_NAME}'"
if kind get clusters 2>/dev/null | grep -qx "${CLUSTER_NAME}"; then
    echo "already exists"
else
    kind create cluster --name "${CLUSTER_NAME}" --config kind-config.yaml
fi
kubectl config use-context "kind-${CLUSTER_NAME}" >/dev/null

step "Building images"
# Attestations embed timestamps, which would change the image id (and so the tag) on every build.
docker build -q --provenance=false --sbom=false -t mathboard-backend:build --target runtime "${ROOT}/src"
docker build -q --provenance=false --sbom=false -t mathboard-frontend:build \
    --build-arg "NEXT_PUBLIC_API_URL=${API_URL}" \
    --build-arg "NEXT_PUBLIC_WS_URL=${WS_URL}" \
    --build-arg "NEXT_PUBLIC_APP_URL=${APP_URL}" \
    "${ROOT}/app"

image_tag() {
    local id
    id="$(docker image inspect --format '{{.Id}}' "$1")"
    echo "dev-${id#sha256:}" | cut -c1-16
}
BACKEND_TAG="$(image_tag mathboard-backend:build)"
FRONTEND_TAG="$(image_tag mathboard-frontend:build)"
docker tag mathboard-backend:build "mathboard-backend:${BACKEND_TAG}"
docker tag mathboard-frontend:build "mathboard-frontend:${FRONTEND_TAG}"

step "Loading images into the cluster"
kind load docker-image "mathboard-backend:${BACKEND_TAG}" "mathboard-frontend:${FRONTEND_TAG}" --name "${CLUSTER_NAME}"

step "Envoy Gateway ${ENVOY_GATEWAY_VERSION}"
helm upgrade --install eg oci://docker.io/envoyproxy/gateway-helm \
    --version "${ENVOY_GATEWAY_VERSION}" \
    --namespace envoy-gateway-system --create-namespace \
    --wait --timeout 5m

step "CloudNativePG operator (chart ${CNPG_CHART_VERSION})"
helm repo add cnpg https://cloudnative-pg.github.io/charts --force-update >/dev/null
helm repo update cnpg >/dev/null
helm upgrade --install cnpg cnpg/cloudnative-pg \
    --version "${CNPG_CHART_VERSION}" \
    --namespace cnpg-system --create-namespace \
    --wait --timeout 5m

step "Gateway"
kubectl apply -f infra/gateway.yaml
kubectl wait --for=condition=Programmed gateway/mathboard-gateway --timeout=3m

step "Postgres"
kubectl apply -f infra/postgres.yaml
kubectl wait --for=condition=Ready cluster/mathboard-db --timeout=5m

step "Mathboard"
if kubectl get application.argoproj.io mathboard -n argocd >/dev/null 2>&1; then
    echo "Argo CD manages Mathboard, so it is left alone (bash argocd.sh down to go back to Helm)"
else
    # If observability.sh has installed KEDA, keep the backend autoscaled across re-runs.
    AUTOSCALING=false
    if kubectl get crd scaledobjects.keda.sh >/dev/null 2>&1; then
        AUTOSCALING=true
    fi
    helm upgrade --install mathboard ../helm/mathboard \
        --set "autoscaling.enabled=${AUTOSCALING}" \
        --set "backend.image.tag=${BACKEND_TAG}" \
        --set "frontend.image.tag=${FRONTEND_TAG}" \
        --set "config.appUrl=${APP_URL}" \
        --set "config.corsOrigins={${APP_URL}}" \
        --wait --timeout 5m
fi

printf '\nMathboard is up:\n  app  %s\n  api  %s/health\n' "${APP_URL}" "${API_URL}"
