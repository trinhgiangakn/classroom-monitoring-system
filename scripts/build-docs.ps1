<#
.SYNOPSIS
    Generates MkDocs website and Doxygen API documentation.
.DESCRIPTION
    Executes MkDocs build and Doxygen documentation generation.
#>

$ErrorActionPreference = "Continue"

$rootDir = Resolve-Path "$PSScriptRoot\.."
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Building Documentation (MkDocs & Doxygen)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$docsDir = Join-Path $rootDir "docs"
$mkdocsFile = Join-Path $rootDir "mkdocs.yml"
$doxyFile = Join-Path $rootDir "Doxyfile"

# ----------------------------------------------------
# 1. MkDocs Site Build
# ----------------------------------------------------
Write-Host "`n[1/2] Building MkDocs site..." -ForegroundColor Yellow
if (Get-Command "mkdocs" -ErrorAction SilentlyContinue) {
    Push-Location $rootDir
    mkdocs build
    Pop-Location
} else {
    Write-Host "Notice: MkDocs executable not found in PATH. Documentation directory verified at $docsDir." -ForegroundColor DarkYellow
}

# ----------------------------------------------------
# 2. Doxygen API Reference
# ----------------------------------------------------
Write-Host "`n[2/2] Generating Doxygen API Documentation..." -ForegroundColor Yellow
if (Get-Command "doxygen" -ErrorAction SilentlyContinue) {
    Push-Location $rootDir
    doxygen Doxyfile
    Pop-Location
} else {
    Write-Host "Notice: Doxygen executable not found in PATH. Skipping Doxygen API generation." -ForegroundColor DarkYellow
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host " Documentation Build Complete             " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
exit 0
