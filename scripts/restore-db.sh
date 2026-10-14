#!/usr/bin/env bash
# ToolPadi Database Restore Utility
# Usage: ./scripts/restore-db.sh <path_to_backup_file.sql.gz>

set -e

if [ -z "$1" ]; then
  echo "Error: Please specify the backup file to restore."
  echo "Usage: $0 backups/toolpadi_backup_YYYYMMDD_HHMMSS.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file not found at ${BACKUP_FILE}"
  exit 1
fi

echo "⚠️  WARNING: This will restore the database from ${BACKUP_FILE} and overwrite existing records!"
read -p "Type 'RESTORE' to confirm: " CONFIRMATION

if [ "${CONFIRMATION}" != "RESTORE" ]; then
  echo "Aborted by user."
  exit 0
fi

echo "Restoring database..."

if [ -n "${DATABASE_URL}" ]; then
  gunzip -c "${BACKUP_FILE}" | psql "${DATABASE_URL}"
elif [ -n "${PGHOST}" ]; then
  gunzip -c "${BACKUP_FILE}" | PGPASSWORD="${PGPASSWORD}" psql \
    -h "${PGHOST}" \
    -p "${PGPORT:-5432}" \
    -U "${PGUSER:-postgres}" \
    -d "${PGDATABASE:-toolpadi}"
else
  gunzip -c "${BACKUP_FILE}" | docker exec -i toolpadi_postgres psql -U "${POSTGRES_USER:-toolpadi_user}" -d "${POSTGRES_DB:-toolpadi}"
fi

echo "✅ Database restored successfully from ${BACKUP_FILE}."
