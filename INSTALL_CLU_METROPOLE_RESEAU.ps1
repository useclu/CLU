$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== CLU Métropole : réseau jouable ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path ".\package.json")) {
    throw "Lance ce script depuis C:\Users\PC\Desktop\CLUGame\original"
}

if (-not (Test-Path ".\node_modules\maplibre-gl")) {
    Write-Host "Installation de MapLibre GL..." -ForegroundColor DarkGray
    pnpm add maplibre-gl
}

New-Item -ItemType Directory -Path ".\public\game\map" -Force | Out-Null

$departments = @("75", "77", "78", "91", "92", "93", "94", "95")

foreach ($department in $departments) {
    $output = ".\public\game\map\communes-$department.geojson"

    if (-not (Test-Path $output)) {
        $url = "https://geo.api.gouv.fr/departements/$department/communes?fields=nom,code,population,codeDepartement&format=geojson&geometry=contour"

        Write-Host "Téléchargement des communes $department..." -ForegroundColor DarkGray

        Invoke-WebRequest -Uri $url -OutFile $output
    }
}

Write-Host ""
Write-Host "Carte et réseau prêts." -ForegroundColor Green
Write-Host "Recharge ensuite http://localhost:3000/game" -ForegroundColor Green
Write-Host ""
