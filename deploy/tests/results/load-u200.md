200 simulated users in groups of 10 sharing a document, each making one edit every 1000 ms, held for 40 s. Every edit is delivered to the other 9 users in its group. k6 and the whole cluster share one machine, so treat absolute numbers as indicative.

| Backend replicas | Connections ok | Edits/s in | Deliveries/s out | Fan-out p50 | p95 | p99 | max | Dropped sockets | Pod restarts | Cluster CPU (cores) | k6 CPU (cores) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 200/200 | 159 | 1348 | 4 ms | 7 ms | 10 ms | 122 ms | 0 | 0 | 1.2 | 0.6 |
| 3 | 200/201 | 159 | 1345 | 4 ms | 7 ms | 9 ms | 32 ms | 0 | 0 | 1.6 | 0.5 |
| 5 | 200/200 | 159 | 1346 | 5 ms | 8 ms | 10 ms | 36 ms | 0 | 0 | 1.9 | 0.6 |
