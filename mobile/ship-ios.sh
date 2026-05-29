#!/usr/bin/env bash
#
# One-command TestFlight ship: web build → cap sync → bump build number →
# archive → export IPA → upload, all headless via the App Store Connect API
# key. No Xcode GUI needed.
#
# Usage:
#   ASC_ISSUER_ID="<your-issuer-uuid>" ./ship-ios.sh
#
# Requires (already in place on this machine):
#   - ~/.appstoreconnect/private_keys/AuthKey_ZWFX559R2K.p8  (ASC API key)
#   - Node 22 at ~/.nvm/versions/node/v22.22.2
#   - Xcode command line tools (xcodebuild, xcrun altool)
#
set -euo pipefail

# ── Load local ship config if present (gitignored) ──────────────────────
# mobile/.env.ship holds ASC_ISSUER_ID / ASC_KEY_ID so runs are just
# ./ship-ios.sh. Inline env vars still override the file.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/.env.ship" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$SCRIPT_DIR/.env.ship"
  set +a
fi

# ── Config ──────────────────────────────────────────────────────────────
KEY_ID="${ASC_KEY_ID:-ZWFX559R2K}"
ISSUER_ID="${ASC_ISSUER_ID:?Set ASC_ISSUER_ID (env or mobile/.env.ship)}"
P8_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8"

MOBILE_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$MOBILE_DIR/ios/App"
PBXPROJ="$APP_DIR/App.xcodeproj/project.pbxproj"
ARCHIVE="$APP_DIR/build/App.xcarchive"
EXPORT_DIR="$APP_DIR/build/export"

export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"

echo "▸ 1/5  Building web bundle…"
cd "$MOBILE_DIR"
npm run build

echo "▸ 2/5  Syncing to iOS…"
npx cap sync ios

echo "▸ 3/5  Bumping build number…"
CURRENT=$(grep -m1 -E "CURRENT_PROJECT_VERSION = [0-9]+;" "$PBXPROJ" | grep -oE "[0-9]+")
NEXT=$((CURRENT + 1))
# Replace every occurrence (Debug + Release configs).
sed -i '' "s/CURRENT_PROJECT_VERSION = ${CURRENT};/CURRENT_PROJECT_VERSION = ${NEXT};/g" "$PBXPROJ"
echo "   build ${CURRENT} → ${NEXT}"

echo "▸ 4/5  Archiving (this takes a few minutes)…"
cd "$APP_DIR"
rm -rf "$ARCHIVE" "$EXPORT_DIR"
xcodebuild \
  -project App.xcodeproj \
  -scheme App \
  -configuration Release \
  -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$P8_PATH" \
  -authenticationKeyID "$KEY_ID" \
  -authenticationKeyIssuerID "$ISSUER_ID" \
  clean archive

echo "▸ 5/5  Exporting IPA + uploading to TestFlight…"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist ExportOptions.plist \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$P8_PATH" \
  -authenticationKeyID "$KEY_ID" \
  -authenticationKeyIssuerID "$ISSUER_ID"

IPA=$(ls "$EXPORT_DIR"/*.ipa | head -1)
echo "   uploading $IPA"
xcrun altool --upload-app -f "$IPA" -t ios \
  --apiKey "$KEY_ID" --apiIssuer "$ISSUER_ID"

echo ""
echo "✅ Build ${NEXT} uploaded to TestFlight. It'll appear after Apple finishes processing (~5–10 min)."
echo "   Remember to commit the build-number bump:  git add ${PBXPROJ} && git commit -m 'iOS: build ${NEXT}'"
