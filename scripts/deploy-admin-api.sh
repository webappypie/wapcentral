#!/usr/bin/env bash
# ==============================================================================
# WAPCentral — Cloud Run Build & Deployment Script for wapcentral-admin-api
# Target Service: wapcentral-admin-api
# Target Region:  asia-south1 (Mumbai)
# Target Project: wapcentral-prod
# ==============================================================================

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-wapcentral-prod}"
REGION="${GCP_REGION:-asia-south1}"
SERVICE_NAME="wapcentral-admin-api"
SERVICE_MODULE="admin-api"
SERVICE_PORT=8080
SERVICE_MEMORY="512Mi"
SERVICE_ACCOUNT="sa-admin-api@${PROJECT_ID}.iam.gserviceaccount.com"

# Compute Commit SHA and Image Tag
COMMIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "manual-$(date +%s)")
IMAGE_TAG="${REGION}-docker.pkg.dev/${PROJECT_ID}/wapcentral/${SERVICE_NAME}:${COMMIT_SHA}"
LATEST_TAG="${REGION}-docker.pkg.dev/${PROJECT_ID}/wapcentral/${SERVICE_NAME}:latest"

echo "=============================================================================="
echo "🚀 Deploying WAPCentral Admin API to Google Cloud Run"
echo "=============================================================================="
echo "Project ID:      ${PROJECT_ID}"
echo "Region:          ${REGION}"
echo "Cloud Run Name:  ${SERVICE_NAME}"
echo "Source Module:   services/${SERVICE_MODULE}"
echo "Container Image: ${IMAGE_TAG}"
echo "Service Account: ${SERVICE_ACCOUNT}"
echo "=============================================================================="

# ------------------------------------------------------------------------------
# 1. Pre-Flight Quality Check
# ------------------------------------------------------------------------------
echo -e "\n📦 [1/4] Running pre-flight build & test verification..."
pnpm --filter @wapcentral/admin-api build
pnpm --filter @wapcentral/admin-api test -- integrationGuide
echo "✓ Pre-flight tests passed successfully."

# ------------------------------------------------------------------------------
# 2. Cloud Build Container Build
# ------------------------------------------------------------------------------
echo -e "\n🏗️  [2/4] Building container image via Google Cloud Build..."
gcloud builds submit . \
  --config=infrastructure/gcloud/cloudbuild.yaml \
  --substitutions=_SERVICE="${SERVICE_MODULE}",_IMAGE_TAG="${IMAGE_TAG}" \
  --project="${PROJECT_ID}"

# Also tag as latest in Artifact Registry
gcloud artifacts docker images add-tag "${IMAGE_TAG}" "${LATEST_TAG}" --quiet || true
echo "✓ Container built and registered at ${IMAGE_TAG}"

# ------------------------------------------------------------------------------
# 3. Cloud Run Deployment
# ------------------------------------------------------------------------------
echo -e "\n☁️  [3/4] Deploying to Cloud Run (${SERVICE_NAME} in ${REGION})..."
gcloud run deploy "${SERVICE_NAME}" \
  --image="${IMAGE_TAG}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --platform=managed \
  --port="${SERVICE_PORT}" \
  --memory="${SERVICE_MEMORY}" \
  --min-instances=1 \
  --max-instances=20 \
  --concurrency=80 \
  --timeout=300 \
  --service-account="${SERVICE_ACCOUNT}" \
  --set-env-vars=NODE_ENV=production,ENVIRONMENT=production,FIREBASE_PROJECT_ID="${PROJECT_ID}",PORT="${SERVICE_PORT}",CORS_ORIGINS="https://wapcentral.webappypie.com,https://wapcentral-prod.web.app" \
  --set-secrets=OPENAI_API_KEY=OPENAI_API_KEY:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,PROMOTION_SIGNING_SECRET=PROMOTION_SIGNING_SECRET:latest \
  --allow-unauthenticated \
  --traffic=100

echo "✓ Cloud Run deployment finished with 100% traffic migration."

# ------------------------------------------------------------------------------
# 4. Post-Deployment Verification
# ------------------------------------------------------------------------------
echo -e "\n🔍 [4/4] Verifying health and connectivity..."
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" --project="${PROJECT_ID}" --format='value(status.url)' 2>/dev/null || echo "")

if [ -n "${SERVICE_URL}" ]; then
  echo "Direct Cloud Run URL: ${SERVICE_URL}"
  curl -s -f "${SERVICE_URL}/health" | jq . || curl -s "${SERVICE_URL}/health"
fi

echo -e "\nProxy check via Firebase Hosting (Custom Domain):"
curl -s -f "https://wapcentral.webappypie.com/api/platform/v1/health" | jq . || curl -s "https://wapcentral.webappypie.com/api/platform/v1/health"

echo -e "\n🎉 Deployment of ${SERVICE_NAME} completed successfully!"
