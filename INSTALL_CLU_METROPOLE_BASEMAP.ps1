$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

Write-Host ""
Write-Host "=== CLU Métropole : installation du fond de carte local ===" -ForegroundColor Cyan
Write-Host ""

$projectRoot = (Get-Location).Path
$mapFolder = Join-Path $projectRoot "public\game\map"
$toolsFolder = Join-Path $projectRoot ".game-tools\pmtiles"
$basemapPath = Join-Path $mapFolder "idf-basemap.pmtiles"

New-Item -ItemType Directory -Path $mapFolder -Force | Out-Null
New-Item -ItemType Directory -Path $toolsFolder -Force | Out-Null

Write-Host "1/4 Installation de la bibliothèque PMTiles..." -ForegroundColor Yellow
pnpm add pmtiles

if ($LASTEXITCODE -ne 0) {
    throw "pnpm add pmtiles a échoué."
}

Write-Host ""
Write-Host "2/4 Préparation de l'outil PMTiles..." -ForegroundColor Yellow

$pmtilesExe = Get-ChildItem `
    -Path $toolsFolder `
    -Filter "pmtiles.exe" `
    -Recurse `
    -ErrorAction SilentlyContinue |
    Select-Object -First 1

if (-not $pmtilesExe) {
    $release = Invoke-RestMethod `
        -Uri "https://api.github.com/repos/protomaps/go-pmtiles/releases/latest" `
        -Headers @{ "User-Agent" = "CLU-Metropole-Installer" }

    $asset = $release.assets |
        Where-Object {
            $_.name -match "Windows" -and
            $_.name -match "x86_64|amd64" -and
            $_.name -match "\.zip$"
        } |
        Select-Object -First 1

    if (-not $asset) {
        throw "Impossible de trouver l'archive Windows x86_64 de PMTiles."
    }

    $archivePath = Join-Path $toolsFolder $asset.name

    Write-Host "Téléchargement : $($asset.name)" -ForegroundColor DarkGray

    Invoke-WebRequest `
        -Uri $asset.browser_download_url `
        -OutFile $archivePath `
        -UseBasicParsing

    Expand-Archive `
        -Path $archivePath `
        -DestinationPath $toolsFolder `
        -Force

    Remove-Item $archivePath -Force

    $pmtilesExe = Get-ChildItem `
        -Path $toolsFolder `
        -Filter "pmtiles.exe" `
        -Recurse |
        Select-Object -First 1
}

if (-not $pmtilesExe) {
    throw "pmtiles.exe est introuvable après l'installation."
}

$pmtilesCommand = $pmtilesExe.FullName

Write-Host "Outil : $pmtilesCommand" -ForegroundColor DarkGray

Write-Host ""
Write-Host "3/4 Recherche du dernier fond Protomaps disponible..." -ForegroundColor Yellow

$planetUrl = $null

for ($daysBack = 0; $daysBack -lt 8; $daysBack++) {
    $candidateDate = (Get-Date).AddDays(-$daysBack).ToString("yyyyMMdd")
    $candidateUrl = "https://build.protomaps.com/$candidateDate.pmtiles"

    Write-Host "Test $candidateDate..." -ForegroundColor DarkGray

    & $pmtilesCommand show $candidateUrl --header-json *> $null

    if ($LASTEXITCODE -eq 0) {
        $planetUrl = $candidateUrl
        break
    }
}

if (-not $planetUrl) {
    throw "Aucun build Protomaps récent n'a été trouvé. Réessaie plus tard."
}

Write-Host "Build choisi : $planetUrl" -ForegroundColor Green

Write-Host ""
Write-Host "4/4 Extraction Île-de-France + périphérie..." -ForegroundColor Yellow
Write-Host "Cela peut prendre plusieurs minutes selon la connexion." -ForegroundColor DarkGray
Write-Host ""

if (Test-Path $basemapPath) {
    Remove-Item $basemapPath -Force
}

& $pmtilesCommand extract `
    $planetUrl `
    $basemapPath `
    --bbox=0.55,47.55,4.55,49.85 `
    --maxzoom=13 `
    --download-threads=8 `
    --overfetch=0.05

if ($LASTEXITCODE -ne 0) {
    throw "L'extraction du fond de carte a échoué."
}

& $pmtilesCommand verify $basemapPath

if ($LASTEXITCODE -ne 0) {
    throw "Le fichier PMTiles créé n'a pas passé la vérification."
}

$file = Get-Item $basemapPath
$sizeMb = [math]::Round($file.Length / 1MB, 1)

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " Fond de carte CLU Métropole installé !" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Fichier : $basemapPath"
Write-Host "Taille  : $sizeMb MB"
Write-Host ""
Write-Host "Recharge ensuite CLU Métropole avec Ctrl + F5." -ForegroundColor Cyan
Write-Host ""
