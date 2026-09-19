# 2. Health probes and the database connection budget

Both decisions came out of load-testing the multi-replica setup (see `deploy/tests/README.md`), where
the system did not degrade gracefully: it fell over in ways that made the overload worse.

## Problem

1. **Kubernetes killed backends for being busy.** At 800 simulated users the backend pods were
   restarted ("Container backend failed liveness probe, will be restarted"). Each restart dropped every
   WebSocket on that pod, the survivors took the load, and they failed the same way. The liveness probe
   was `/health` with the default 1 second timeout, and `/health` was a plain `def`, so it ran on a
   worker thread and competed for Python's GIL with the heavy work. Readiness (`/ready`) ran
   `SELECT 1` through the same small connection pool as everything else, so under load it waited for a
   free connection and pulled healthy but busy pods out of service.
2. **Postgres ran out of connections.** With 5 replicas, each allowed to open up to 30 connections, the
   ceiling was 150 against Postgres's default `max_connections` of 100. New connections were refused
   ("remaining connection slots are reserved for roles with the SUPERUSER attribute"), which broke
   permission checks and, worse, the final save when a document's last user left.
3. **A database restart failed the deploy.** The migration Job crash-looped while Postgres was
   restarting into new settings, and Kubernetes' growing restart back-off outlasted Helm's timeout.

## Decision

- **Liveness only detects a stuck event loop, not a slow one.** `/health` is `async def`, so it is
  answered directly by the event loop with no thread hop, and the probe allows 5 seconds and 6
  consecutive failures (about a minute) before restarting. Overload should shed load, not trigger a
  restart that makes it worse.
- **Readiness reports a background check.** A task pings the database every 2 seconds off the request
  path; `/ready` returns the cached result and reports not ready only if the last success is older than
  15 seconds (or shutdown has started). A probe never waits on the pool.
- **The connection budget is enforced.** Each replica's pool is 5 plus 5 overflow, Postgres allows 200
  (`spec.postgresql.parameters.max_connections` in the CloudNativePG Cluster, which the operator applies
  with a restart), and the Helm chart refuses to render if `replicas x (pool + overflow)` exceeds
  `database.maxConnections`. That allows a little under 20 replicas before either number has to change,
  because Postgres keeps a few connections for itself (superuser and replication).
- **The migration Job retries itself** (up to 60 attempts, 3 seconds apart) instead of depending on
  Kubernetes' pod restart back-off.

## Alternatives considered

- **A connection pooler (PgBouncer, via CloudNativePG's Pooler resource)** would decouple replicas from
  Postgres connections entirely and is the right next step once replicas are autoscaled. It adds a
  component, so for now the budget is enforced arithmetically.
- **Removing the liveness probe.** A wedged process would then never be restarted.

## Consequences

- A genuinely deadlocked event loop is restarted after roughly a minute instead of 30 seconds.
- Readiness can lag a real database outage by up to 15 seconds.
- Autoscaling replicas must respect the same budget; the chart guard only covers values set through Helm,
  not `kubectl scale`.
