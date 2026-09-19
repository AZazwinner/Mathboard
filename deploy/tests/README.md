# Resilience and load tests

Two scripted tests for the multi-replica setup. Both run against the local kind cluster (`bash deploy/kind/up.sh`)
and need `kubectl`, and for the load test `docker`.

## Chaos test

```
bash deploy/tests/run-chaos.sh                 # every scenario
bash deploy/tests/run-chaos.sh -s hard         # one scenario
```

Twelve simulated browsers, each holding its own full Yjs document like the real editor does, connect to one
shared document through the Gateway and edit while a failure is injected into the cluster. A scenario passes
only if all four hold afterwards, and the script exits non-zero otherwise:

- the clients were spread over more than one backend replica (otherwise the run proved nothing),
- every client holds every edit that was made,
- all clients hold the identical document, and
- Postgres holds every block.

Latest run (`results/chaos-latest.json`), 3 backend replicas:

| Scenario | What was injected | Edits | Converged after last edit | Most reconnects by one client | Blocks in Postgres / in clients |
|---|---|---|---|---|---|
| none | no failure injected | 540 | 0.5 s | 0 | 541/541 |
| graceful | deleted mathboard-backend-569895db58-twd8x gracefully, like a rolling deploy | 540 | 0.5 s | 1 | 541/541 |
| hard | force-killed mathboard-backend-569895db58-dwncp with no shutdown, like a crash | 540 | 0.5 s | 1 | 541/541 |
| valkey-down | Valkey scaled to zero for 10s | 540 | 2.7 s | 0 | 541/541 |
| rolling-restart | rolling restart of every backend pod | 2,400 | 2.2 s | 2 | 2401/2401 |

## Load test

```
bash deploy/tests/run-load.sh                                   # 1, 3 and 5 replicas, 300 users
bash deploy/tests/run-load.sh --replicas "1 3 5" --vus 800 --tag u800
```

