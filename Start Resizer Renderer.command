#!/bin/bash

set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
RENDERER_URL="http://127.0.0.1:3000/api/local-renderer-health"
WEBSITE_URL="https://wb-gen.vercel.app"
SERVER_PID=""

finish() {
  local status=$?

  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
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

cd "$PROJECT_DIR"

echo
echo "Resizer local renderer"
echo "======================"
echo

if [ -x "/opt/homebrew/bin/brew" ]; then
  export PATH="/opt/homebrew/bin:$PATH"
elif [ -x "/usr/local/bin/brew" ]; then
  export PATH="/usr/local/bin:$PATH"
fi

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

if [ ! -x "node_modules/.bin/nuxt" ] || [ ! -f "node_modules/playwright/package.json" ]; then
  echo "Installing Resizer packages…"
  npm ci
fi

echo "Checking Playwright Chromium…"
npx playwright install chromium

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
