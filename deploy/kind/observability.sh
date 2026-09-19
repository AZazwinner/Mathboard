#!/usr/bin/env bash
# Adds monitoring and autoscaling to the local kind cluster: Prometheus, Grafana and KEDA, then switches
# the Mathboard backend to scale on open WebSocket connections. Run bash up.sh first.
#
#   bash observability.sh up          install everything and turn autoscaling on
#   bash observability.sh grafana     open Grafana on http://localhost:3000 (Ctrl+C to stop)
#   bash observability.sh prometheus  open Prometheus on http://localhost:9090 (Ctrl+C to stop)
#   bash observability.sh status      what is running, and what the autoscaler is doing
#   bash observability.sh down        turn autoscaling off and remove all of it
#
# It adds about 0.5 GiB of pod memory (Grafana ~250 MiB, Prometheus 100-300 MiB depending on how long it has
# run, KEDA ~75 MiB). Leave it off when you don't need it.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"
source versions.env

step() { printf '\n==> %s\n' "$1"; }

use_cluster() {
    kubectl config use-context "kind-${CLUSTER_NAME}" >/dev/null
}

# Helm 4 applies changes server-side. While autoscaling is on the HPA owns .spec.replicas, so handing it
# back to the chart (autoscaling off) is a field-ownership conflict unless forced. Helm 3 has no such flag
# and no such conflict.
FORCE=()
if helm upgrade --help 2>/dev/null | grep -q -- '--force-conflicts'; then
    FORCE=(--force-conflicts)
fi

autoscaling() {
    # Under Argo CD there is no Helm release to upgrade: the setting lives in git instead.
    if kubectl get application.argoproj.io mathboard -n argocd >/dev/null 2>&1; then
        echo "Argo CD manages Mathboard. To turn autoscaling $([ "$1" = true ] && echo on || echo off), set"
        echo "autoscaling.enabled: $1 in deploy/gitops/values-kind.yaml and merge it."
        return 0
    fi
    helm upgrade mathboard ../helm/mathboard --reuse-values --set "autoscaling.enabled=$1"         ${FORCE[@]+"${FORCE[@]}"} --wait --timeout 5m
}

case "${1:-}" in
up)
    use_cluster
    kubectl get deploy mathboard-backend >/dev/null 2>&1 || { echo "Mathboard isn't deployed yet: run bash up.sh first." >&2; exit 1; }

    step "Helm repositories"
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts --force-update >/dev/null
    helm repo add grafana-community https://grafana-community.github.io/helm-charts --force-update >/dev/null
    helm repo add kedacore https://kedacore.github.io/charts --force-update >/dev/null
    helm repo update prometheus-community grafana-community kedacore >/dev/null

    step "Prometheus (chart ${PROMETHEUS_CHART_VERSION})"
    helm upgrade --install prometheus prometheus-community/prometheus \
        --version "${PROMETHEUS_CHART_VERSION}" \
        --namespace monitoring --create-namespace \
        -f observability/prometheus-values.yaml \
        --wait --timeout 5m

    step "Grafana (chart ${GRAFANA_CHART_VERSION})"
    kubectl create configmap mathboard-dashboards --namespace monitoring \
        --from-file=observability/dashboards --dry-run=client -o yaml | kubectl apply -f -
    helm upgrade --install grafana grafana-community/grafana \
        --version "${GRAFANA_CHART_VERSION}" \
        --namespace monitoring \
        -f observability/grafana-values.yaml \
        --wait --timeout 5m

    step "KEDA (chart ${KEDA_CHART_VERSION})"
    helm upgrade --install keda kedacore/keda \
        --version "${KEDA_CHART_VERSION}" \
        --namespace keda --create-namespace \
        -f observability/keda-values.yaml \
        --wait --timeout 5m

    step "Autoscaling the backend on open connections"
    autoscaling true

    printf '\nDone. Open the dashboard with:  bash observability.sh grafana\n'
    ;;
grafana)
    use_cluster
    printf 'Grafana: http://localhost:3000  (dashboard "Mathboard"; viewing needs no login)\n'
    printf 'To edit, log in as admin with:  kubectl -n monitoring get secret grafana -o jsonpath="{.data.admin-password}" | base64 -d\n\n'
    kubectl -n monitoring port-forward svc/grafana 3000:80
    ;;
prometheus)
    use_cluster
    printf 'Prometheus: http://localhost:9090\n\n'
    kubectl -n monitoring port-forward svc/prometheus-server 9090:80
    ;;
status)
    use_cluster
    kubectl get pods -n monitoring
    kubectl get pods -n keda
    echo
    kubectl get scaledobject,hpa
    echo
    kubectl get pods -l app.kubernetes.io/component=backend
    ;;
down)
    use_cluster
    step "Autoscaling off"
    if kubectl get crd scaledobjects.keda.sh >/dev/null 2>&1; then
        autoscaling false
    fi
    step "Removing KEDA, Grafana and Prometheus"
    helm uninstall keda --namespace keda --ignore-not-found
    helm uninstall grafana --namespace monitoring --ignore-not-found
    helm uninstall prometheus --namespace monitoring --ignore-not-found
    kubectl delete namespace monitoring keda --ignore-not-found
    ;;
*)
    sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
    exit 2
    ;;
esac
