param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")),
  [string]$BuildDate = "",
  [int]$MaxRetries = 5,
  [int]$BuildLookbackDays = 8
)

$ErrorActionPreference = "Stop"

# Locate PMTiles CLI.
$pmtiles = Get-Command pmtiles -ErrorAction SilentlyContinue
if (-not $pmtiles) {
  $candidates = @(
    (Join-Path $ProjectRoot ".game-tools\pmtiles\pmtiles.exe"),
    (Join-Path $ProjectRoot "tools\pmtiles\pmtiles.exe")
  )

  $pmtilesExe = $null

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      $pmtilesExe = $candidate
      break
    }
  }

  if (-not $pmtilesExe) {
    # Also search recursively in the known tool folders in case the executable
    # is inside a versioned/extracted subfolder.
    foreach ($folder in @(
      (Join-Path $ProjectRoot ".game-tools\pmtiles"),
      (Join-Path $ProjectRoot "tools\pmtiles")
    )) {
      if (Test-Path $folder) {
        $found = Get-ChildItem -Path $folder -Filter "pmtiles.exe" -Recurse -ErrorAction SilentlyContinue |
          Select-Object -First 1

        if ($found) {
          $pmtilesExe = $found.FullName
          break
        }
      }
    }
  }

  if (-not $pmtilesExe) {
    throw "pmtiles was not found. Put pmtiles.exe in PATH, .game-tools\pmtiles, or tools\pmtiles."
  }
}
else {
  $pmtilesExe = $pmtiles.Source
}

$outDir = Join-Path $ProjectRoot "public\game\map\real"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Test-ProtomapsBuild {
  param([string]$Url)

  & $pmtilesExe show $Url --header-json *> $null
  return ($LASTEXITCODE -eq 0)
}

# If -BuildDate is provided explicitly, use exactly that build.
# Otherwise, search backwards from today until a published build is found.
$source = $null
$resolvedBuildDate = $null

if ($BuildDate) {
  $candidateUrl = "https://build.protomaps.com/$BuildDate.pmtiles"
  Write-Host "Checking requested Protomaps build $BuildDate..." -ForegroundColor DarkGray

  if (-not (Test-ProtomapsBuild $candidateUrl)) {
    throw "Requested Protomaps build $BuildDate is not available: $candidateUrl"
  }

  $source = $candidateUrl
  $resolvedBuildDate = $BuildDate
}
else {
  Write-Host "Searching for the latest available Protomaps build..." -ForegroundColor Yellow

  for ($daysBack = 0; $daysBack -lt $BuildLookbackDays; $daysBack++) {
    $candidateDate = (Get-Date).AddDays(-$daysBack).ToString("yyyyMMdd")
    $candidateUrl = "https://build.protomaps.com/$candidateDate.pmtiles"

    Write-Host "  Test $candidateDate..." -ForegroundColor DarkGray

    if (Test-ProtomapsBuild $candidateUrl) {
      $source = $candidateUrl
      $resolvedBuildDate = $candidateDate
      break
    }
  }

  if (-not $source) {
    throw "No recent Protomaps build was found during the last $BuildLookbackDays days."
  }
}

