#!/usr/bin/env bash
# ToolPadi Database Backup Utility
# Usage: ./scripts/backup-db.sh

set -e

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/toolpadi_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "=========================================================="
echo "Starting PostgreSQL backup: $(date)"
echo "Target output: ${BACKUP_FILE}"
echo "=========================================================="

if [ -n "${DATABASE_URL}" ]; then
  # Direct URL backup
  pg_dump "${DATABASE_URL}" --format=plain --no-owner --no-privileges | gzip > "${BACKUP_FILE}"
elif [ -n "${PGHOST}" ]; then
  # Individual credentials
  PGPASSWORD="${PGPASSWORD}" pg_dump \
    -h "${PGHOST}" \
    -p "${PGPORT:-5432}" \
    -U "${PGUSER:-postgres}" \
    -d "${PGDATABASE:-toolpadi}" \
    --format=plain --no-owner --no-privileges | gzip > "${BACKUP_FILE}"
else
  # Docker Compose container backup fallback
  echo "Checking for running Docker Compose container..."
  docker exec -t toolpadi_postgres pg_dump -U "${POSTGRES_USER:-toolpadi_user}" "${POSTGRES_DB:-toolpadi}" | gzip > "${BACKUP_FILE}"
fi

FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "✅ Backup completed successfully!"
echo "Size: ${FILE_SIZE}"
echo "Location: ${BACKUP_FILE}"

# Optional retention: delete backups older than 14 days
find "${BACKUP_DIR}" -name "toolpadi_backup_*.sql.gz" -type f -mtime +14 -delete || true
echo "Retention check completed."
