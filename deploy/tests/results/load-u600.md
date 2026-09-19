600 simulated users in groups of 10 sharing a document, each making one edit every 1000 ms, held for 40 s. Every edit is delivered to the other 9 users in its group. k6 and the whole cluster share one machine, so treat absolute numbers as indicative.

| Backend replicas | Connections ok | Edits/s in | Deliveries/s out | Fan-out p50 | p95 | p99 | max | Dropped sockets | Pod restarts | Cluster CPU (cores) | k6 CPU (cores) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 600/605 | 473 | 3988 | 67 ms | 193 ms | 250 ms | 361 ms | 0 | 0 | 3.4 | 1.6 |
| 3 | 600/601 | 473 | 3988 | 64 ms | 1689 ms | 3611 ms | 4524 ms | 0 | 0 | 5.8 | 2.3 |
| 5 | 600/602 | 471 | 3976 | 37 ms | 155 ms | 234 ms | 870 ms | 0 | 0 | 7.7 | 2.1 |
