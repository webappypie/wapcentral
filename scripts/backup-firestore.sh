#!/usr/bin/env bash
# ==============================================================================
# WAPCentral — Production Firestore Backup Management Script
# Phase 13 — Production Release
# ==============================================================================
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-wapcentral-prod}"
BUCKET_NAME="${BUCKET_NAME:-wapcentral-firestore-backups-prod}"
TIMESTAMP="$(date -u +"%Y%m%d_%H%M%SZ")"
OUTPUT_PREFIX="exports/${TIMESTAMP}"
ACTION="export"

print_usage() {
  echo "Usage: $0 [options]"
  echo "Options:"
  echo "  --project <id>       Google Cloud Project ID (default: wapcentral-prod)"
  echo "  --bucket <name>      Target Cloud Storage Bucket (default: wapcentral-firestore-backups-prod)"
  echo "  --collections <ids>  Comma-separated collection IDs to export (default: all)"
  echo "  --list               List existing backup exports in the bucket"
  echo "  --help               Display this help message"
  exit 0
}

COLLECTIONS=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT_ID="$2"
      shift 2
      ;;
    --bucket)
      BUCKET_NAME="$2"
      shift 2
      ;;
    --collections)
      COLLECTIONS="$2"
      shift 2
      ;;
    --list)
      ACTION="list"
      shift
      ;;
    --help)
      print_usage
      ;;
    *)
      echo "Unknown option: $1"
      print_usage
      ;;
  esac
done

echo "============================================================"
echo " WAPCentral Firestore Backup Tool"
echo " Environment: ${PROJECT_ID}"
echo " Bucket:      gs://${BUCKET_NAME}"
echo " Time (UTC):  ${TIMESTAMP}"
echo "============================================================"

if [ "$ACTION" = "list" ]; then
  echo "Listing backups in gs://${BUCKET_NAME}/exports/..."
  gsutil ls -l "gs://${BUCKET_NAME}/exports/" || echo "No backups found or bucket empty."
  exit 0
fi

DESTINATION="gs://${BUCKET_NAME}/${OUTPUT_PREFIX}"
echo "Initiating Firestore export to: ${DESTINATION}"

EXPORT_CMD=(gcloud firestore export "${DESTINATION}" --project="${PROJECT_ID}")

if [ -n "$COLLECTIONS" ]; then
  echo "Exporting specified collections: ${COLLECTIONS}"
  EXPORT_CMD+=(--collection-ids="${COLLECTIONS}")
else
  echo "Exporting ALL collections across entire database..."
fi

"${EXPORT_CMD[@]}"

echo "============================================================"
echo "✅ Firestore export initiated successfully."
echo "Destination: ${DESTINATION}"
echo "To monitor operation progress:"
echo "  gcloud firestore operations list --project=${PROJECT_ID}"
echo "============================================================"
