#!/usr/bin/env bash
# One screen showing what is running on the local kind cluster, and which optional layers are switched on.
# Safe to run at any time; it only reads. Use it before a demo, or to see what a script left behind.
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")" || exit 1
source versions.env

heading() { printf '\n%s\n' "$1"; }

if ! kind get clusters 2>/dev/null | grep -qx "${CLUSTER_NAME}"; then
    echo "No kind cluster named '${CLUSTER_NAME}'. Create it with: bash deploy/kind/up.sh"
    exit 1
fi
kubectl config use-context "kind-${CLUSTER_NAME}" >/dev/null

heading "Application"
kubectl get deploy -l app.kubernetes.io/name=mathboard \
    -o custom-columns='NAME:.metadata.name,READY:.status.readyReplicas,WANTED:.spec.replicas,IMAGE:.spec.template.spec.containers[0].image' 2>/dev/null
if kubectl get cluster.postgresql.cnpg.io mathboard-db >/dev/null 2>&1; then
    printf 'database: %s\n' "$(kubectl get cluster.postgresql.cnpg.io mathboard-db -o jsonpath='{.status.phase}')"
fi
printf 'api /ready: %s\n' "$(curl -s -m 3 --resolve "api.localhost:${HTTP_PORT}:127.0.0.1" "http://api.localhost:${HTTP_PORT}/ready" || echo unreachable)"

heading "Optional layers"
layer() { # layer <name> <detected: yes|no> <how to turn it on>
    printf '  %-32s %s\n' "$1" "$([ "$2" = yes ] && echo "ON" || echo "off   ($3)")"
}
has() { kubectl "$@" >/dev/null 2>&1 && echo yes || echo no; }

layer "GitOps (Argo CD)" "$(has -n argocd get application mathboard)" "bash deploy/kind/argocd.sh up"
layer "Monitoring (Prometheus, Grafana)" "$(has -n monitoring get deploy prometheus-server)" "bash deploy/kind/observability.sh up"
if kubectl -n argocd get application mathboard >/dev/null 2>&1; then
    autoscale_hint="set autoscaling.enabled in deploy/gitops/values-kind.yaml"
else
    autoscale_hint="bash deploy/kind/observability.sh up"
fi
layer "Autoscaling on connections (KEDA)" "$(has get scaledobject mathboard-backend)" "${autoscale_hint}"
layer "Backups (WAL archiving)" "$(has get objectstore.barmancloud.cnpg.io mathboard-backups)" "bash deploy/kind/backups.sh up"

if kubectl -n argocd get application mathboard >/dev/null 2>&1; then
    heading "Argo CD"
    kubectl -n argocd get application mathboard -o custom-columns='SYNC:.status.sync.status,HEALTH:.status.health.status,REVISION:.status.sync.revision'
fi

if kubectl get scaledobject mathboard-backend >/dev/null 2>&1; then
    heading "Autoscaler"
    kubectl get hpa 2>/dev/null
fi

if kubectl get objectstore.barmancloud.cnpg.io mathboard-backups >/dev/null 2>&1; then
    heading "Backups"
    kubectl get cluster.postgresql.cnpg.io mathboard-db -o jsonpath='  WAL archiving: {.status.conditions[?(@.type=="ContinuousArchiving")].status}{"\n"}  last base backup: {.status.lastSuccessfulBackup}{"\n"}'
fi

heading "Memory used by the cluster's nodes"
docker stats --no-stream --format '  {{.Name}}  {{.MemUsage}}' 2>/dev/null | grep "${CLUSTER_NAME}-" || true
