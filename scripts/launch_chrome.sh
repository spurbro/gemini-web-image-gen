#!/usr/bin/env bash
# ==============================================================================
# launch_chrome.sh - Launch Chrome with Remote Debugging on macOS / Linux
# ==============================================================================

PORT=${GEMINI_DEBUG_PORT:-9222}
PROFILE_DIR="${GEMINI_USER_DATA_DIR:-$HOME/.chrome-gemini-bridge}"
GEMINI_URL="https://gemini.google.com/app"

# 1. Check if port is open
if curl -s "http://127.0.0.1:$PORT/json/version" > /dev/null 2>&1; then
  echo "[CDP] Chrome is already running on port $PORT."
  exit 0
fi

# 2. Find Chrome Binary
CHROME_BIN=""
if [ -n "$CHROME_PATH" ] && [ -x "$CHROME_PATH" ]; then
  CHROME_BIN="$CHROME_PATH"
elif [ "$(uname)" = "Darwin" ]; then
  CANDIDATES=(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
    "$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  )
  for c in "${CANDIDATES[@]}"; do
    if [ -x "$c" ]; then CHROME_BIN="$c"; break; fi
  done
else
  CANDIDATES=(
    "/usr/bin/google-chrome"
    "/usr/bin/google-chrome-stable"
    "/usr/bin/chromium"
    "/usr/bin/chromium-browser"
    "/snap/bin/chromium"
  )
  for c in "${CANDIDATES[@]}"; do
    if [ -x "$c" ]; then CHROME_BIN="$c"; break; fi
  done
fi

if [ -z "$CHROME_BIN" ]; then
  echo "Error: Google Chrome executable not found. Please install Chrome or set CHROME_PATH."
  exit 1
fi

mkdir -p "$PROFILE_DIR"
echo "[CDP] Starting Chrome ($CHROME_BIN) on port $PORT..."
echo "[CDP] Profile: $PROFILE_DIR"

"$CHROME_BIN" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE_DIR" \
  --no-first-run \
  --no-default-browser-check \
  "$GEMINI_URL" > /dev/null 2>&1 &

for i in {1..15}; do
  sleep 1
  if curl -s "http://127.0.0.1:$PORT/json/version" > /dev/null 2>&1; then
    echo "[CDP] ✓ Connected to Chrome on port $PORT!"
    exit 0
  fi
done

echo "[CDP] Chrome process started."
