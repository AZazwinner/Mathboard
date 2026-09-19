#!/usr/bin/env bash
# GitOps for the local kind cluster: installs Argo CD and hands the Mathboard chart over to it, so the cluster
# follows what is in git (the images CI publishes, and the values in deploy/gitops/values-kind.yaml).
# Run bash up.sh first.
#
#   bash argocd.sh up            install Argo CD, take Mathboard over from Helm, deploy from git (branch: main)
#   REVISION=some-branch bash argocd.sh up      follow another branch instead
#   bash argocd.sh ui            open the Argo CD UI on http://localhost:8081 (Ctrl+C to stop)
#   bash argocd.sh status        what Argo CD thinks of the app
#   bash argocd.sh down          remove Argo CD and go back to a Helm-managed Mathboard with locally built images
#
# The images come from ghcr.io, so the packages must be public (GitHub > your profile > Packages >
# mathboard-backend / mathboard-frontend > Package settings > Change visibility), and the repository must
# be public for Argo CD to read it without credentials.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"
source versions.env

REVISION="${REVISION:-main}"
TAG="${TAG:-}"   # optional: pin both images to one tag instead of what values-kind.yaml says

step() { printf '\n==> %s\n' "$1"; }

use_cluster() {
    kubectl config use-context "kind-${CLUSTER_NAME}" >/dev/null
}

case "${1:-}" in
up)
    use_cluster
    kubectl get cluster.postgresql.cnpg.io mathboard-db >/dev/null 2>&1 || { echo "Run bash up.sh first." >&2; exit 1; }

    step "Argo CD (chart ${ARGOCD_CHART_VERSION})"
    helm repo add argo https://argoproj.github.io/argo-helm --force-update >/dev/null
    helm repo update argo >/dev/null
    helm upgrade --install argocd argo/argo-cd \
        --version "${ARGOCD_CHART_VERSION}" \
        --namespace argocd --create-namespace \
        -f argocd/values.yaml \
        --wait --timeout 8m

    step "Handing Mathboard over from Helm"
    # Argo CD renders the chart without cluster access, so the session-signing key has to live in a Secret
    # that outlives any render. Keep the existing key if there is one, so nobody is signed out.
    key="$(kubectl get secret mathboard-app -o jsonpath='{.data.SECRET_KEY}' 2>/dev/null | base64 -d || true)"
    if helm status mathboard >/dev/null 2>&1; then
        echo "removing the Helm release (the database is separate and is kept)"
        helm uninstall mathboard --wait
    fi
    if ! kubectl get secret mathboard-app >/dev/null 2>&1; then
        key="${key:-$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')}"
        kubectl create secret generic mathboard-app --from-literal=SECRET_KEY="${key}"
    fi

    step "Application (revision: ${REVISION})"
    sed "s#targetRevision: main#targetRevision: ${REVISION}#" ../gitops/application.yaml | kubectl apply -f -
    if [ -n "${TAG}" ]; then
        kubectl -n argocd patch application mathboard --type merge -p             "{\"spec\":{\"source\":{\"helm\":{\"parameters\":[{\"name\":\"backend.image.tag\",\"value\":\"${TAG}\"},{\"name\":\"frontend.image.tag\",\"value\":\"${TAG}\"}]}}}}"
    fi

    step "Waiting for the first sync"
    for _ in $(seq 1 120); do
        sync="$(kubectl -n argocd get application mathboard -o jsonpath='{.status.sync.status}' 2>/dev/null || true)"
        health="$(kubectl -n argocd get application mathboard -o jsonpath='{.status.health.status}' 2>/dev/null || true)"
        printf '  sync=%s health=%s\n' "${sync:-?}" "${health:-?}"
        [ "${sync}" = "Synced" ] && [ "${health}" = "Healthy" ] && break
        sleep 10
    done
    printf '\nDone. Open the UI with:  bash argocd.sh ui\n'
    ;;
ui)
    use_cluster
    printf 'Argo CD: http://localhost:8081   user: admin\n'
    printf 'password: %s\n\n' "$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d)"
    kubectl -n argocd port-forward svc/argocd-server 8081:80
    ;;
status)
    use_cluster
    kubectl -n argocd get application mathboard
    echo
    kubectl get deploy -l app.kubernetes.io/name=mathboard -o custom-columns='NAME:.metadata.name,IMAGE:.spec.template.spec.containers[0].image,READY:.status.readyReplicas'
    ;;
down)
    use_cluster
    step "Removing Argo CD, and the resources it created for Mathboard"
    kubectl -n argocd delete application mathboard --ignore-not-found
    helm uninstall argocd --namespace argocd --ignore-not-found
    kubectl delete namespace argocd --ignore-not-found
    step "Back to a Helm-managed Mathboard"
    # Let Helm adopt the Secret this script created, so nobody is signed out by the switch.
    if kubectl get secret mathboard-app >/dev/null 2>&1; then
        kubectl label secret mathboard-app app.kubernetes.io/managed-by=Helm --overwrite
        kubectl annotate secret mathboard-app meta.helm.sh/release-name=mathboard meta.helm.sh/release-namespace=default --overwrite
    fi
    bash up.sh
    ;;
*)
    sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
    exit 2
    ;;
esac
