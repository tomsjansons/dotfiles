# idle-notify

Pi extension that sends a `notify-send` desktop notification when the agent becomes idle.

## What it does

- sends a notification on `agent_end`
- includes the current working directory
- runs one cheap `pi -p` summary call on the last assistant message
- uses `openrouter/google/gemini-2.0-flash-lite-001` by default
- uses different emojis for:
  - `✅` idle and done
  - `❓` idle and waiting for your answer

## Files

- `idle-notify/index.ts`

## Notes

The nested summary call is intentionally minimal:

- `--no-session`
- `--no-tools`
- `--no-extensions`
- `--no-skills`
- `--no-prompt-templates`
- `--no-themes`
- `--thinking off`

That keeps it fast and avoids recursive notifications.

## Optional env vars

- `PI_IDLE_NOTIFY_MODEL` - override the summary model
- `PI_IDLE_NOTIFY_TIMEOUT_MS` - summary call timeout
- `PI_IDLE_NOTIFY_NOTIFICATION_TIMEOUT_MS` - how long the desktop notification stays visible (default `60000`)
- `PI_IDLE_NOTIFY_MAX_MESSAGE_CHARS` - truncate very long assistant messages before summarizing
- `PI_IDLE_NOTIFY_SUMMARY_MAX_CHARS` - final notification summary length cap
- `PI_IDLE_NOTIFY_DISABLED=1` - disable notifications
