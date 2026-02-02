#!/bin/bash
# Delta Debug Loop — watches Metro output for errors/mismatches
# and writes actionable items to a file for Claude to pick up.
#
# Usage: ./scripts/debug-loop.sh <metro-log-file>

METRO_LOG="${1:-/private/tmp/claude/-Users-egeng-delta-mobile/tasks/b166489.output}"
ISSUES_FILE="/private/tmp/claude/-Users-egeng-delta-mobile/fcee9661-958a-49e4-8dcc-f7c01c5d08e7/scratchpad/delta-issues.jsonl"
SEEN_FILE="/private/tmp/claude/-Users-egeng-delta-mobile/fcee9661-958a-49e4-8dcc-f7c01c5d08e7/scratchpad/delta-seen-hashes.txt"

mkdir -p "$(dirname "$ISSUES_FILE")"
touch "$SEEN_FILE"

echo "[debug-loop] Watching: $METRO_LOG"
echo "[debug-loop] Issues output: $ISSUES_FILE"

tail -f "$METRO_LOG" | while IFS= read -r line; do
  # Skip lines we've already processed (by hash)
  HASH=$(echo "$line" | md5 -q 2>/dev/null || echo "$line" | md5sum | cut -d' ' -f1)
  if grep -qF "$HASH" "$SEEN_FILE" 2>/dev/null; then
    continue
  fi
  echo "$HASH" >> "$SEEN_FILE"

  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  ISSUE_TYPE=""
  DETAIL=""

  # Match patterns
  if echo "$line" | grep -q "\[DELTA-MISMATCH\]"; then
    ISSUE_TYPE="mismatch"
    DETAIL=$(echo "$line" | sed 's/.*\[DELTA-MISMATCH\] //')
  elif echo "$line" | grep -q "\[DELTA-ERROR\]"; then
    ISSUE_TYPE="render_error"
    DETAIL=$(echo "$line" | sed 's/.*\[DELTA-ERROR\] //')
  elif echo "$line" | grep -q "ERROR.*Invariant Violation"; then
    ISSUE_TYPE="invariant_violation"
    DETAIL=$(echo "$line" | sed 's/.*ERROR //')
  elif echo "$line" | grep -q "TypeError\|ReferenceError\|Cannot read prop"; then
    ISSUE_TYPE="js_error"
    DETAIL="$line"
  elif echo "$line" | grep -q "WARN.*Possible Unhandled Promise"; then
    ISSUE_TYPE="unhandled_promise"
    DETAIL=$(echo "$line" | sed 's/.*WARN //')
  elif echo "$line" | grep -q "Red Box\|LogBox"; then
    ISSUE_TYPE="red_box"
    DETAIL="$line"
  elif echo "$line" | grep -qE "ERROR.*at (src/|components/|screens/|services/)"; then
    ISSUE_TYPE="stack_error"
    DETAIL="$line"
  fi

  if [ -n "$ISSUE_TYPE" ]; then
    JSON="{\"timestamp\":\"$TIMESTAMP\",\"type\":\"$ISSUE_TYPE\",\"detail\":$(echo "$DETAIL" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))')}"
    echo "$JSON" >> "$ISSUES_FILE"
    echo "[debug-loop] ⚠ $ISSUE_TYPE: $DETAIL"
  fi
done
