400 simulated users in groups of 10 sharing a document, each making one edit every 1000 ms, held for 40 s. Every edit is delivered to the other 9 users in its group. k6 and the whole cluster share one machine, so treat absolute numbers as indicative.

| Backend replicas | Connections ok | Edits/s in | Deliveries/s out | Fan-out p50 | p95 | p99 | max | Dropped sockets | Pod restarts | Cluster CPU (cores) | k6 CPU (cores) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 400/401 | 318 | 2689 | 5 ms | 11 ms | 16 ms | 26 ms | 0 | 0 | 2.0 | 1.1 |
| 3 | 400/420 | 315 | 2594 | 5 ms | 14 ms | 501 ms | 1865 ms | 0 | 0 | 2.9 | 1.1 |
| 5 | 400/400 | 316 | 2673 | 6 ms | 13 ms | 18 ms | 44 ms | 0 | 0 | 3.7 | 1.1 |
