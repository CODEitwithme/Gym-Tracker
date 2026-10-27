$ErrorActionPreference = "Stop"

Write-Host "=== Forge/Fit Automated Deployment ===" -ForegroundColor Cyan

# 1. Check Cloudflare authentication
Write-Host "`n[1/6] Checking Cloudflare authentication..." -ForegroundColor Yellow
$whoami = & npx wrangler whoami 2>&1 | Out-String
if ($whoami -match "You are not authenticated") {
    Write-Error "Cloudflare is not authenticated. Please complete the browser login opened for Wrangler."
}
Write-Host "Cloudflare authenticated successfully." -ForegroundColor Green

# 2. Setup KV Namespace if needed
Write-Host "`n[2/6] Configuring Cloudflare KV Namespace..." -ForegroundColor Yellow
$wranglerTomlPath = Join-Path $PSScriptRoot "..\worker\wrangler.toml"
$wranglerToml = Get-Content $wranglerTomlPath -Raw

if ($wranglerToml -match "REPLACE_WITH_YOUR_KV_ID") {
    Write-Host "Creating production KV namespace..." -ForegroundColor Yellow
    $kvProdOutput = & npx --prefix worker wrangler kv namespace create CREDENTIAL_STORE 2>&1 | Out-String
    if ($kvProdOutput -match 'id = "([a-f0-9]+)"') {
        $prodId = $matches[1]
        Write-Host "Found KV ID: $prodId" -ForegroundColor Green
        $wranglerToml = $wranglerToml -replace 'id = "REPLACE_WITH_YOUR_KV_ID"', "id = `"$prodId`""
    } else {
        Write-Warning "Could not automatically parse KV ID from output: $kvProdOutput"
    }

    Write-Host "Creating preview KV namespace..." -ForegroundColor Yellow
    $kvPrevOutput = & npx --prefix worker wrangler kv namespace create CREDENTIAL_STORE --preview 2>&1 | Out-String
    if ($kvPrevOutput -match 'preview_id = "([a-f0-9]+)"') {
        $prevId = $matches[1]
        Write-Host "Found Preview KV ID: $prevId" -ForegroundColor Green
        $wranglerToml = $wranglerToml -replace 'preview_id = "REPLACE_WITH_YOUR_KV_PREVIEW_ID"', "preview_id = `"$prevId`""
    }

    Set-Content -Path $wranglerTomlPath -Value $wranglerToml
    Write-Host "Updated worker/wrangler.toml with KV namespace IDs." -ForegroundColor Green
} else {
    Write-Host "KV namespace IDs already configured." -ForegroundColor Green
}

# 3. Configure Master Encryption Key Secret in Cloudflare
Write-Host "`n[3/6] Setting Cloudflare Worker secret MASTER_ENCRYPTION_KEY..." -ForegroundColor Yellow
$devVarsPath = Join-Path $PSScriptRoot "..\worker\.dev.vars"
$masterKey = ""
if (Test-Path $devVarsPath) {
    $devVars = Get-Content $devVarsPath -Raw
    if ($devVars -match 'MASTER_ENCRYPTION_KEY=([a-f0-9]{64})') {
        $masterKey = $matches[1]
    }
}
if (-not $masterKey) {
    $masterKey = [System.BitConverter]::ToString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).Replace("-", "").ToLower()
}

$proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c echo $masterKey | npx --prefix worker wrangler secret put MASTER_ENCRYPTION_KEY" -NoNewWindow -PassThru -Wait
Write-Host "Master encryption key configured in Cloudflare." -ForegroundColor Green

# 4. Deploy Cloudflare Worker
Write-Host "`n[4/6] Deploying Cloudflare Worker..." -ForegroundColor Yellow
$deployOutput = & npx --prefix worker wrangler deploy 2>&1 | Out-String
Write-Host $deployOutput

$workerUrl = ""
if ($deployOutput -match 'https://[a-zA-Z0-9\.\-]+\.workers\.dev') {
    $workerUrl = $matches[0]
    Write-Host "Worker deployed successfully to: $workerUrl" -ForegroundColor Green
} else {
    Write-Warning "Could not extract worker URL automatically from output."
}

# 5. Build Frontend with Worker URL
Write-Host "`n[5/6] Building Frontend for Production..." -ForegroundColor Yellow
if ($workerUrl) {
    $env:VITE_WORKER_URL = $workerUrl
    Set-Content -Path (Join-Path $PSScriptRoot "..\.env.production") -Value "VITE_WORKER_URL=$workerUrl"
}
& npm run build
Write-Host "Frontend built successfully in dist/." -ForegroundColor Green

# 6. Deploy to Vercel
Write-Host "`n[6/6] Deploying Frontend to Vercel..." -ForegroundColor Yellow
$vercelOutput = & npx vercel --prod --yes 2>&1 | Out-String
Write-Host $vercelOutput

Write-Host "`n=== Deployment Complete ===" -ForegroundColor Cyan
if ($workerUrl) {
    Write-Host "Worker URL: $workerUrl" -ForegroundColor Green
}

