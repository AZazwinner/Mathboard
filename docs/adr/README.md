# Decision records

Each record states the problem, what was decided, what else was considered, and what it costs. They are
numbered in the order they were made.

| # | Decision | In one line |
|---|---|---|
| [1](0001-multi-replica-document-sync.md) | Multi-replica document sync | Edits travel through per-document Valkey streams and merge into Postgres, so any number of replicas converge and nothing is overwritten. |
| [2](0002-health-probes-and-connection-budget.md) | Health probes and the connection budget | Liveness detects a stuck event loop, not a busy one; the chart refuses to exceed Postgres's connection limit. Found by load testing. |
| [3](0003-metrics-and-connection-based-autoscaling.md) | Metrics and autoscaling | Low-cardinality Prometheus metrics on a private port; KEDA scales the backend on open WebSocket connections. |
| [4](0004-ci-supply-chain-and-gitops.md) | CI, supply chain and GitOps | Pinned actions, scan before publish, provenance and SBOM, Argo CD deploying from git. |
| [5](0005-database-backups-and-restore-drill.md) | Backups and the restore drill | Continuous WAL archiving and base backups, proven by restoring to a chosen moment. |
| [6](0006-platform-choices.md) | Platform choices | kind, Gateway API with Envoy Gateway, CloudNativePG, Helm and Valkey, and why. |

The system as a whole is drawn in [architecture.md](../architecture.md). Measured behaviour (chaos, load,
autoscaling and restore results) is in [deploy/tests/README.md](../../deploy/tests/README.md).
