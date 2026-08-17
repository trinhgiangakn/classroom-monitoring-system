<#
.SYNOPSIS
    Runs all integration tests for the Classroom Monitoring System.
.DESCRIPTION
    Executes integration test suites against Backend API, MySQL, and MQTT flows.
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
Write-Host " Running Integration Tests                " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$integrationFailed = $false
$backendDir = Join-Path $rootDir "backend"

if (Test-Path $backendDir) {
    Push-Location $backendDir
    try {
        $testFiles = Get-ChildItem -Path "tests/integration" -Filter "*.js" | ForEach-Object { $_.FullName }
        if ($testFiles.Count -gt 0) {
            foreach ($file in $testFiles) {
                $relPath = Resolve-Path -Relative $file
                Write-Host "`nRunning Integration Test: $relPath" -ForegroundColor Yellow
                node $file
                if ($LASTEXITCODE -ne 0) {
                    $integrationFailed = $true
                }
            }
        } else {
            Write-Host "No backend integration test files found." -ForegroundColor DarkYellow
        }
    } catch {
        Write-Host "Error executing integration tests: $_" -ForegroundColor Red
        $integrationFailed = $true
    } finally {
        Pop-Location
    }
} else {
    Write-Host "Backend directory not found at $backendDir" -ForegroundColor Red
    $integrationFailed = $true
}

# ----------------------------------------------------
# Final Summary
# ----------------------------------------------------
Write-Host "`n==========================================" -ForegroundColor Cyan
if ($integrationFailed) {
    Write-Host " ❌ INTEGRATION TESTS FAILED OR REQUIRED SERVER STARTUP" -ForegroundColor Red
    Write-Host "==========================================" -ForegroundColor Cyan
    exit 1
} else {
    Write-Host " ✅ ALL INTEGRATION TESTS EXECUTED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Cyan
    exit 0
}
