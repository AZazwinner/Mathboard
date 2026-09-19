# 5. Database backups, point-in-time recovery, and a restore drill

## Problem

The database is a single CloudNativePG instance on a local volume. Losing it, or running one bad
migration or `DELETE`, would lose every document. A backup that has never been restored is only a hope.

## Decision

1. **Continuous WAL archiving plus a nightly base backup**, through CloudNativePG's Barman Cloud plugin, into
   an S3-compatible object store. Together they allow restoring to any moment since the oldest base backup,
   not just to the moment of a backup. Recovery points older than 7 days are deleted.
2. **The plugin, not the in-tree `barmanObjectStore`.** CloudNativePG deprecated the built-in integration in
   1.26 in favour of plugins and is phasing it out of the core operator. The plugin needs cert-manager for
   the certificates between it and the operator, so `backups.sh` installs both.
3. **SeaweedFS is the local S3 endpoint** (Apache 2.0, one pod, 128 MiB requested). MinIO was the usual choice,
   but its community edition no longer publishes images. Only the `ObjectStore` resource names the endpoint
   and credentials, so pointing at S3, GCS or R2 changes that one resource.
4. **Backups are opt-in and applied as a patch** (`kubectl patch` of `spec.plugins` on the Cluster), so the
   base cluster manifest and a plain `up.sh` don't depend on cert-manager or the object store.
5. **A restore drill proves it** (`bash deploy/tests/run-restore-drill.sh`): write 100 rows, take a base
   backup, write 50 more and note the time, write 50 after that and wait until the WAL containing them is
   archived, then restore a second cluster to the noted time. It passes only if the restored database has
   the first 150 rows and not the last 50, and every real application table has exactly the same row count
   as the original. It cleans up after itself.

## Measured

On the demo database (about 60,000 blocks and 2,600 documents): a base backup took 14 s in one run and 50 s in
the next, and a restore to a ready cluster, including replaying WAL up to the target time, took 51 s and 52 s. Every table
matched, and the rows written after the target time were correctly absent
(`deploy/tests/results/restore-drill-latest.md`).

## Alternatives considered

- **Volume snapshots** are fast, but kind's storage has no snapshot-capable CSI driver to demonstrate them.
- **A `pg_dump` CronJob** is simple and portable, but is logical (slow to restore at size), has no
  point-in-time recovery, and loses everything since the last dump.
- **A managed database** removes the problem and the learning. It is also not free.

## Consequences

- **The demo object store lives in the cluster** on an `emptyDir`, so the backups die with it. That
  shows the mechanism, and is not protection against losing the machine. A real deployment points the
  `ObjectStore` at storage outside the cluster.
- Turning backups on restarts the database once, to add the plugin's sidecar.
- The recovery point is as recent as the last archived WAL segment. Postgres archives a segment when it fills
  or on `archive_timeout`, so the very latest writes can be missing from a restore after a total loss. The
  drill forces a segment switch to make its result deterministic.
- Helm never deletes CRDs, so `backups.sh down` leaves the cert-manager and `ObjectStore` definitions behind.
  That is harmless and lets a later `up` reuse them.
- After one `down` and `up`, the reinstalled plugin sat for 18 minutes waiting for its leader-election
  lease, which timed out Helm. `down` now deletes the lease, and a repeated cycle then completed normally. I
  did not isolate why the lease was not released in the first place.
