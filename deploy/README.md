# Running Mathboard on Kubernetes (local)

A 3-node [kind](https://kind.sigs.k8s.io/) cluster (1 control plane, 2 workers) running the whole stack.

## Prerequisites

`docker`, `kind`, `kubectl` and `helm` on your PATH, and a bash shell (Git Bash on Windows).

## Use it

```
bash deploy/kind/up.sh      # create the cluster and deploy everything (safe to re-run)
bash deploy/kind/down.sh    # delete the cluster and its data
```

Then open http://app.localhost:8080. The API is at http://api.localhost:8080. Browsers resolve
`*.localhost` to your own machine on their own; command-line tools on Windows may not, so with
curl use `-H "Host: api.localhost" http://127.0.0.1:8080/...`.

## What runs

| Piece | How |
|---|---|
| Kubernetes | kind, node image pinned by digest to v1.36.4 (see below) |
| Ingress | [Envoy Gateway](https://gateway.envoyproxy.io/) v1.9.1, using the Gateway API (`Gateway` + `HTTPRoute`) |
| Database | PostgreSQL 17 via the [CloudNativePG](https://cloudnative-pg.io/) operator |
| App | Helm chart in `helm/mathboard`: backend, frontend, migration Job, config, routes |

Traffic: `localhost:8080` -> kind node port 30080 -> Envoy -> `app.localhost` goes to the frontend,
`api.localhost` (including WebSockets) goes to the backend.

Two hostnames instead of one path prefix, because the backend and frontend both use paths like `/docs`.

## Decisions worth knowing

- **Kubernetes 1.36, not kind's default 1.37.** Envoy Gateway v1.9 supports Kubernetes 1.33 to 1.36 and
  CloudNativePG 1.30 supports 1.34 to 1.36, so 1.36 is the newest version both support. The image is
  pinned by digest in `kind/kind-config.yaml`.
- **`externalTrafficPolicy: Cluster` on the Envoy Service** (`kind/infra/gateway.yaml`). Envoy Gateway
  defaults it to `Local`, which makes a node forward NodePort traffic only to Envoy pods on that same
  node. kind maps the host port onto the control-plane node, which has no Envoy pod, so requests from
  the host hung while requests from inside the node worked.
- **Migrations are a Helm hook Job** (`pre-install`, `pre-upgrade`) that runs `alembic upgrade head`
  with only `DATABASE_URL`, so a new version's schema is in place before its pods start.
- **`DATABASE_URL` comes from the Secret CloudNativePG generates** (`mathboard-db-app`, key `uri`), so
  no database password is written down anywhere.
- **`SECRET_KEY` is generated once** by the chart and reused on upgrades (via `lookup`), unless you
  pass `--set secretKey=...`.
- **Graceful shutdown:** a 5 second `preStop` sleep lets the Service stop routing before the process
  gets SIGTERM, and a 40 second grace period leaves room for the final document flush.
- **Images are tagged by content** (`dev-<image id>`), so re-running `up.sh` only rolls pods when the
  code actually changed.
- **Frontend URLs are baked in at build time**, so `up.sh` builds the frontend with the
  `app.localhost:8080` / `api.localhost:8080` addresses.

## Useful commands

```
kubectl get pods -A
kubectl logs deploy/mathboard-backend
kubectl exec mathboard-db-1 -c postgres -- psql -U postgres -d mathboard
kubectl scale deploy/mathboard-backend --replicas=3   # see the warning below
```

**Do not run more than one backend replica yet.** Each replica keeps its own in-memory copy of every
open document, so two replicas would diverge and overwrite each other's edits. Fixing that is the next
phase.
