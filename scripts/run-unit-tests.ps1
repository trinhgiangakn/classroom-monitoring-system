<#
.SYNOPSIS
    Runs all unit tests for Backend and Web Frontend components.
.DESCRIPTION
    Configures temporary environment variables to bypass C: drive low space issues
    and executes unit test suites across Backend and Web Frontend modules.
#>

$ErrorActionPreference = "Stop"

# Set up alternative cache and temp directories on D: drive
$dCacheDir = "D:\.npm-cache"
$dTmpDir = "D:\.tmp"

if (-not (Test-Path $dCacheDir)) { New-Item -ItemType Directory -Path $dCacheDir -Force | Out-Null }
if (-not (Test-Path $dTmpDir)) { New-Item -ItemType Directory -Path $dTmpDir -Force | Out-Null }

$env:npm_config_cache = $dCacheDir
$env:TMP = $dTmpDir
$env:TEMP = $dTmpDir

$rootDir = Resolve-Path "$PSScriptRoot\.."
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Running Unit Tests (Classroom Monitoring) " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$backendFailed = $false
$frontendFailed = $false

# ----------------------------------------------------
# 1. Backend Unit Tests
# ----------------------------------------------------
Write-Host "`n[1/2] Running Backend Unit Tests..." -ForegroundColor Yellow
$backendDir = Join-Path $rootDir "backend"

if (Test-Path $backendDir) {
    Push-Location $backendDir
    try {
        # Find test files in backend/tests/unit
        $testFiles = Get-ChildItem -Path "tests/unit" -Filter "*.test.js" | ForEach-Object { $_.FullName }
        if ($testFiles.Count -gt 0) {
            node --test $testFiles
            if ($LASTEXITCODE -ne 0) {
                $backendFailed = $true
            }
        } else {
            Write-Host "No backend unit test files found." -ForegroundColor DarkYellow
        }
    } catch {
        Write-Host "Error executing backend unit tests: $_" -ForegroundColor Red
        $backendFailed = $true
    } finally {
        Pop-Location
    }
} else {
    Write-Host "Backend directory not found at $backendDir" -ForegroundColor Red
    $backendFailed = $true
}

# ----------------------------------------------------
# 2. Web Frontend Unit Tests
# ----------------------------------------------------
Write-Host "`n[2/2] Running Web Frontend Unit Tests..." -ForegroundColor Yellow
$frontendDir = Join-Path $rootDir "web-frontend"

if (Test-Path $frontendDir) {
    Push-Location $frontendDir
    try {
        $vitestBin = Join-Path $frontendDir "node_modules\vitest\vitest.mjs"
        if (Test-Path $vitestBin) {
            node $vitestBin --run
            if ($LASTEXITCODE -ne 0) {
                $frontendFailed = $true
            }
        } else {
            Write-Host "Vitest executable not found in web-frontend/node_modules." -ForegroundColor DarkYellow
        }
    } catch {
        Write-Host "Error executing web-frontend unit tests: $_" -ForegroundColor Red
        $frontendFailed = $true
    } finally {
        Pop-Location
    }
} else {
    Write-Host "Web Frontend directory not found at $frontendDir" -ForegroundColor Red
    $frontendFailed = $true
}

# ----------------------------------------------------
# Final Summary
# ----------------------------------------------------
Write-Host "`n==========================================" -ForegroundColor Cyan
if ($backendFailed -or $frontendFailed) {
    Write-Host " ❌ UNIT TESTS FAILED" -ForegroundColor Red
    Write-Host "   Backend Failed: $backendFailed" -ForegroundColor Red
    Write-Host "   Frontend Failed: $frontendFailed" -ForegroundColor Red
    Write-Host "==========================================" -ForegroundColor Cyan
    exit 1
} else {
    Write-Host " ✅ ALL UNIT TESTS PASSED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Cyan
    exit 0
}
