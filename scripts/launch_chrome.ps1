# ==============================================================================
# launch_chrome.ps1 - Launch Chrome with Remote Debugging Port for Gemini Web CDP
# ==============================================================================

param (
    [int]$Port = 9222,
    [string]$ProfileDir = (Join-Path $env:USERPROFILE ".chrome-gemini-bridge"),
    [string]$GeminiUrl = "https://gemini.google.com/app"
)

# 1. Check if Chrome is already listening on port 9222
try {
    $res = Invoke-RestMethod -Uri "http://localhost:$Port/json/version" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "[CDP] Chrome is already running and listening on port $Port." -ForegroundColor Green
    Write-Host "[CDP] WebSocket URL: $($res.webSocketDebuggerUrl)" -ForegroundColor Gray
    exit 0
} catch {
    # Port not active, continue to launch
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
    Write-Error "Could not find chrome.exe in standard locations. Please install Chrome or verify path."
    exit 1
}

# 3. Ensure profile directory exists (Persistent storage for 1-time login)
if (-not (Test-Path $ProfileDir)) {
    New-Item -ItemType Directory -Path $ProfileDir -Force | Out-Null
}

$userSrc = Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data"
$dstDef = Join-Path $ProfileDir "Default"
if ((-not (Test-Path $dstDef)) -and (Test-Path $userSrc)) {
    Write-Host "[CDP] 🔄 First-time setup: Initializing persistent bridge profile from Default Chrome..." -ForegroundColor Cyan
    $srcLocalState = Join-Path $userSrc "Local State"
    $dstLocalState = Join-Path $ProfileDir "Local State"
    if (Test-Path $srcLocalState) {
        Copy-Item -Path $srcLocalState -Destination $dstLocalState -Force -ErrorAction SilentlyContinue
    }

    $srcDef = Join-Path $userSrc "Default"
    if (Test-Path $srcDef) {
        $syncItems = @("Preferences", "Secure Preferences", "Login Data", "Web Data", "Network\Cookies")
        foreach ($item in $syncItems) {
            $s = Join-Path $srcDef $item
            $d = Join-Path $dstDef $item
            if (Test-Path $s) {
                $pDir = Split-Path $d -Parent
                if (-not (Test-Path $pDir)) { New-Item -ItemType Directory -Path $pDir -Force | Out-Null }
                Copy-Item -Path $s -Destination $d -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

Write-Host "[CDP] Starting Chrome with remote debugging on port $port..." -ForegroundColor Cyan
Write-Host "[CDP] Executable: $chromePath" -ForegroundColor Gray
Write-Host "[CDP] User Profile: $profileDir" -ForegroundColor Gray

$args = @(
    "--remote-debugging-port=$port",
    "--user-data-dir=`"$profileDir`"",
    "--no-first-run",
    "--no-default-browser-check",
    "--start-maximized",
    "$geminiUrl"
)

Start-Process -FilePath $chromePath -ArgumentList $args

# 4. Wait for debugging port to become responsive
$maxWait = 10
$ready = $false

for ($i = 1; $i -le $maxWait; $i++) {
    Start-Sleep -Seconds 1
    try {
        $res = Invoke-RestMethod -Uri "http://localhost:$port/json/version" -TimeoutSec 1 -ErrorAction Stop
        if ($res.webSocketDebuggerUrl) {
            $ready = $true
            break
        }
    } catch {}
}

if ($ready) {
    Write-Host "[CDP] Successfully connected to Chrome on port $port!" -ForegroundColor Green
} else {
    Write-Host "[CDP] Chrome started. If not yet ready, please wait a few seconds." -ForegroundColor Yellow
}
