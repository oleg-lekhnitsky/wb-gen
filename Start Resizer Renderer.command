#!/bin/bash

set -Eeuo pipefail

LAUNCHER_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_SUPPORT_DIR="$HOME/Library/Application Support/Resizer Renderer"
GITHUB_ARCHIVE_URL="https://github.com/oleg-lekhnitsky/wb-gen/archive/refs/heads/main.zip"
PROJECT_DIR=""
RENDERER_URL="http://127.0.0.1:3000/api/local-renderer-health"
WEBSITE_URL="https://wb-gen.vercel.app"
SERVER_PID=""
DOWNLOAD_TEMP=""

finish() {
  local status=$?

  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi

  if [ -n "$DOWNLOAD_TEMP" ] && [ -d "$DOWNLOAD_TEMP" ]; then
    rm -rf "$DOWNLOAD_TEMP"
  fi

  if [ "$status" -ne 0 ]; then
    echo
    echo "The local renderer could not start."
    echo "Copy the error above if you need help."
    echo
    read -r -p "Press Return to close this window… " _
  fi
}

trap finish EXIT
trap 'exit 130' INT TERM

echo
echo "Resizer local renderer"
echo "======================"
echo

if [ -x "/opt/homebrew/bin/brew" ]; then
  export PATH="/opt/homebrew/bin:$PATH"
elif [ -x "/usr/local/bin/brew" ]; then
  export PATH="/usr/local/bin:$PATH"
fi

if [ -f "$LAUNCHER_DIR/package.json" ] && [ -f "$LAUNCHER_DIR/package-lock.json" ]; then
  PROJECT_DIR="$LAUNCHER_DIR"
  echo "Using the project beside this launcher."
else
  PROJECT_DIR="$APP_SUPPORT_DIR/source"
  DOWNLOAD_TEMP="$(mktemp -d -t resizer-renderer)"

  echo "Downloading the latest renderer from GitHub…"
  if curl --location --fail --silent --show-error \
    "$GITHUB_ARCHIVE_URL" \
    --output "$DOWNLOAD_TEMP/source.zip"; then
    unzip -q "$DOWNLOAD_TEMP/source.zip" -d "$DOWNLOAD_TEMP"
    mkdir -p "$PROJECT_DIR"
    rsync -a --delete \
      --exclude node_modules \
      --exclude .nuxt \
      --exclude .output \
      "$DOWNLOAD_TEMP/wb-gen-main/" \
      "$PROJECT_DIR/"
  elif [ -f "$PROJECT_DIR/package.json" ] && [ -f "$PROJECT_DIR/package-lock.json" ]; then
    echo "GitHub is unavailable. Using the previously downloaded renderer."
  else
    echo "The renderer could not be downloaded from GitHub."
    exit 1
  fi
fi

cd "$PROJECT_DIR"

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # Use the Node version pinned by this project when nvm is installed.
  # shellcheck source=/dev/null
  . "$HOME/.nvm/nvm.sh"
  if ! nvm use; then
    nvm install
    nvm use
  fi
fi

node_major=0
if command -v node >/dev/null 2>&1; then
  node_major="$(node -p "Number(process.versions.node.split('.')[0])")"
fi

if [ "$node_major" -lt 22 ]; then
  if ! command -v brew >/dev/null 2>&1; then
    echo "Node.js 22 is required, but neither Node 22 nor Homebrew was found."
    echo "Install Homebrew from https://brew.sh and run this launcher again."
    exit 1
  fi

  echo "Installing Node.js 22 with Homebrew…"
  if ! brew list node@22 >/dev/null 2>&1; then
    brew install node@22
  fi
  export PATH="$(brew --prefix node@22)/bin:$PATH"
  node_major="$(node -p "Number(process.versions.node.split('.')[0])")"
fi

if [ "$node_major" -lt 22 ]; then
  echo "Unable to activate Node.js 22."
  exit 1
fi

echo "Using Node.js $(node --version)."

if ! command -v ffmpeg >/dev/null 2>&1; then
  if ! command -v brew >/dev/null 2>&1; then
    echo "FFmpeg is required, but Homebrew was not found."
    echo "Install Homebrew from https://brew.sh and run this launcher again."
    exit 1
  fi

  echo "Installing FFmpeg with Homebrew…"
  brew install ffmpeg
fi

echo "Using $(ffmpeg -version 2>&1 | sed -n '1p')."

lock_hash="$(shasum -a 256 package-lock.json | awk '{ print $1 }')"
installed_lock_hash=""
if [ -f "node_modules/.resizer-lock-hash" ]; then
  installed_lock_hash="$(cat node_modules/.resizer-lock-hash)"
fi

if [ ! -x "node_modules/.bin/nuxt" ] \
  || [ ! -f "node_modules/playwright/package.json" ] \
  || [ "$lock_hash" != "$installed_lock_hash" ]; then
  echo "Installing Resizer packages…"
  npm ci
  printf '%s' "$lock_hash" > "node_modules/.resizer-lock-hash"
fi

echo "Checking Playwright Chromium…"
if ! node -e "const { chromium } = require('playwright'); const fs = require('node:fs'); process.exit(fs.existsSync(chromium.executablePath()) ? 0 : 1)"; then
  npx playwright install chromium
fi

if curl --max-time 1 --silent --fail "$RENDERER_URL" >/dev/null 2>&1; then
  echo
  echo "The local renderer is already running."
  open "$WEBSITE_URL"
  echo "You can close this window."
  exit 0
fi

if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port 3000 is already used by another application."
  echo "Stop that application and run this launcher again."
  exit 1
fi

echo
echo "Starting the renderer…"
echo "Keep this window open while rendering."
echo

npm run renderer:local &
SERVER_PID=$!

attempt=0
while [ "$attempt" -lt 60 ]; do
  if curl --max-time 1 --silent --fail "$RENDERER_URL" >/dev/null 2>&1; then
    echo
    echo "Local renderer connected. Opening Resizer…"
    open "$WEBSITE_URL"
    echo
    echo "Renderer ready. Press Control-C or close this window to stop it."
    wait "$SERVER_PID"
    exit $?
  fi

  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    wait "$SERVER_PID"
    exit $?
  fi

  attempt=$((attempt + 1))
  sleep 0.5
done

echo "The renderer did not become ready within 30 seconds."
exit 1
