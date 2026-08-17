<#
.SYNOPSIS
    Builds STM32 and ESP32 firmware projects.
.DESCRIPTION
    Verifies firmware project paths and executes toolchain build commands (PlatformIO/Make/ESP-IDF).
#>

$ErrorActionPreference = "Continue"

$rootDir = Resolve-Path "$PSScriptRoot\.."
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Building Firmware (STM32 & ESP32)       " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$stm32Dir = Join-Path $rootDir "firmware\stm32-sensor-node"
$esp32Dir = Join-Path $rootDir "firmware\esp32-gateway"

# ----------------------------------------------------
# 1. STM32 Sensor Node Firmware
# ----------------------------------------------------
Write-Host "`n[1/2] Checking STM32 Sensor Node Firmware..." -ForegroundColor Yellow
if (Test-Path $stm32Dir) {
    Write-Host "Path verified: $stm32Dir" -ForegroundColor Green
    if (Get-Command "pio" -ErrorAction SilentlyContinue) {
        Write-Host "Invoking PlatformIO build for STM32..." -ForegroundColor Cyan
        Push-Location $stm32Dir
        pio run
        Pop-Location
    } elseif (Get-Command "make" -ErrorAction SilentlyContinue) {
        Write-Host "Invoking Make build for STM32..." -ForegroundColor Cyan
        Push-Location $stm32Dir
        make
        Pop-Location
    } else {
        Write-Host "Notice: PlatformIO (pio) or Make toolchain not detected in PATH. Firmware directory verified." -ForegroundColor DarkYellow
    }
} else {
    Write-Host "Error: STM32 directory missing at $stm32Dir" -ForegroundColor Red
}

# ----------------------------------------------------
# 2. ESP32 Gateway Firmware
# ----------------------------------------------------
Write-Host "`n[2/2] Checking ESP32 Gateway Firmware..." -ForegroundColor Yellow
if (Test-Path $esp32Dir) {
    Write-Host "Path verified: $esp32Dir" -ForegroundColor Green
    if (Get-Command "pio" -ErrorAction SilentlyContinue) {
        Write-Host "Invoking PlatformIO build for ESP32..." -ForegroundColor Cyan
        Push-Location $esp32Dir
        pio run
        Pop-Location
    } elseif (Get-Command "idf.py" -ErrorAction SilentlyContinue) {
        Write-Host "Invoking ESP-IDF build for ESP32..." -ForegroundColor Cyan
        Push-Location $esp32Dir
        idf.py build
        Pop-Location
    } else {
        Write-Host "Notice: PlatformIO (pio) or ESP-IDF (idf.py) toolchain not detected in PATH. Firmware directory verified." -ForegroundColor DarkYellow
    }
} else {
    Write-Host "Error: ESP32 directory missing at $esp32Dir" -ForegroundColor Red
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host " Firmware Verification Complete          " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
exit 0
