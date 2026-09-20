Investigation rerun with a 10-core CPU burner (an Alpine container running busy loops) on the same machine: 3 and 5 replicas at 600 users.

600 simulated users in groups of 10 sharing a document, each making one edit every 1000 ms, held for 60 s. Every edit is delivered to the other 9 users in its group. k6 and the whole cluster share one machine, so treat absolute numbers as indicative.

| Backend replicas | Connections ok | Edits/s in | Deliveries/s out | Fan-out p50 | p95 | p99 | max | Dropped sockets | Pod restarts | Cluster CPU (cores) | k6 CPU (cores) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 3 | 600/605 | 487 | 4021 | 571 ms | 2146 ms | 4741 ms | 10711 ms | 0 | 0 | 5.5 | 1.6 |
| 5 | 600/602 | 485 | 4144 | 233 ms | 573 ms | 796 ms | 1803 ms | 0 | 0 | 7.1 | 1.8 |
