# 3. Metrics, and autoscaling on open connections

## Problem

Load testing (see `deploy/tests/README.md`) found problems that took a profiler and log digging to
explain: probes killing busy pods, a save that got slower as documents grew, a connection budget that
ran out. None of it was visible from outside the process. There was also no way to answer "how many
replicas does this need right now?" other than picking a number.

## Decision

1. **The backend exposes a small set of Prometheus metrics on its own port** (`METRICS_PORT`, 9100 in the
   chart). It is a separate listener, not a route on the API, so the gateway can never expose it: a
   request to `api.localhost:8080/metrics` is a 404. The set is chosen to explain the failures we have
   already seen: open WebSockets, live documents, edits per second (local vs arriving from another
   replica), document save time and failures, Valkey errors, database pool use against its limit,
   HTTP rate and latency, and **event-loop lag**, which climbs before saturation shows up anywhere else.
2. **Nothing is labelled by document, user or URL.** HTTP metrics use the route template
   (`/docs/{doc_id}`), and every unknown path shares one `unmatched` label, so the number of series is
   fixed however much traffic there is or what anyone requests. Gauges such as connections are computed
   from the live room registry at scrape time, so there is no counter to keep in step with it.
3. **Prometheus finds backends through `prometheus.io/*` pod annotations**, using the community chart
   trimmed to a server with 6 hours of retention, no persistence and no Alertmanager. It also reads
   per-container CPU and memory from the kubelet. Five alert rules are evaluated and shown on its Alerts
   page; nothing is sent anywhere.
4. **Grafana ships one dashboard, provisioned from the repo** (`deploy/kind/observability/dashboards`),
   with the data source pre-configured and viewing open without a login on the port-forward.
5. **KEDA scales the backend on `sum(mathboard_websocket_connections)`**, targeting 50 connections per
   replica, between 2 and 5 replicas. KEDA turns that Prometheus query into a standard
   HorizontalPodAutoscaler. Scale-up is quick (2 pods per 30 s) and scale-down is slow (one pod per
   minute, only after 5 minutes of lower demand), because removing a replica drops its WebSockets. If
   Prometheus can't be queried for three polls, KEDA holds 3 replicas rather than guess.
6. **Monitoring and autoscaling are opt-in** (`bash deploy/kind/observability.sh up`) and cost roughly
   0.5 GiB more pod memory in the kind cluster (measured: Grafana about 250 MiB, Prometheus 100 to 300 MiB
   depending on how long it has run, KEDA about 75 MiB). The chart runs fine without them: `autoscaling.enabled`
   defaults to false, and the metrics endpoint is harmless when nothing scrapes it.
7. **The connection budget follows the autoscaler.** The chart's guard from ADR 0002 now checks
   `autoscaling.maxReplicas` instead of `backend.replicas` when autoscaling is on, so the autoscaler
   cannot grow the fleet past what Postgres allows.

## Why connections, and why 50

The scarce resources per replica are database connections, memory per open document, and the CPU spent
applying and re-broadcasting edits, and all three grow with the number of connected users. CPU alone
would react only once a replica is already busy. In the load tests a single replica held 400 users at
under 15 ms fan-out latency (p95) and fell behind only near 800, so 50 per replica leaves a wide margin.
The number is a starting point to tune, not a measured optimum.

## Alternatives considered

- **HPA on CPU.** No extra components, and CPU is what finally saturates. But it scales after the fact,
  and a replica full of idle readers looks idle while still holding connections and memory.
- **A plain HPA on a custom metric** needs an adapter (prometheus-adapter) and a rules file mapping
  Prometheus series to the Kubernetes metrics API. KEDA replaces both with a few lines in a
  ScaledObject, and adds a fallback and a pause switch (used by the load-test scripts so they can pin a
  replica count).
- **The Prometheus Operator (`kube-prometheus-stack`)** is the usual production answer, with
  ServiceMonitor resources. It is several more pods, so plain annotation discovery is used here; moving
  to ServiceMonitors is a contained change.
- **Serving `/metrics` from the API port** is simpler, but it would need the gateway to filter the path.
  A separate port makes the exposure impossible instead of configured.

## Consequences

- **The autoscaler ignores changes under 10%**, a Kubernetes HPA default. At 220 users it held 4
  replicas (55 connections each against a target of 50) rather than 5. That is intended behaviour,
  and the dashboard says so.
- Scaling now depends on Prometheus being up; the fallback covers a short outage, not a long one.
- Scale-down still drops the WebSockets of the removed pod. Clients reconnect on their own and
  the chaos suite covers that path, but it is a blip. The slow scale-down keeps it rare.
- Event-loop lag and save time are visible per pod, and they explained the earlier odd 3-replica latency result
  (see [deploy/tests/README.md](../../deploy/tests/README.md#the-3-replica-600-user-latency-explained)). It also
  showed that connections are a proxy: what saturates a backend is the edit-applying work, which every replica
  hosting a document repeats. Scaling on event-loop lag, alongside connections, would track that directly.
