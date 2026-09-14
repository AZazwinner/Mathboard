#!/usr/bin/env bash
# Backs up the SQLite database to BACKUP_DIR, then (optionally) uploads it
# off-box with rclone. Intended to run on a schedule (see the cron/systemd
# timer example at the bottom of this file) - a laptop is a single point of
# failure, so backups should not live only on the same disk as the database.
#
# Usage: ./backup-db.sh
# Config (env vars, all optional except none are required to run locally):
#   DB_PATH      - path to the sqlite file (default: ../src/mathboard.db, relative to this script)
#   BACKUP_DIR   - where local backup copies are kept (default: ../backups, relative to this script)
#   KEEP_DAYS    - delete local backups older than this many days (default: 14)
#   RCLONE_REMOTE - e.g. "myremote:mathboard-backups" - if set, each backup is
#                   also uploaded via `rclone copy` (requires rclone configured: `rclone config`)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_PATH="${DB_PATH:-$SCRIPT_DIR/../src/mathboard.db}"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/../backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

if [ ! -f "$DB_PATH" ]; then
    echo "backup-db: no database found at $DB_PATH" >&2
    exit 1
fi

mkdir -p "$BACKUP_DIR"

timestamp="$(date +%Y%m%d-%H%M%S)"
dest="$BACKUP_DIR/mathboard-$timestamp.db"

# `sqlite3 .backup` (not `cp`) so a backup taken while the server is writing
# to the db can't produce a half-written, corrupt copy.
sqlite3 "$DB_PATH" ".backup '$dest'"
gzip "$dest"
echo "backup-db: wrote $dest.gz"

if [ -n "${RCLONE_REMOTE:-}" ]; then
    rclone copy "$dest.gz" "$RCLONE_REMOTE"
    echo "backup-db: uploaded to $RCLONE_REMOTE"
fi

find "$BACKUP_DIR" -name 'mathboard-*.db.gz' -mtime "+$KEEP_DAYS" -delete

# --- One-time setup to run this daily via cron ---
# crontab -e, then add (runs at 3:17am daily; the odd minute avoids piling
# onto whatever else fires exactly on the hour):
#   17 3 * * * DB_PATH=/home/<you>/Mathboard/src/mathboard.db RCLONE_REMOTE=myremote:mathboard-backups /home/<you>/Mathboard/scripts/backup-db.sh >> /home/<you>/backup.log 2>&1
