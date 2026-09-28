#!/bin/bash
# package.sh — build the game, wrap it as a native app, and stage it for Steam.
#
#   1. bundles the web game            -> dist/bundle.js
#   2. wraps it with Electron          -> release/.../Home Invasion 3D.app
#   3. copies the .app into            -> steam/content/
#   4. prints the steamcmd upload line (it does NOT upload for you — that needs
#      your Steam login and app ID)
#
# Usage:  ./package.sh            build + stage
#         ./package.sh --upload   build + stage + run steamcmd
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
STEAM_DIR="$ROOT/steam"
CONTENT="$STEAM_DIR/content"

UPLOAD=0
[ "${1:-}" = "--upload" ] && UPLOAD=1

echo "==> 1/4  bundling the web game"
npm run build

if [ ! -d node_modules/electron ]; then
  echo
  echo "!! Electron is not installed. The game runs fine in a browser, but Steam"
  echo "   needs a launchable executable. Install the wrapper first (~300 MB):"
  echo
  echo "       npm install --save-dev electron electron-builder"
  echo
  echo "   Then re-run this script."
  exit 1
fi

echo "==> 2/4  building the native app with electron-builder"
npx electron-builder --mac --dir

echo "==> 3/4  staging into steam/content"
rm -rf "$CONTENT"
mkdir -p "$CONTENT"

APP="$(find "$ROOT/release" -maxdepth 3 -name '*.app' -type d 2>/dev/null | head -1)"
if [ -z "$APP" ]; then
  echo "!! no .app found under release/ — check the electron-builder output above"
  exit 1
fi
cp -R "$APP" "$CONTENT/"
echo "    staged: $(basename "$APP")"

# The Steam build scripts still contain placeholders until you fill them in.
if grep -q 'YOUR_APP_ID' "$STEAM_DIR/app_build.vdf"; then
  echo
  echo "!! steam/app_build.vdf and steam/depot_build.vdf still contain"
  echo "   YOUR_APP_ID / YOUR_DEPOT_ID. Get those from Steamworks after paying"
  echo "   the Steam Direct fee, then edit both files."
fi

echo "==> 4/4  upload command"
cat <<EOF

    cd "$STEAM_DIR"
    steamcmd +login <your_steam_login> +run_app_build "\$PWD/app_build.vdf" +quit

  (steamcmd is Valve's CLI: https://developer.valvesoftware.com/wiki/SteamCMD)
  Two-factor prompts will appear; it is interactive by design.
EOF

if [ "$UPLOAD" = "1" ]; then
  echo
  echo "==> uploading"
  cd "$STEAM_DIR"
  steamcmd +login "$STEAM_USER" +run_app_build "$PWD/app_build.vdf" +quit
fi
