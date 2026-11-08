# ==============================================================================
# WAPCentral — Cloud Run Build & Deployment Script for wapcentral-admin-api (PowerShell)
# Target Service: wapcentral-admin-api
# Target Region:  asia-south1 (Mumbai)
# Target Project: wapcentral-prod
# ==============================================================================

[CmdletBinding()]
param (
    [string]$ProjectId = $env:GCP_PROJECT_ID,
    [string]$Region = $env:GCP_REGION
)

if (-not $ProjectId) { $ProjectId = "wapcentral-prod" }
if (-not $Region) { $Region = "asia-south1" }

$ServiceName = "wapcentral-admin-api"
$ServiceModule = "admin-api"
$ServicePort = 8080
$ServiceMemory = "512Mi"
$ServiceAccount = "sa-admin-api@$ProjectId.iam.gserviceaccount.com"

# Compute Commit SHA and Image Tag
$CommitSha = "manual-" + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
try {
    $env:GIT_CONFIG_GLOBAL = "NUL"
    $gitSha = (git rev-parse --short HEAD 2>$null)
    if ($gitSha) { $CommitSha = $gitSha }
} catch {}

$ImageTag = "$Region-docker.pkg.dev/$ProjectId/wapcentral/${ServiceName}:${CommitSha}"
$LatestTag = "$Region-docker.pkg.dev/$ProjectId/wapcentral/${ServiceName}:latest"

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "🚀 Deploying WAPCentral Admin API to Google Cloud Run" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "Project ID:      $ProjectId"
Write-Host "Region:          $Region"
Write-Host "Cloud Run Name:  $ServiceName"
Write-Host "Source Module:   services/$ServiceModule"
Write-Host "Container Image: $ImageTag"
Write-Host "Service Account: $ServiceAccount"
Write-Host "=============================================================================="

# ------------------------------------------------------------------------------
# 1. Pre-Flight Quality Check
# ------------------------------------------------------------------------------
Write-Host "`n📦 [1/4] Running pre-flight build & test verification..." -ForegroundColor Yellow
pnpm --filter @wapcentral/admin-api build
if ($LASTEXITCODE -ne 0) {
    Write-Error "admin-api build failed"
    exit 1
}
pnpm --filter @wapcentral/admin-api test -- integrationGuide
if ($LASTEXITCODE -ne 0) {
    Write-Error "admin-api tests failed"
    exit 1
}
Write-Host "✓ Pre-flight tests passed successfully." -ForegroundColor Green

# ------------------------------------------------------------------------------
# 2. Cloud Build Container Build
# ------------------------------------------------------------------------------
Write-Host "`n🏗️  [2/4] Building container image via Google Cloud Build..." -ForegroundColor Yellow
gcloud builds submit . `
  --config=infrastructure/gcloud/cloudbuild.yaml `
  --substitutions=_SERVICE="$ServiceModule",_IMAGE_TAG="$ImageTag" `
  --project="$ProjectId"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Cloud Build failed"
    exit 1
}

# Tag as latest
gcloud artifacts docker images add-tag "$ImageTag" "$LatestTag" --quiet 2>$null
Write-Host "✓ Container built and registered at $ImageTag" -ForegroundColor Green

# ------------------------------------------------------------------------------
# 3. Cloud Run Deployment
# ------------------------------------------------------------------------------
Write-Host "`n☁️  [3/4] Deploying to Cloud Run ($ServiceName in $Region)..." -ForegroundColor Yellow
gcloud run deploy "$ServiceName" `
  --image="$ImageTag" `
  --region="$Region" `
  --project="$ProjectId" `
  --platform=managed `
  --port="$ServicePort" `
  --memory="$ServiceMemory" `
  --min-instances=1 `
  --max-instances=20 `
  --concurrency=80 `
  --timeout=300 `
  --service-account="$ServiceAccount" `
  --set-env-vars=NODE_ENV=production,ENVIRONMENT=production,FIREBASE_PROJECT_ID="$ProjectId",PORT="$ServicePort",CORS_ORIGINS="https://wapcentral.webappypie.com,https://wapcentral-prod.web.app" `
  --set-secrets=OPENAI_API_KEY=OPENAI_API_KEY:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,PROMOTION_SIGNING_SECRET=PROMOTION_SIGNING_SECRET:latest `
  --allow-unauthenticated `
  --traffic=100

if ($LASTEXITCODE -ne 0) {
    Write-Error "Cloud Run deploy failed"
    exit 1
}
Write-Host "✓ Cloud Run deployment finished with 100% traffic migration." -ForegroundColor Green

# ------------------------------------------------------------------------------
# 4. Post-Deployment Verification
# ------------------------------------------------------------------------------
Write-Host "`n🔍 [4/4] Verifying health and connectivity..." -ForegroundColor Yellow
$ServiceUrl = gcloud run services describe "$ServiceName" --region="$Region" --project="$ProjectId" --format='value(status.url)' 2>$null

if ($ServiceUrl) {
    Write-Host "Direct Cloud Run URL: $ServiceUrl"
    try {
        Invoke-RestMethod -Uri "$ServiceUrl/health" | ConvertTo-Json
    } catch {
        Write-Warning "Could not query direct health: $_"
    }
}

Write-Host "`nProxy check via Firebase Hosting (Custom Domain):"
try {
    Invoke-RestMethod -Uri "https://wapcentral.webappypie.com/api/platform/v1/health" | ConvertTo-Json
} catch {
    Write-Warning "Could not query proxy health: $_"
}

Write-Host "`n🎉 Deployment of $ServiceName completed successfully!" -ForegroundColor Green
