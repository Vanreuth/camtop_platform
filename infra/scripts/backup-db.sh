#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
#  infra/scripts/backup-db.sh
#  - Dumps PostgreSQL database inside the running container
#  - Rotates backups older than $BACKUP_RETENTION_DAYS days
#  - Runs automatically from the db-backup container (daily at 02:00 server time)
#  - Can also be invoked manually: docker exec property_valuation_db_backup sh /backup-db.sh
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DATE=$(date +%Y-%m-%d_%H%M)
RETENTION="${BACKUP_RETENTION_DAYS:-7}"

mkdir -p "$BACKUP_DIR"

echo "[$(date '+%F %T')] 🗄  Starting backup: $POSTGRES_DB → $BACKUP_DIR/db-$DATE.sql.gz"

PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  -h "$POSTGRES_HOST" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --no-owner --no-acl \
  | gzip -9 > "$BACKUP_DIR/db-$DATE.sql.gz"

echo "[$(date '+%F %T')] ✅  Backup complete: db-$DATE.sql.gz ($(du -sh "$BACKUP_DIR/db-$DATE.sql.gz" | cut -f1))"

# Rotate old backups
echo "[$(date '+%F %T')] 🗑  Removing backups older than $RETENTION days..."
find "$BACKUP_DIR" -maxdepth 1 -type f -name "*.sql.gz" -mtime "+$RETENTION" -delete
echo "[$(date '+%F %T')] 📦  Remaining backups:"
ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "  (none)"