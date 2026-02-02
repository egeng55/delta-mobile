#!/bin/bash
# Delta Auto Debug Loop
#
# Automated visual + runtime testing loop:
# 1. Navigate all tabs and chat sheet states
# 2. Screenshot each state
# 3. Scan Metro for runtime errors
# 4. Write all issues to a JSONL file for Claude to pick up and fix
#
# Usage: ./scripts/auto-debug-loop.sh [metro-log] [cycles]

set -uo pipefail

METRO_LOG="${1:-/private/tmp/claude/-Users-egeng-delta-mobile/tasks/b166489.output}"
MAX_CYCLES="${2:-5}"
SCRATCHPAD="/private/tmp/claude/-Users-egeng-delta-mobile/fcee9661-958a-49e4-8dcc-f7c01c5d08e7/scratchpad"
ISSUES_FILE="$SCRATCHPAD/delta-issues.jsonl"
SCREENSHOTS_DIR="$SCRATCHPAD/screenshots"
TAP="$(dirname "$0")/sim-tap.sh"

mkdir -p "$SCREENSHOTS_DIR"

# Tab coordinates (device points on iPhone 16e, 393x852)
TAB_TODAY_X=65;   TAB_Y=790
TAB_DASH_X=196
TAB_YOU_X=328
PULL_TAB_X=196;   PULL_TAB_Y=726
# In full state, pull-tab is near top
PULL_TAB_FULL_Y=80

take_screenshot() {
  local name="$1"
  local path="$SCREENSHOTS_DIR/$name"
  xcrun simctl io booted screenshot "$path" 2>/dev/null
  echo "$path"
}

tap() {
  "$TAP" "$1" "$2" >/dev/null 2>&1 || true
  sleep 2.5
}

scan_metro_errors() {
  local ts="$1"
  local screen="$2"
  if [ ! -f "$METRO_LOG" ]; then return; fi

  # Only scan lines added since last check
  local current_lines
  current_lines=$(wc -l < "$METRO_LOG" | tr -d ' ')
  if [ "$current_lines" -le "$METRO_LAST_LINE" ]; then return; fi

  tail -n +"$((METRO_LAST_LINE + 1))" "$METRO_LOG" \
    | grep -iE "ERROR|MISMATCH|DELTA-ERROR|TypeError|ReferenceError|Cannot read|Invariant|Unhandled Promise" \
    | grep -v "watchman" \
    | while IFS= read -r line; do
        local issue_type="unknown"
        if echo "$line" | grep -q "\[DELTA-MISMATCH\]"; then issue_type="mismatch"
        elif echo "$line" | grep -q "\[DELTA-ERROR\]"; then issue_type="render_error"
        elif echo "$line" | grep -qE "TypeError|ReferenceError|Cannot read"; then issue_type="js_error"
        elif echo "$line" | grep -q "Invariant"; then issue_type="invariant_violation"
        elif echo "$line" | grep -q "Unhandled Promise"; then issue_type="unhandled_promise"
        fi

        local detail
        detail=$(echo "$line" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))' 2>/dev/null || echo "\"$line\"")
        echo "{\"timestamp\":\"$ts\",\"type\":\"$issue_type\",\"screen\":\"$screen\",\"detail\":$detail}" >> "$ISSUES_FILE"
        echo "  ⚠ $issue_type: $(echo "$line" | head -c 100)"
      done

  METRO_LAST_LINE=$current_lines
}

record_screenshot() {
  local ts="$1"
  local screen="$2"
  local path="$3"
  echo "{\"timestamp\":\"$ts\",\"type\":\"visual_check\",\"screen\":\"$screen\",\"screenshot\":\"$path\"}" >> "$ISSUES_FILE"
}

echo "============================================"
echo "  Delta Auto Debug Loop"
echo "  Max cycles: $MAX_CYCLES"
echo "  Issues: $ISSUES_FILE"
echo "============================================"
echo ""

# Clear issues from previous run
> "$ISSUES_FILE"

