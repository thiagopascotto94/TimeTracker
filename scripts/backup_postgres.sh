#!/usr/bin/env bash
set -Eeuo pipefail

# ==============================================================================
# PostgreSQL Automatic Backup Script
# ==============================================================================

BACKUP_DIR="${BACKUP_DIR:-/var/backups/cronos}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M")
FILENAME="backup_${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

# Database connection details from environment or defaults
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-cronos}"
DB_USER="${DB_USER:-postgres}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting backup of database '${DB_NAME}' on host '${DB_HOST}'..."

# Run pg_dump and compress with gzip securely
if PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}" | gzip > "${FILEPATH}"; then
    echo "[$(date)] SUCCESS: Backup created successfully at ${FILEPATH}"
else
    echo "[$(date)] ERROR: PostgreSQL backup failed!" >&2
    # Optional alert hook (e.g. curl webhook or send email) can be added here
    exit 1
fi

# Cleanup backups older than retention period
echo "[$(date)] Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "backup_*.sql.gz" -mtime +${RETENTION_DAYS} -exec rm -f {} \;

echo "[$(date)] Backup rotation completed. Current backups in ${BACKUP_DIR}:"
ls -lh "${BACKUP_DIR}"

# ==============================================================================
# Cronjob Setup Instructions:
# To run daily at 2:00 AM, add the following to root crontab (`crontab -e`):
# 0 2 * * * /bin/bash /opt/cronos/scripts/backup_postgres.sh >> /var/log/cronos_backup.log 2>&1
# ==============================================================================
