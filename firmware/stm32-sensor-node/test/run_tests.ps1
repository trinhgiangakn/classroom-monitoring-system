<#
.SYNOPSIS
    Compiles and executes the host-based unit test suite for STM32 Sensor Node firmware.
.DESCRIPTION
    Uses GCC on the host machine to compile and execute algorithmic and protocol tests
    without requiring physical target hardware or an ST-Link debugger.
#>

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $scriptDir

try {
    Write-Host "====================================================" -ForegroundColor Cyan
    Write-Host " Compiling STM32 Firmware Unit Test Suite...       " -ForegroundColor Cyan
    Write-Host "====================================================" -ForegroundColor Cyan

    $outputExe = "run_stm32_tests.exe"
    if (Test-Path $outputExe) {
        Remove-Item $outputExe -Force
    }

    $cFiles = @(
        "test_main.c",
        "test_filter.c",
        "test_sensor_math.c",
        "test_ble_json.c",
        "..\Core\Src\stm_filter.c"
    )

    $includePath = "..\Core\Inc"

    & gcc -Wall -Wextra -I $includePath $cFiles -o $outputExe

    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n[ERROR] Compilation Failed!" -ForegroundColor Red
        exit 1
    }

    Write-Host "`nRunning Test Suite Execution..." -ForegroundColor Yellow
    & ".\$outputExe"

    if ($LASTEXITCODE -ne 0) {
        exit 1
    }
}
finally {
    Pop-Location
}