# Record metro error baseline (line count) — only scan new lines each cycle
METRO_LAST_LINE=$(wc -l < "$METRO_LOG" 2>/dev/null | tr -d ' ' || echo 0)

for CYCLE in $(seq 1 "$MAX_CYCLES"); do
  echo "--- Cycle $CYCLE/$MAX_CYCLES ---"
  TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # 1. Today tab
  echo "  [1/6] Today tab"
  tap $TAB_TODAY_X $TAB_Y
  SHOT=$(take_screenshot "cycle${CYCLE}-1-today.png")
  record_screenshot "$TS" "today" "$SHOT"
  scan_metro_errors "$TS" "today"

  # 2. Dashboard tab
  echo "  [2/6] Dashboard tab"
  tap $TAB_DASH_X $TAB_Y
  sleep 1  # extra wait for charts to render
  SHOT=$(take_screenshot "cycle${CYCLE}-2-dashboard.png")
  record_screenshot "$TS" "dashboard" "$SHOT"
  scan_metro_errors "$TS" "dashboard"

  # 3. You tab
  echo "  [3/6] You tab"
  tap $TAB_YOU_X $TAB_Y
  SHOT=$(take_screenshot "cycle${CYCLE}-3-you.png")
  record_screenshot "$TS" "you" "$SHOT"
  scan_metro_errors "$TS" "you"

  # 4. Pull-tab tap (hidden → peek)
  echo "  [4/7] Chat peek"
  tap $PULL_TAB_X $PULL_TAB_Y
  SHOT=$(take_screenshot "cycle${CYCLE}-4-chat-peek.png")
  record_screenshot "$TS" "chat-peek" "$SHOT"
  scan_metro_errors "$TS" "chat-peek"

  # 5. Pull-tab tap (peek → hidden)
  # In peek: pull-tab center at PEEK_Y(654)+20=674
  echo "  [5/7] Chat dismiss from peek"
  tap $PULL_TAB_X 674
  SHOT=$(take_screenshot "cycle${CYCLE}-5-chat-dismissed.png")
  record_screenshot "$TS" "chat-dismissed" "$SHOT"
  scan_metro_errors "$TS" "chat-dismissed"

  # 6. Open peek, then tap input bar to trigger onFocus → full
  echo "  [6/7] Chat full (via input focus)"
  tap $PULL_TAB_X $PULL_TAB_Y
  sleep 0.5
  # Tap the input bar in peek state (roughly y=730)
  tap 250 730
  SHOT=$(take_screenshot "cycle${CYCLE}-6-chat-full.png")
  record_screenshot "$TS" "chat-full" "$SHOT"
  scan_metro_errors "$TS" "chat-full"

  # 7. Dismiss from full via chevron-down button
  echo "  [7/7] Dismiss from full"
  tap 110 128
  SHOT=$(take_screenshot "cycle${CYCLE}-7-final.png")
  record_screenshot "$TS" "final" "$SHOT"
  scan_metro_errors "$TS" "final"

  # Count issues this cycle
  ISSUE_COUNT=$(grep -c '"type":"' "$ISSUES_FILE" 2>/dev/null || echo 0)
  VISUAL_COUNT=$(grep -c '"visual_check"' "$ISSUES_FILE" 2>/dev/null || echo 0)
  ERROR_COUNT=$((ISSUE_COUNT - VISUAL_COUNT))
  echo "  → $VISUAL_COUNT screenshots, $ERROR_COUNT errors"
  echo ""

  if [ "$CYCLE" -lt "$MAX_CYCLES" ]; then
    echo "  Waiting 5s before next cycle..."
    sleep 5
  fi
done

echo "============================================"
echo "  Loop complete: $MAX_CYCLES cycles"
echo "  Total issues: $(wc -l < "$ISSUES_FILE" | tr -d ' ')"
echo "  Screenshots: $SCREENSHOTS_DIR"
echo "  Review: $ISSUES_FILE"
echo "============================================"
