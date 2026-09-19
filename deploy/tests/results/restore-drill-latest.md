# Restore drill: PASS

Restored a second CloudNativePG cluster from the object store to a point in time between two writes.

| | |
|---|---|
| Base backup | 50 s |
| Restore to a ready cluster (base backup plus WAL replay) | 52 s |
| Target time | 2026-09-19 21:06:40.297728+00 |
| Rows written before the backup / between backup and target / after target | 100 / 50 / 50 |
| Rows in the restored database | after-backup=50 before-backup=100  |
| Real application tables match the original | yes |