$regions = @(
  @{ id="london";     bbox="-0.72,51.20,0.42,51.82" },
  @{ id="berlin";     bbox="12.72,52.12,14.02,52.82" },
  @{ id="randstad";   bbox="3.85,51.65,5.72,52.70" },
  @{ id="brussels";   bbox="3.88,50.55,4.92,51.15" },
  @{ id="madrid";     bbox="-4.28,39.90,-3.02,41.08" },
  @{ id="milan";      bbox="8.40,45.05,9.88,46.03" },
  @{ id="warsaw";     bbox="20.30,51.78,21.72,52.72" },
  @{ id="lisbon";     bbox="-9.78,38.40,-8.62,39.18" },
  @{ id="prague";     bbox="13.72,49.72,15.02,50.48" },
  @{ id="bern";       bbox="6.62,46.45,8.28,47.48" },
  @{ id="new-york";   bbox="-74.65,40.25,-73.30,41.15" },
  @{ id="ottawa";     bbox="-76.35,44.85,-74.95,45.85" },
  @{ id="tokyo";      bbox="138.80,35.25,140.45,36.20" },
  @{ id="vienna";     bbox="15.65,47.75,16.95,48.65" },
  @{ id="copenhagen"; bbox="11.55,55.35,13.05,56.15" },
  @{ id="stockholm";  bbox="17.25,59.00,19.05,59.75" },
  @{ id="oslo";       bbox="10.05,59.55,11.35,60.25" },
  @{ id="helsinki";   bbox="24.20,59.85,25.65,60.55" },
  @{ id="athens";     bbox="22.70,37.55,24.35,38.45" },
  @{ id="budapest";   bbox="18.20,47.15,19.80,47.85" },
  @{ id="istanbul";   bbox="28.20,40.60,30.25,41.55" },
  @{ id="sao-paulo";  bbox="-47.35,-24.25,-45.75,-23.15" },
  @{ id="sydney";     bbox="150.25,-34.25,151.75,-33.45" }
)

function Test-PmtilesFile {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    return $false
  }

  $item = Get-Item $Path
  if ($item.Length -le 0) {
    return $false
  }

  & $pmtilesExe verify $Path *> $null
  return ($LASTEXITCODE -eq 0)
}

Write-Host ""
Write-Host "CLU Metropole V40 - real basemap installer with resume/retry" -ForegroundColor Cyan
Write-Host "PMTiles CLI: $pmtilesExe" -ForegroundColor DarkGray
Write-Host "Build: $resolvedBuildDate" -ForegroundColor Green
Write-Host "Source: $source" -ForegroundColor DarkGray
Write-Host "Output: $outDir" -ForegroundColor DarkGray
Write-Host "Retries per region: $MaxRetries" -ForegroundColor DarkGray
Write-Host ""

foreach ($region in $regions) {
  $output = Join-Path $outDir ($region.id + ".pmtiles")

  if (Test-PmtilesFile $output) {
    $size = (Get-Item $output).Length
    Write-Host "[SKIP] $($region.id) already valid - $([math]::Round($size / 1MB, 1)) MB" -ForegroundColor Green
    continue
  }

  if (Test-Path $output) {
    Write-Host "[CLEAN] $($region.id) partial or invalid file removed" -ForegroundColor DarkYellow
    Remove-Item $output -Force
  }

  $success = $false

  for ($attempt = 1; $attempt -le $MaxRetries; $attempt++) {
    Write-Host "[START] $($region.id) - attempt $attempt/$MaxRetries" -ForegroundColor Yellow

    & $pmtilesExe extract $source $output "--bbox=$($region.bbox)"
    $extractExitCode = $LASTEXITCODE

    if ($extractExitCode -eq 0 -and (Test-PmtilesFile $output)) {
      $size = (Get-Item $output).Length
      Write-Host "[OK] $($region.id) - $([math]::Round($size / 1MB, 1)) MB" -ForegroundColor Green
      $success = $true
      break
    }

    Write-Host "[RETRY] $($region.id) failed on attempt $attempt" -ForegroundColor DarkYellow

    if (Test-Path $output) {
      Remove-Item $output -Force -ErrorAction SilentlyContinue
    }

    if ($attempt -lt $MaxRetries) {
      $delay = [math]::Min(10 * $attempt, 30)
      Write-Host "Waiting $delay seconds before retry..." -ForegroundColor DarkGray
      Start-Sleep -Seconds $delay
    }
  }

  if (-not $success) {
    throw "Extraction failed for $($region.id) after $MaxRetries attempts. Run the script again later; previously valid regions will be skipped."
  }
}

Write-Host ""
Write-Host "All real basemaps are installed and verified in: $outDir" -ForegroundColor Green