#!/bin/bash
set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
ENV_FILE="${PROJECT_ROOT}/.env"

if [ -z "$1" ]; then
    echo "Usage: ./restore.sh <path-to-backup-file.gz>"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found at $BACKUP_FILE"
    exit 1
fi

# Load environment variables
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
else
    echo "ERROR: .env file not found at $ENV_FILE"
    exit 1
fi

echo "WARNING: This will drop existing collections in 'gymholik' and overwrite the database!"
read -p "Are you sure you want to proceed? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Restore aborted."
    exit 1
fi

echo "Restoring database from $BACKUP_FILE..."

# Pipe the gzip archive into mongorestore inside the container
if docker exec -i gymholik-mongodb mongorestore \
    --username "${MONGO_ROOT_USER}" \
    --password "${MONGO_ROOT_PASSWORD}" \
    --authenticationDatabase admin \
    --nsInclude="gymholik.*" \
    --drop \
    --archive --gzip < "$BACKUP_FILE"; then
    echo "Restore completed successfully."
else
    echo "ERROR: Restore failed!"
    exit 1
fi