[k6](https://k6.io/) (run in Docker) simulates users in groups of 10 who share a document. Each user types
into one of eight shared paragraphs, one edit per second, so every edit fans out to the other nine. k6's
JavaScript can't run Yjs, so `load/gen_updates.py` pre-generates real Yjs updates with pycrdt; k6 stamps the
current time into each one just before sending, and every receiver reads it back. **Fan-out latency** is the
time from an edit being sent to another user's socket receiving it. Sender and receivers are inside one k6
process, so they share a clock. Edits sent before the receiving socket opened are history that a newly
hosting replica replays to a new arrival, not fan-out, so they are counted separately.

Each run ramps up for 20 s, holds for 40 s, and reports connection success, latency percentiles, sockets
dropped, backend pods restarted by Kubernetes, and CPU. Results are in `results/`.

### Results

Same code, same machine, 3 backend replica counts. "Edits/s in" is averaged over the whole run including the
ramp, so its ceiling for 800 users is about 680.

**200 users**

| Backend replicas | Connections ok | Edits/s in | Deliveries/s out | Fan-out p50 | p95 | p99 | max | Dropped sockets | Pod restarts | Cluster CPU (cores) | k6 CPU (cores) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 200/200 | 159 | 1348 | 4 ms | 7 ms | 10 ms | 122 ms | 0 | 0 | 1.2 | 0.6 |
| 3 | 200/201 | 159 | 1345 | 4 ms | 7 ms | 9 ms | 32 ms | 0 | 0 | 1.6 | 0.5 |
| 5 | 200/200 | 159 | 1346 | 5 ms | 8 ms | 10 ms | 36 ms | 0 | 0 | 1.9 | 0.6 |

**400 users**

| Backend replicas | Connections ok | Edits/s in | Deliveries/s out | Fan-out p50 | p95 | p99 | max | Dropped sockets | Pod restarts | Cluster CPU (cores) | k6 CPU (cores) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 400/401 | 318 | 2689 | 5 ms | 11 ms | 16 ms | 26 ms | 0 | 0 | 2.0 | 1.1 |
| 3 | 400/420 | 315 | 2594 | 5 ms | 14 ms | 501 ms | 1865 ms | 0 | 0 | 2.9 | 1.1 |
| 5 | 400/400 | 316 | 2673 | 6 ms | 13 ms | 18 ms | 44 ms | 0 | 0 | 3.7 | 1.1 |

**600 users**

| Backend replicas | Connections ok | Edits/s in | Deliveries/s out | Fan-out p50 | p95 | p99 | max | Dropped sockets | Pod restarts | Cluster CPU (cores) | k6 CPU (cores) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 600/605 | 473 | 3988 | 67 ms | 193 ms | 250 ms | 361 ms | 0 | 0 | 3.4 | 1.6 |
| 3 | 600/601 | 473 | 3988 | 64 ms | 1689 ms | 3611 ms | 4524 ms | 0 | 0 | 5.8 | 2.3 |
| 5 | 600/602 | 471 | 3976 | 37 ms | 155 ms | 234 ms | 870 ms | 0 | 0 | 7.7 | 2.1 |

**800 users**

| Backend replicas | Connections ok | Edits/s in | Deliveries/s out | Fan-out p50 | p95 | p99 | max | Dropped sockets | Pod restarts | Cluster CPU (cores) | k6 CPU (cores) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 800/807 | 527 | 3720 | 236 ms | 458 ms | 555 ms | 749 ms | 0 | 0 | 3.5 | 1.4 |
| 3 | 800/801 | 628 | 5287 | 109 ms | 292 ms | 386 ms | 1040 ms | 0 | 0 | 6.6 | 2.3 |
| 5 | 800/801 | 627 | 5290 | 63 ms | 208 ms | 286 ms | 958 ms | 0 | 0 | 8.1 | 2.4 |

### Reading them

- **Every configuration handled every level:** all connections succeeded, no socket was dropped, no pod
  was restarted. Up to 400 users fan-out p95 is 14 ms or less.
- **Replicas help at the top end.** At 800 users one replica accepted 527 edits/s (about 78% of what was
  offered) while 3 and 5 replicas took 628 (about 93%), and delivered 5.3k messages/s against 3.7k.
- **Replicas cost CPU.** At 400 users the same roughly 316 edits/s took 2.0 cores at 1 replica, 2.9 at 3 and 3.7 at
  5. Every replica that hosts a document applies every edit to it, reads its stream, and saves it, so
  extra replicas buy availability and connection capacity, not cheaper edits.
- **Unexplained:** 3 replicas at 600 users had elevated latency (p95 1.7 s) in this sweep and in both earlier
  ones I ran (5 to 7 s before I fixed the way history was counted), while 1 and 5 replicas were fine. I
  haven't traced it. Candidates are pod placement (3 replicas on 2 workers puts two on one node) and an
  interaction I haven't found. The 3-replica run at 400 users also had a one-off p99 spike.
- **Treat the numbers as indicative.** The load generator and the whole cluster share one laptop (20 logical
  CPUs, hyperthreaded). k6 used 0.5 to 2.4 cores and the cluster up to 8, so at the higher levels the machine,
  not the application, may be the limit, and run-to-run noise is real. Running k6 from a second machine is the
  first thing to change to get trustworthy absolute numbers.

## What these tests found

The first load runs did not pass. Each of these was found by the test, diagnosed with evidence, fixed, and
re-measured:

1. **Postgres ran out of connections at 5 replicas.** Each replica could open 30, and 5 x 30 exceeded
   Postgres's 100. Now pools are 5 + 5, Postgres allows 200, and the Helm chart refuses to render a
   configuration whose worst case exceeds it. ([ADR 2](../../docs/adr/0002-health-probes-and-connection-budget.md))
2. **Saving a document cost 1.5 ms per block.** The block mirror inserted one row per statement:
   20 ms for 10 blocks, 138 ms for 100, 720 ms for 500, 1,546 ms for 1,000. It now inserts in bulk and
   skips the write entirely when a save adds nothing, which is the common case for the other replicas of
   a document. Measured: 1,000 blocks now take about 140 to 190 ms to save when something changed and 35 ms
   when nothing did.
3. **Kubernetes killed overloaded backends, which made overload worse.** The liveness probe timed out at
   800 users, the pod restarted, every socket on it dropped, and the survivors failed the same way.
   `/health` is now answered straight from the event loop, `/ready` reports a background database check
   instead of queueing behind the connection pool, and the probes tolerate slowness. The harness now
   reports pod restarts per run. ([ADR 2](../../docs/adr/0002-health-probes-and-connection-budget.md))
4. **A duplicate block id could stop a document from saving.** The block table is only a derived copy,
   but a primary-key clash there rolled back the real state too. Duplicates are now written once.
5. **A deploy overlapping a database restart failed.** The migration Job crash-looped and Kubernetes'
   back-off outlasted Helm's timeout. The Job now retries itself.
6. **The load test's own metric was wrong.** Replayed history was being counted as slow fan-out,
   producing multi-second maximums at 3 and 5 replicas even at 200 users. Counting only edits sent after
   the receiver connected removed them (a 237 ms maximum instead of 4.7 s for the same configuration and load).

## Known limits and next steps

- One profile of a backend at 800 users (3 replicas) put about 17% of the time it held Python's lock in
  reading the Valkey stream, one blocking read per open document. A single multiplexed read per replica is the
  first thing to try if throughput per replica matters.
- Prometheus metrics and a dashboard (active sockets, rooms, flush time, stream lag) would show why a run
  degraded without a profiler; that is the next phase.
- A connection pooler (PgBouncer) would decouple replica count from Postgres connections.
