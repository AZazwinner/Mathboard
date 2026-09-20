Investigation rerun, quiet machine: the original 1, 3, 5 replica sequence at 600 users, on the current code.

600 simulated users in groups of 10 sharing a document, each making one edit every 1000 ms, held for 60 s. Every edit is delivered to the other 9 users in its group. k6 and the whole cluster share one machine, so treat absolute numbers as indicative.

| Backend replicas | Connections ok | Edits/s in | Deliveries/s out | Fan-out p50 | p95 | p99 | max | Dropped sockets | Pod restarts | Cluster CPU (cores) | k6 CPU (cores) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 600/601 | 501 | 4291 | 102 ms | 204 ms | 258 ms | 416 ms | 0 | 0 | 3.8 | 1.6 |
| 3 | 600/603 | 501 | 4297 | 35 ms | 174 ms | 304 ms | 772 ms | 0 | 0 | 6.1 | 2.1 |
| 5 | 600/601 | 501 | 4309 | 27 ms | 122 ms | 196 ms | 595 ms | 0 | 0 | 7.8 | 2.1 |
