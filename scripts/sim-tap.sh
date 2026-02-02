#!/bin/bash
# Tap the iOS Simulator at device-point coordinates.
# Usage: ./scripts/sim-tap.sh <x> <y>
#
# Translates device points to window-absolute coordinates
# using the Simulator window position and device scale.

X_DEVICE="${1:?Usage: sim-tap.sh <x> <y>}"
Y_DEVICE="${2:?Usage: sim-tap.sh <x> <y>}"

# Get Simulator window position and size
read -r WIN_X WIN_Y WIN_W WIN_H <<< $(osascript -e '
tell application "System Events"
    tell process "Simulator"
        set {wx, wy} to position of front window
        set {ww, wh} to size of front window
        return (wx as text) & " " & (wy as text) & " " & (ww as text) & " " & (wh as text)
    end tell
end tell
' 2>/dev/null)

if [ -z "$WIN_X" ]; then
  echo "Could not get Simulator window position"
  exit 1
fi

# iPhone 16e: 393x852 device points
# Simulator window has a title bar (~28px) and renders the device screen below it.
DEVICE_W=393
DEVICE_H=852
TITLE_BAR=28

# Calculate scale (window content area to device points)
CONTENT_H=$((WIN_H - TITLE_BAR))
SCALE_X=$(python3 -c "print($WIN_W / $DEVICE_W)")
SCALE_Y=$(python3 -c "print($CONTENT_H / $DEVICE_H)")

# Convert device coords to absolute screen coords
ABS_X=$(python3 -c "print(int($WIN_X + $X_DEVICE * $SCALE_X))")
ABS_Y=$(python3 -c "print(int($WIN_Y + $TITLE_BAR + $Y_DEVICE * $SCALE_Y))")

osascript -e "
tell application \"Simulator\" to activate
delay 0.15
tell application \"System Events\"
    tell process \"Simulator\"
        click at {${ABS_X}, ${ABS_Y}}
    end tell
end tell
" 2>/dev/null

echo "Tapped device ($X_DEVICE, $Y_DEVICE) → window ($ABS_X, $ABS_Y)"
