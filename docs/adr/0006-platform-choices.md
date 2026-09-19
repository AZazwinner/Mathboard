# 6. Platform choices: kind, Gateway API with Envoy Gateway, CloudNativePG, Helm, Valkey

These were made at the start (Phase 2) and are recorded here so the reasons are not lost.

## Decision

1. **A local multi-node kind cluster**, one control plane and two workers, with the node image pinned by
   digest to Kubernetes 1.36. It is free, runs anywhere Docker does, and is disposable. Three nodes matter:
   they make pod spreading, node-level failures and rolling updates real rather than simulated. Kubernetes 1.36
   is the newest release that both Envoy Gateway v1.9 (1.33 to 1.36) and CloudNativePG 1.30 (1.34 to 1.36)
   support, not kind's newest default.
2. **Gateway API with Envoy Gateway, not an Ingress.** The Kubernetes project announced the retirement of
   ingress-nginx, the most widely used Ingress controller, with maintenance ending in March 2026, and points
   users to Gateway API. Gateway API is the successor, is expressive enough for this application (separate
   hostnames for the app and API, and a request timeout of zero so WebSockets aren't cut off), and Envoy is a
   mature data plane. Two hostnames are used instead of a path prefix because the frontend and backend both
   have routes like `/docs`.
3. **CloudNativePG runs Postgres**, instead of a hand-written StatefulSet. A database on Kubernetes needs
   failover, backups and restores, upgrades and credentials handled correctly; an operator encodes that
   knowledge, and its backup and recovery features are what [ADR 5](0005-database-backups-and-restore-drill.md)
   builds on. It was accepted into the CNCF Sandbox in January 2025, so it is young; writing this by hand is
   still the riskier option for a system holding real data.
4. **Postgres instead of SQLite in the cluster.** SQLite is a file owned by one process, so it can't back more
   than one replica. The application still runs on SQLite for quick local use.
5. **One Helm chart** for the application, with hooks and templating where they earn their place: the
   migration runs as a hook Job before new pods start, the chart refuses configurations that would exceed the
   database's connection limit ([ADR 2](0002-health-probes-and-connection-budget.md)), and secrets are generated
   once and never written down. Kustomize would have been enough for plain manifests, but not for the guard
   and the hooks.
6. **Valkey for cross-replica coordination**, with no persistence on purpose. It carries edit streams,
   cursors, presence and the login rate limits ([ADR 1](0001-multi-replica-document-sync.md)); all of that is
   short-lived, and Postgres remains the source of truth, so a Valkey restart costs seconds of lag and
   nothing else. It is BSD-licensed and speaks the Redis protocol, so a standard client library works.

## Alternatives considered

- **k3s or minikube** in place of kind: also fine locally; kind's multi-node clusters in plain Docker, and its
  use in CI, decided it.
- **Cloud Kubernetes** (a managed cluster) would be closer to production, but is not free.
- **Other Postgres operators, or Patroni,** are established; CloudNativePG's declarative backup and recovery
  model and active development were the deciding factors, not a claim that the others are worse.

## Consequences

- The version pins mean upgrading Kubernetes is a deliberate step: check both projects' support first.
- A three-node cluster in Docker needs several gigabytes of memory (about 3.3 GiB measured before any
  optional layers), which is why the production server, at 4 GB, keeps running the plain application.
