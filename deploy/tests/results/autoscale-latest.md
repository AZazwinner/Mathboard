# Autoscaling run: 220 users

Users ramped up over 30s and held for 150s (seconds are counted from the start of sampling).
Load ended at t=188s. Started at 2 replicas, peaked at 4.
First scale-up at t=28s.
Unexpected socket closes during the run: 0.
Fan-out latency p95: 12 ms.

| t (s) | replicas wanted | ready | connections per replica (autoscaler's view) |
|---:|---:|---:|---:|
| 0 | 2 | 2 | 0 |
| 28 | 4 | 2 | 76 |
| 483 | 3 | 3 | 0 |
| 543 | 2 | 2 | 0 |
