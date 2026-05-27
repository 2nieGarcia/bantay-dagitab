#!/usr/bin/env bash
# AES-256 encrypted PostgreSQL backup per paper §VI.F.4.
#
# Usage:
#   DATABASE_URL=postgres://... BACKUP_KEY='<passphrase>' ./scripts/backup.sh
#
# Output:
#   backups/backup_YYYYMMDD_HHMMSS.sql.enc
#
# Decrypt later with:
#   openssl enc -d -aes-256-cbc -pbkdf2 -in <file>.enc -pass env:BACKUP_KEY \
#     | psql "$DATABASE_URL"
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"
: "${BACKUP_KEY:?BACKUP_KEY must be set (long random passphrase)}"

OUT_DIR="${BACKUP_DIR:-backups}"
mkdir -p "$OUT_DIR"

STAMP=$(date -u +%Y%m%d_%H%M%S)
OUT_FILE="$OUT_DIR/backup_${STAMP}.sql.enc"

pg_dump --no-owner --no-privileges "$DATABASE_URL" \
  | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
      -out "$OUT_FILE" -pass env:BACKUP_KEY

echo "wrote $OUT_FILE ($(wc -c < "$OUT_FILE") bytes)"
