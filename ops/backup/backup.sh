#!/bin/bash
set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Assumes script is located in ops/backup/
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
BACKUP_DIR="${PROJECT_ROOT}/backups"
ENV_FILE="${PROJECT_ROOT}/.env"
LOG_FILE="${BACKUP_DIR}/backup.log"

DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_NAME="gymholik_backup_${DATE}.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

# Replace 'myremote' with your actual rclone remote name
RCLONE_REMOTE="myremote:gymholik_backups"
RETENTION_DAYS=14

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Starting MongoDB backup..."

# Load environment variables from .env
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
else
    log "ERROR: .env file not found at $ENV_FILE"
    exit 1
fi

# Run mongodump inside the container and pipe output to host file
if docker exec gymholik-mongodb mongodump \
    --username "${MONGO_ROOT_USER}" \
    --password "${MONGO_ROOT_PASSWORD}" \
    --authenticationDatabase admin \
    --db gymholik \
    --archive --gzip > "$BACKUP_PATH"; then
    log "Backup created successfully at $BACKUP_PATH"
else
    log "ERROR: mongodump failed!"
    rm -f "$BACKUP_PATH"
    exit 1
fi

# Upload to remote storage via rclone
log "Uploading to remote storage ($RCLONE_REMOTE)..."
if rclone copy "$BACKUP_PATH" "$RCLONE_REMOTE" --log-file="$LOG_FILE" --log-level=INFO; then
    log "Upload successful."
else
    log "ERROR: rclone upload failed! Ensure rclone is configured."
    # We do not exit here so we can still clean up old local backups
fi

# Cleanup old local backups
log "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "gymholik_backup_*.gz" -type f -mtime +$RETENTION_DAYS -delete
log "Cleanup complete."

log "Backup process finished successfully."
