#!/bin/bash
# Delta Visual Debug Loop
#
# Takes periodic screenshots of the simulator, checks Metro logs for errors,
# and writes all findings (visual + runtime) to an issues file.
#
# Usage: ./scripts/visual-debug-loop.sh [metro-log-file] [interval-seconds]
#
# The issues file is read by Claude to fix bugs in real-time.

METRO_LOG="${1:-/private/tmp/claude/-Users-egeng-delta-mobile/tasks/b166489.output}"
INTERVAL="${2:-15}"
SCRATCHPAD="/private/tmp/claude/-Users-egeng-delta-mobile/fcee9661-958a-49e4-8dcc-f7c01c5d08e7/scratchpad"
ISSUES_FILE="$SCRATCHPAD/delta-issues.jsonl"
SCREENSHOTS_DIR="$SCRATCHPAD/screenshots"
SEEN_FILE="$SCRATCHPAD/delta-seen-hashes.txt"

mkdir -p "$SCREENSHOTS_DIR"
touch "$SEEN_FILE"

# Find booted simulator
DEVICE_ID=$(xcrun simctl list devices booted -j 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
for runtime, devices in data.get('devices', {}).items():
    for d in devices:
        if d.get('state') == 'Booted':
            print(d['udid'])
            sys.exit(0)
" 2>/dev/null)

if [ -z "$DEVICE_ID" ]; then
  echo "[visual-debug] No booted simulator found"
  exit 1
fi

echo "[visual-debug] Simulator: $DEVICE_ID"
echo "[visual-debug] Metro log: $METRO_LOG"
echo "[visual-debug] Screenshots: $SCREENSHOTS_DIR"
echo "[visual-debug] Issues: $ISSUES_FILE"
echo "[visual-debug] Interval: ${INTERVAL}s"
echo ""

CYCLE=0

while true; do
  CYCLE=$((CYCLE + 1))
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  SCREENSHOT="$SCREENSHOTS_DIR/screen-cycle-${CYCLE}.png"

  # 1. Take screenshot
  xcrun simctl io "$DEVICE_ID" screenshot "$SCREENSHOT" 2>/dev/null
  if [ $? -ne 0 ]; then
    echo "[visual-debug] Screenshot failed (simulator may have closed)"
    sleep "$INTERVAL"
    continue
  fi

  # 2. Scan Metro log for new errors since last check
  if [ -f "$METRO_LOG" ]; then
    while IFS= read -r line; do
      HASH=$(echo "$line" | md5 -q 2>/dev/null || echo "$line" | md5sum | cut -d' ' -f1)
      if grep -qF "$HASH" "$SEEN_FILE" 2>/dev/null; then
        continue
      fi
      echo "$HASH" >> "$SEEN_FILE"

      ISSUE_TYPE=""
      DETAIL=""

      if echo "$line" | grep -q "\[DELTA-MISMATCH\]"; then
        ISSUE_TYPE="mismatch"
        DETAIL=$(echo "$line" | sed 's/.*\[DELTA-MISMATCH\] //')
      elif echo "$line" | grep -q "\[DELTA-ERROR\]"; then
        ISSUE_TYPE="render_error"
        DETAIL=$(echo "$line" | sed 's/.*\[DELTA-ERROR\] //')
      elif echo "$line" | grep -qE "ERROR.*(TypeError|ReferenceError|Cannot read|Invariant)"; then
        ISSUE_TYPE="js_error"
        DETAIL="$line"
      elif echo "$line" | grep -q "Possible Unhandled Promise"; then
        ISSUE_TYPE="unhandled_promise"
        DETAIL=$(echo "$line" | sed 's/.*WARN //')
      fi

      if [ -n "$ISSUE_TYPE" ]; then
        JSON="{\"timestamp\":\"$TIMESTAMP\",\"type\":\"$ISSUE_TYPE\",\"detail\":$(echo "$DETAIL" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'),\"screenshot\":\"$SCREENSHOT\",\"cycle\":$CYCLE}"
        echo "$JSON" >> "$ISSUES_FILE"
        echo "[visual-debug] ⚠ $ISSUE_TYPE: $DETAIL"
      fi
    done < <(grep -iE "ERROR|MISMATCH|DELTA-ERROR|TypeError|ReferenceError|Cannot read|Invariant|Unhandled" "$METRO_LOG" 2>/dev/null | grep -v "watchman")
  fi

  # 3. Write cycle marker so Claude knows a screenshot is ready for review
  echo "{\"timestamp\":\"$TIMESTAMP\",\"type\":\"screenshot_ready\",\"detail\":\"Cycle $CYCLE screenshot available for visual review\",\"screenshot\":\"$SCREENSHOT\",\"cycle\":$CYCLE}" >> "$ISSUES_FILE"

  echo "[visual-debug] Cycle $CYCLE complete — screenshot: $SCREENSHOT"
  sleep "$INTERVAL"
done
