#!/usr/bin/env bash
# Applies the iOS settings AdMob and the App Store need to ios/App/App/Info.plist.
# Runs on the cloud Mac (Codemagic) after `npx cap sync ios`, so no local Mac is needed.
set -euo pipefail

PLIST="ios/App/App/Info.plist"
PB=/usr/libexec/PlistBuddy

# Google's TEST AdMob app ID. Replace with your real iOS app ID from the AdMob console before release.
ADMOB_APP_ID="${ADMOB_IOS_APP_ID:-ca-app-pub-3940256099942544~1458002511}"

set_key() { # key type value
  $PB -c "Delete :$1" "$PLIST" 2>/dev/null || true
  $PB -c "Add :$1 $2 $3" "$PLIST"
}

set_key GADApplicationIdentifier string "$ADMOB_APP_ID"
set_key NSUserTrackingUsageDescription string "Your data is used to show ads that are more relevant to you. The game is free because of these ads."
# The app uses no custom encryption, so App Store Connect does not ask the export-compliance question every upload.
set_key ITSAppUsesNonExemptEncryption bool false
set_key UIRequiresFullScreen bool true
set_key UIStatusBarHidden bool true
set_key UIViewControllerBasedStatusBarAppearance bool false

# Portrait only, on iPhone and iPad.
for k in UISupportedInterfaceOrientations "UISupportedInterfaceOrientations~ipad"; do
  $PB -c "Delete :$k" "$PLIST" 2>/dev/null || true
  $PB -c "Add :$k array" "$PLIST"
  $PB -c "Add :$k:0 string UIInterfaceOrientationPortrait" "$PLIST"
done

# SKAdNetwork IDs: Google's own. Add the ad networks you enable for mediation later (each publishes its ID).
$PB -c "Delete :SKAdNetworkItems" "$PLIST" 2>/dev/null || true
$PB -c "Add :SKAdNetworkItems array" "$PLIST"
i=0
for id in cstr6suwn9.skadnetwork; do
  $PB -c "Add :SKAdNetworkItems:$i dict" "$PLIST"
  $PB -c "Add :SKAdNetworkItems:$i:SKAdNetworkIdentifier string $id" "$PLIST"
  i=$((i+1))
done

echo "Info.plist configured for AdMob ($ADMOB_APP_ID)"
