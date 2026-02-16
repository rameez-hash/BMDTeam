# ============================================
# HRMS Deployment Script for Hostinger
# ============================================
# This script builds the Next.js app and prepares 
# a deployment folder ready to upload to Hostinger

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  HRMS - Build for Hostinger Deployment" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$projectRoot = "C:\Users\CBM\Desktop\which"
$deployDir = "$projectRoot\deploy\hostinger-deploy"

# Clean previous deploy
if (Test-Path $deployDir) {
    Write-Host "[1/6] Cleaning previous deploy folder..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $deployDir
}

# Build the Next.js app
Write-Host "[2/6] Building Next.js app (standalone)..." -ForegroundColor Yellow
Set-Location $projectRoot

# Generate Prisma client first
npx prisma generate
if ($LASTEXITCODE -ne 0) { Write-Host "Prisma generate failed!" -ForegroundColor Red; exit 1 }

npx next build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed!" -ForegroundColor Red; exit 1 }
Write-Host "  Build successful!" -ForegroundColor Green

# Create deploy directory
Write-Host "[3/6] Creating deployment package..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $deployDir -Force | Out-Null

# Copy standalone server
Write-Host "  Copying standalone server..." -ForegroundColor Gray
Copy-Item -Recurse "$projectRoot\.next\standalone\*" $deployDir

# Copy static assets
Write-Host "  Copying static assets..." -ForegroundColor Gray
New-Item -ItemType Directory -Path "$deployDir\.next\static" -Force | Out-Null
Copy-Item -Recurse "$projectRoot\.next\static\*" "$deployDir\.next\static\"

# Copy public folder
Write-Host "  Copying public folder..." -ForegroundColor Gray
if (Test-Path "$projectRoot\public") {
    New-Item -ItemType Directory -Path "$deployDir\public" -Force | Out-Null
    Copy-Item -Recurse "$projectRoot\public\*" "$deployDir\public\"
}

# Copy prisma schema (needed for prisma client)
Write-Host "  Copying prisma schema..." -ForegroundColor Gray
New-Item -ItemType Directory -Path "$deployDir\prisma" -Force | Out-Null
Copy-Item "$projectRoot\prisma\schema.prisma" "$deployDir\prisma\"

# Copy Prisma engine binaries from node_modules
Write-Host "[4/6] Copying Prisma engine files..." -ForegroundColor Yellow
$prismaEngineDir = "$projectRoot\node_modules\.prisma"
if (Test-Path $prismaEngineDir) {
    New-Item -ItemType Directory -Path "$deployDir\node_modules\.prisma" -Force | Out-Null
    Copy-Item -Recurse "$prismaEngineDir\*" "$deployDir\node_modules\.prisma\"
}
$prismaClientDir = "$projectRoot\node_modules\@prisma\client"
if (Test-Path $prismaClientDir) {
    New-Item -ItemType Directory -Path "$deployDir\node_modules\@prisma\client" -Force | Out-Null
    Copy-Item -Recurse "$prismaClientDir\*" "$deployDir\node_modules\@prisma\client\"
}

# Create .env template
Write-Host "[5/6] Creating .env template..." -ForegroundColor Yellow
Copy-Item "$projectRoot\deploy\.env.production" "$deployDir\.env"

# Create Passenger entry point (app.js)
Write-Host "  Creating Passenger entry point..." -ForegroundColor Gray
$appJs = @"
// Phusion Passenger entry point for Hostinger
process.env.NODE_ENV = 'production';
process.env.HOSTNAME = '0.0.0.0';
process.env.PORT = process.env.PORT || '3000';

// Load environment variables from .env file
const path = require('path');
const fs = require('fs');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
            const [key, ...vals] = line.split('=');
            const value = vals.join('=').replace(/^["']|["']$/g, '');
            if (key && value) process.env[key.trim()] = value.trim();
        }
    });
}

// Start Next.js standalone server
require('./server.js');
"@
Set-Content -Path "$deployDir\app.js" -Value $appJs

# Summary
Write-Host "`n[6/6] Deployment package ready!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

$size = (Get-ChildItem -Recurse $deployDir | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "Location: $deployDir" -ForegroundColor White
Write-Host "Size: $([math]::Round($size, 1)) MB" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Edit $deployDir\.env with your Hostinger DB credentials" -ForegroundColor Gray
Write-Host "  2. Zip the 'hostinger-deploy' folder" -ForegroundColor Gray
Write-Host "  3. Upload to Hostinger File Manager" -ForegroundColor Gray
Write-Host "  4. Set up Node.js app in hPanel" -ForegroundColor Gray
Write-Host "========================================`n" -ForegroundColor Cyan
