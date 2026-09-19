#!/usr/bin/env bash
# Adds database backups to the local kind cluster: continuous WAL archiving plus scheduled base backups
# (point-in-time recovery) through CloudNativePG's Barman Cloud plugin, into an in-cluster S3-compatible store.
# Run bash up.sh first. Prove it works with: bash deploy/tests/run-restore-drill.sh
#
#   bash backups.sh up        install cert-manager, the plugin and the object store, and turn backups on
#   bash backups.sh status    backups, and whether WAL archiving is healthy
#   bash backups.sh down      turn backups off and remove all of it (the backups are deleted with the store)
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"
source versions.env

step() { printf '\n==> %s\n' "$1"; }

use_cluster() {
    kubectl config use-context "kind-${CLUSTER_NAME}" >/dev/null
}

random_hex() {
    head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'
}

# Adding or removing the plugin restarts the database. Ready is true before that restart begins, so wait
# for the plugin's sidecar to appear (or disappear) in the pod and for the cluster to settle afterwards.
wait_for_database() {
    local want="$1" sidecars phase
    for _ in $(seq 1 90); do
        phase="$(kubectl get cluster.postgresql.cnpg.io mathboard-db -o jsonpath='{.status.phase}' 2>/dev/null || true)"
        sidecars="$(kubectl get pods -l cnpg.io/cluster=mathboard-db -o jsonpath='{.items[*].spec.initContainers[*].name}' 2>/dev/null || true)"
        if [ "${phase}" = "Cluster in healthy state" ]; then
            if [ "${want}" = "with-plugin" ] && [[ "${sidecars}" == *plugin-barman-cloud* ]]; then return 0; fi
            if [ "${want}" = "without-plugin" ] && [[ "${sidecars}" != *plugin-barman-cloud* ]]; then return 0; fi
        fi
        sleep 5
    done
    echo "the database did not settle (${want})" >&2
    return 1
}

case "${1:-}" in
up)
    use_cluster
    kubectl get cluster.postgresql.cnpg.io mathboard-db >/dev/null 2>&1 || { echo "Run bash up.sh first." >&2; exit 1; }

    step "cert-manager ${CERT_MANAGER_VERSION} (the plugin uses it for its certificates)"
    helm repo add jetstack https://charts.jetstack.io --force-update >/dev/null
    helm repo add cnpg https://cloudnative-pg.github.io/charts --force-update >/dev/null
    helm repo update jetstack cnpg >/dev/null
    helm upgrade --install cert-manager jetstack/cert-manager \
        --version "${CERT_MANAGER_VERSION}" \
        --namespace cert-manager --create-namespace \
        --set crds.enabled=true \
        --wait --timeout 5m

    step "Barman Cloud plugin (chart ${BARMAN_PLUGIN_CHART_VERSION})"
    helm upgrade --install plugin-barman-cloud cnpg/plugin-barman-cloud \
        --version "${BARMAN_PLUGIN_CHART_VERSION}" \
        --namespace cnpg-system \
        --wait --timeout 5m

    step "Object store"
    if ! kubectl get secret backup-s3 >/dev/null 2>&1; then
        kubectl create secret generic backup-s3 \
            --from-literal=ACCESS_KEY_ID="$(random_hex 10)" \
            --from-literal=ACCESS_SECRET_KEY="$(random_hex 20)"
    fi
    access_key="$(kubectl get secret backup-s3 -o jsonpath='{.data.ACCESS_KEY_ID}' | base64 -d)"
    secret_key="$(kubectl get secret backup-s3 -o jsonpath='{.data.ACCESS_SECRET_KEY}' | base64 -d)"
    kubectl create secret generic seaweedfs-s3-config \
        --from-literal=s3.json="{\"identities\":[{\"name\":\"backups\",\"credentials\":[{\"accessKey\":\"${access_key}\",\"secretKey\":\"${secret_key}\"}],\"actions\":[\"Admin\",\"Read\",\"Write\",\"List\",\"Tagging\"]}]}" \
        --dry-run=client -o yaml | kubectl apply -f -
    kubectl apply -f backups/seaweedfs.yaml
    kubectl rollout status deploy/seaweedfs --timeout=3m
    for _ in $(seq 1 30); do
        if kubectl exec deploy/seaweedfs -- sh -c 'echo "s3.bucket.create -name backups" | weed shell -master=localhost:9333' 2>&1 | grep -qiE "created|exists"; then
            break
        fi
        sleep 4
    done

    step "Turning backups on for the database"
    kubectl apply -f backups/objectstore.yaml
    kubectl patch cluster.postgresql.cnpg.io mathboard-db --type merge -p \
        '{"spec":{"plugins":[{"name":"barman-cloud.cloudnative-pg.io","isWALArchiver":true,"parameters":{"barmanObjectName":"mathboard-backups"}}]}}'
    wait_for_database with-plugin
    kubectl apply -f backups/scheduledbackup.yaml

    step "Waiting for WAL archiving to report healthy"
    for _ in $(seq 1 30); do
        state="$(kubectl get cluster.postgresql.cnpg.io mathboard-db -o jsonpath='{.status.conditions[?(@.type=="ContinuousArchiving")].status}' 2>/dev/null || true)"
        [ "${state}" = "True" ] && break
        sleep 4
    done
    echo "ContinuousArchiving: ${state:-unknown}"
    printf '\nDone. Prove a restore works with:  bash deploy/tests/run-restore-drill.sh\n'
    ;;
status)
    use_cluster
    kubectl get objectstore,scheduledbackup,backup
    echo
    kubectl get cluster.postgresql.cnpg.io mathboard-db -o jsonpath='ContinuousArchiving: {.status.conditions[?(@.type=="ContinuousArchiving")].status}{"\n"}First recoverability point: {.status.firstRecoverabilityPoint}{"\n"}Last successful backup: {.status.lastSuccessfulBackup}{"\n"}'
    ;;
down)
    use_cluster
    step "Turning backups off"
    kubectl delete scheduledbackup --all --ignore-not-found
    kubectl delete backup --all --ignore-not-found
    if kubectl get cluster.postgresql.cnpg.io mathboard-db >/dev/null 2>&1; then
        kubectl patch cluster.postgresql.cnpg.io mathboard-db --type merge -p '{"spec":{"plugins":null}}'
        wait_for_database without-plugin
    fi
    kubectl delete objectstore --all --ignore-not-found
    kubectl delete -f backups/seaweedfs.yaml --ignore-not-found
    kubectl delete secret backup-s3 seaweedfs-s3-config --ignore-not-found
    helm uninstall plugin-barman-cloud --namespace cnpg-system --ignore-not-found
    # The plugin holds a leader-election lease it can't release once its RBAC is gone; a reinstall would wait on it.
    kubectl -n cnpg-system delete lease 822e3f5c.cnpg.io --ignore-not-found
    helm uninstall cert-manager --namespace cert-manager --ignore-not-found
    kubectl delete namespace cert-manager --ignore-not-found
    ;;
*)
    sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
    exit 2
    ;;
esac
