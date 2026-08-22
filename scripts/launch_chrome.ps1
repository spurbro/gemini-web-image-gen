# ==============================================================================
# launch_chrome.ps1 - Safe, Dedicated Chrome Launcher for Gemini Web CDP
# Zero cookie/credential copying for privacy & security
# ==============================================================================

param (
    [int]$Port = 9222,
    [string]$ProfileDir = (Join-Path $env:USERPROFILE ".chrome-gemini-bridge"),
    [string]$GeminiUrl = "https://gemini.google.com/app"
)

# 1. Check if Chrome is already listening on port 9222
try {
    $res = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/version" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "[CDP] Chrome is already running on port $Port." -ForegroundColor Green
    exit 0
} catch {
    # Port not active, continue
}

# 2. Find Chrome executable
$chromeCandidates = @(
    (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe"),
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)

$chromePath = $null
foreach ($path in $chromeCandidates) {
    if (Test-Path $path) {
        $chromePath = $path
        break
    }
}

if (-not $chromePath) {
    Write-Error "Could not find chrome.exe in standard locations. Please install Chrome or set CHROME_PATH."
    exit 1
}

# 3. Ensure dedicated profile directory exists
if (-not (Test-Path $ProfileDir)) {
    New-Item -ItemType Directory -Path $ProfileDir -Force | Out-Null
}

Write-Host "[CDP] Starting dedicated Chrome instance on port $Port..." -ForegroundColor Cyan
Write-Host "[CDP] Executable: $chromePath" -ForegroundColor Gray
Write-Host "[CDP] Profile: $ProfileDir" -ForegroundColor Gray

$args = @(
    "--remote-debugging-port=$Port",
    "--user-data-dir=`"$ProfileDir`"",
    "--no-first-run",
    "--no-default-browser-check",
    "--start-maximized",
    "$GeminiUrl"
)

Start-Process -FilePath $chromePath -ArgumentList $args

# 4. Wait for debugging port
$ready = $false
for ($i = 1; $i -le 15; $i++) {
    Start-Sleep -Seconds 1
    try {
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/version" -TimeoutSec 1 -ErrorAction Stop
        if ($res.webSocketDebuggerUrl) {
            $ready = $true
            break
        }
    } catch {}
}

if ($ready) {
    Write-Host "[CDP] ✓ Successfully connected to Chrome on port $Port!" -ForegroundColor Green
} else {
    Write-Host "[CDP] Chrome process started. Ready for connection." -ForegroundColor Yellow
}
