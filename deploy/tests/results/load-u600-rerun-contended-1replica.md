Investigation rerun with the same 10-core CPU burner: 1 replica at 600 users.

600 simulated users in groups of 10 sharing a document, each making one edit every 1000 ms, held for 60 s. Every edit is delivered to the other 9 users in its group. k6 and the whole cluster share one machine, so treat absolute numbers as indicative.

| Backend replicas | Connections ok | Edits/s in | Deliveries/s out | Fan-out p50 | p95 | p99 | max | Dropped sockets | Pod restarts | Cluster CPU (cores) | k6 CPU (cores) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 600/608 | 456 | 3623 | 346 ms | 731 ms | 897 ms | 1085 ms | 0 | 0 | 3.4 | 1.1 |
