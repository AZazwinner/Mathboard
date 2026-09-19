#!/usr/bin/env bash
# A backup you have never restored is a hope, not a backup. This drill proves the restore path end to end:
#
#   1. writes 100 rows, then takes a base backup
#   2. writes 50 more rows, and notes the time (the target)
#   3. writes 50 rows after the target, and waits until the archived WAL includes them
#   4. restores a second cluster from the object store to exactly the target time
#   5. checks that the restored database has the first 150 rows and not the last 50, and that every table
#      of real application data has the same number of rows as the original
#
# Needs backups on (bash deploy/kind/backups.sh up). Takes a couple of minutes. Exits non-zero on any mismatch.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"
mkdir -p results

STAMP="$(date +%s)"
BACKUP="drill-${STAMP}"
RESTORE="mathboard-db-restore"
PRIMARY="mathboard-db-1"
IMAGE="$(kubectl get cluster.postgresql.cnpg.io mathboard-db -o jsonpath='{.spec.imageName}')"

sql() { # sql <pod> <statement>
    kubectl exec "$1" -c postgres -- psql -U postgres -d mathboard -v ON_ERROR_STOP=1 -tAq -c "$2"
}
say() { printf '\n==> %s\n' "$1"; }
fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }

cleanup() {
    say "Cleaning up"
    kubectl delete cluster.postgresql.cnpg.io "${RESTORE}" --ignore-not-found --wait=false >/dev/null 2>&1 || true
    kubectl delete backup "${BACKUP}" --ignore-not-found >/dev/null 2>&1 || true
    sql "${PRIMARY}" "DROP TABLE IF EXISTS restore_drill" >/dev/null 2>&1 || true
}
trap cleanup EXIT

kubectl get objectstore.barmancloud.cnpg.io mathboard-backups >/dev/null 2>&1 || fail "backups are not on: run bash deploy/kind/backups.sh up"
[ "$(kubectl get cluster.postgresql.cnpg.io mathboard-db -o jsonpath='{.status.conditions[?(@.type=="ContinuousArchiving")].status}')" = "True" ] \
    || fail "WAL archiving is not healthy"
kubectl delete cluster.postgresql.cnpg.io "${RESTORE}" --ignore-not-found >/dev/null

# Row counts of every real table, as one comparable string.
real_counts() {
    sql "$1" "SELECT coalesce(string_agg(table_name || '=' || (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.' || quote_ident(table_name), false, true, '')))[1]::text, ',' ORDER BY table_name), '') FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'restore_drill'"
}

say "1. 100 rows, then a base backup"
sql "${PRIMARY}" "DROP TABLE IF EXISTS restore_drill; CREATE TABLE restore_drill (id serial PRIMARY KEY, phase text NOT NULL, at timestamptz NOT NULL DEFAULT now())"
sql "${PRIMARY}" "INSERT INTO restore_drill (phase) SELECT 'before-backup' FROM generate_series(1, 100)"
ORIGINAL_COUNTS="$(real_counts "${PRIMARY}")"
echo "real tables: ${ORIGINAL_COUNTS}"

backup_started="$(date +%s)"
kubectl apply -f - <<EOF
apiVersion: postgresql.cnpg.io/v1
kind: Backup
metadata:
  name: ${BACKUP}
spec:
  cluster:
    name: mathboard-db
  method: plugin
  pluginConfiguration:
    name: barman-cloud.cloudnative-pg.io
EOF
kubectl wait "backup/${BACKUP}" --for=jsonpath='{.status.phase}'=completed --timeout=300s \
    || fail "the backup did not complete: $(kubectl get backup "${BACKUP}" -o jsonpath='{.status.error}')"
backup_seconds=$(( $(date +%s) - backup_started ))
echo "base backup completed in ${backup_seconds}s"

say "2. 50 more rows, and the target time"
sql "${PRIMARY}" "INSERT INTO restore_drill (phase) SELECT 'after-backup' FROM generate_series(1, 50)"
sleep 2
TARGET="$(sql "${PRIMARY}" "SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') || '+00'")"
sleep 2
echo "target time: ${TARGET}"

say "3. 50 rows after the target, then make sure they are archived"
sql "${PRIMARY}" "INSERT INTO restore_drill (phase) SELECT 'after-target' FROM generate_series(1, 50)"
walfile="$(sql "${PRIMARY}" "SELECT pg_walfile_name(pg_switch_wal())")"
for _ in $(seq 1 60); do
    [ "$(sql "${PRIMARY}" "SELECT coalesce(last_archived_wal >= '${walfile}', false) FROM pg_stat_archiver")" = "t" ] && break
    sleep 2
done
[ "$(sql "${PRIMARY}" "SELECT coalesce(last_archived_wal >= '${walfile}', false) FROM pg_stat_archiver")" = "t" ] || fail "WAL ${walfile} was not archived"
echo "WAL up to ${walfile} is in the object store"

say "4. Restore a second cluster to the target time"
restore_started="$(date +%s)"
kubectl apply -f - <<EOF
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: ${RESTORE}
spec:
  instances: 1
  imageName: ${IMAGE}
  storage:
    size: 2Gi
  resources:
    requests:
      cpu: 100m
      memory: 256Mi
    limits:
      memory: 1Gi
  bootstrap:
    recovery:
      source: origin
      recoveryTarget:
        targetTime: "${TARGET}"
  externalClusters:
    - name: origin
      plugin:
        name: barman-cloud.cloudnative-pg.io
        parameters:
          barmanObjectName: mathboard-backups
          serverName: mathboard-db
EOF
kubectl wait "cluster.postgresql.cnpg.io/${RESTORE}" --for=condition=Ready --timeout=600s || fail "the restored cluster did not become ready"
restore_seconds=$(( $(date +%s) - restore_started ))
echo "restored cluster ready in ${restore_seconds}s"

say "5. Check what came back"
restored="${RESTORE}-1"
counts="$(sql "${restored}" "SELECT phase || '=' || count(*) FROM restore_drill GROUP BY phase ORDER BY phase" | tr '\n' ' ')"
echo "restore_drill rows: ${counts}"
RESTORED_COUNTS="$(real_counts "${restored}")"
echo "real tables: ${RESTORED_COUNTS}"

ok=true
[ "${counts}" = "after-backup=50 before-backup=100 " ] || { echo "expected after-backup=50 before-backup=100 and no after-target rows"; ok=false; }
[ "${RESTORED_COUNTS}" = "${ORIGINAL_COUNTS}" ] || { echo "the real tables differ from the original"; ok=false; }

verdict="PASS"
${ok} || verdict="FAIL"
{
    echo "# Restore drill: ${verdict}"
    echo
    echo "Restored a second CloudNativePG cluster from the object store to a point in time between two writes."
    echo
    echo "| | |"
    echo "|---|---|"
    echo "| Base backup | ${backup_seconds} s |"
    echo "| Restore to a ready cluster (base backup plus WAL replay) | ${restore_seconds} s |"
    echo "| Target time | ${TARGET} |"
    echo "| Rows written before the backup / between backup and target / after target | 100 / 50 / 50 |"
    echo "| Rows in the restored database | ${counts} |"
    echo "| Real application tables match the original | $([ "${RESTORED_COUNTS}" = "${ORIGINAL_COUNTS}" ] && echo yes || echo NO) |"
} > results/restore-drill-latest.md

echo
echo "${verdict}: restored to ${TARGET} in ${restore_seconds}s (details in deploy/tests/results/restore-drill-latest.md)"
${ok}
