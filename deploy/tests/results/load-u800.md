800 simulated users in groups of 10 sharing a document, each making one edit every 1000 ms, held for 40 s. Every edit is delivered to the other 9 users in its group. k6 and the whole cluster share one machine, so treat absolute numbers as indicative.

| Backend replicas | Connections ok | Edits/s in | Deliveries/s out | Fan-out p50 | p95 | p99 | max | Dropped sockets | Pod restarts | Cluster CPU (cores) | k6 CPU (cores) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 800/807 | 527 | 3720 | 236 ms | 458 ms | 555 ms | 749 ms | 0 | 0 | 3.5 | 1.4 |
| 3 | 800/801 | 628 | 5287 | 109 ms | 292 ms | 386 ms | 1040 ms | 0 | 0 | 6.6 | 2.3 |
| 5 | 800/801 | 627 | 5290 | 63 ms | 208 ms | 286 ms | 958 ms | 0 | 0 | 8.1 | 2.4 |
