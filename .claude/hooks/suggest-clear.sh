#!/bin/bash
# PostToolUse hook on Bash: after a craftz `pr --wait`, the session's last change, suggest /clear.
# A `pr` without --wait means more changes follow in this session, so it stays quiet.
# It also stays quiet when the context is still small, since a fresh session would gain little.

MIN_TOKENS=60000

input=$(cat)
cmd=$(jq -r '.tool_input.command // empty' <<<"$input")

# `pnpm pr`, `pnpm run pr` or `craftz pr`, never `pnpm prose`.
grep -Eq '(^|[;&|(]|\s)(pnpm(\s+-s)?(\s+run)?|craftz)\s+pr(\s|$)' <<<"$cmd" || exit 0
grep -Eq '(\s|^)--wait(\s|$)' <<<"$cmd" || exit 0
[ "$(jq -r '.tool_response.interrupted // false' <<<"$input")" = "true" ] && exit 0

# The context size is the last main-thread call's input, read from the transcript's tail.
transcript=$(jq -r '.transcript_path // empty' <<<"$input")
tokens=0
if [ -f "$transcript" ]; then
  tokens=$(tail -n 300 "$transcript" | jq -s '
    [.[] | select(.type == "assistant" and (.isSidechain | not)) | .message.usage // empty
     | (.input_tokens // 0) + (.cache_read_input_tokens // 0) + (.cache_creation_input_tokens // 0)]
    | last // 0' 2>/dev/null || echo 0)
fi
[ "$tokens" -lt "$MIN_TOKENS" ] && exit 0

jq -n --arg k "$((tokens / 1000))" '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext:
  ("That `pr --wait` ended the session'"'"'s last change, and the context holds about \($k)k tokens. If it merged and the user has queued no more work in this session, end your reply with one line suggesting /clear before the next change, since the plan, the docs and git now hold what this session decided. If it failed, or more work is pending, say nothing about /clear.")}}'
