import type { Plugin } from "@opencode-ai/plugin"

export const NotifyPlugin: Plugin = async ({ project: _project, client: _client, $, directory, worktree }) => {
  return {
    event: async ({ event }) => {
      // Send notification when agent becomes idle
      if (event.type === "session.idle") {
        const location = directory || worktree || "Unknown location"
        
        await $`notify-send -a "OpenCode" -u normal -i dialog-information "OpenCode Agent Idle" "Agent at ${location} has become idle"`
      }
    },
  }
}
