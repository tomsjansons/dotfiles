import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { spawn } from "node:child_process";

/**
 * Desktop notification extension for oh-my-pi
 *
 * Sends notifications when:
 * 1. Agent becomes idle (turn completes with no pending work)
 * 2. Agent requests interaction (asks a question via ask tool)
 *
 * Uses notify-send on Linux, terminal bell/OSC9 on other platforms
 */

export default function (pi: ExtensionAPI) {
	pi.setLabel("Desktop Notifications");

	/**
	 * Send a desktop notification
	 */
	function sendNotification(title: string, body: string, urgency: "normal" | "low" | "critical" = "normal", cwd?: string): void {
		const bodyWithCwd = cwd ? `${body}\n📁 ${cwd}` : body;

		// Try notify-send (Linux)
		if (process.platform === "linux") {
			const proc = spawn("notify-send", ["--urgency", urgency, "--expire-time", "0", title, bodyWithCwd], {
				detached: true,
				stdio: "ignore",
			});
			proc.unref();
			return;
		}

		// Fallback: OSC9 for terminal emulators that support it
		// https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda
		const osc9 = `\x1b]9;${title}: ${bodyWithCwd}\x07`;
		process.stderr.write(osc9);
	}

	/**
	 * Truncate text for notification display
	 */
	function truncate(text: string, maxLen: number): string {
		if (text.length <= maxLen) return text;
		return text.slice(0, maxLen - 3) + "...";
	}

	// Detect when agent becomes truly idle (agent_end)
	pi.on("agent_end", async (_event, ctx) => {
		// Agent stopped - send idle notification
		sendNotification(
			"Pi Agent Idle",
			"Agent has finished processing and is waiting for input.",
			"low",
			ctx.cwd,
		);
	});

	// Detect when agent uses the ask tool (requires user interaction)
	pi.on("tool_call", async (event) => {
		if (event.toolName !== "ask") return;

		// Extract question info from the ask tool input
		const input = event.input as {
			questions?: Array<{ question?: string; options?: Array<{ label?: string }> }>;
			question?: string;
			options?: Array<{ label?: string }>;
		};

		// Get the question text
		let questionText = "Agent is waiting for your response.";

		if (input.questions && input.questions.length > 0) {
			// Multi-part questions
			const firstQuestion = input.questions[0];
			questionText = firstQuestion.question || questionText;
		} else if (input.question) {
			// Single question
			questionText = input.question;
		}

		// Send notification about the question
		sendNotification(
			"Pi Agent Needs Input",
			truncate(questionText, 100),
			"normal",
			event.cwd,
		);
	});

	// Detect permission updates required (tool_call blocked scenarios)
	pi.on("tool_result", async (event) => {
		// Look for permission-related blocks or errors
		if (!event.isError) return;

		const content = event.content;
		if (!Array.isArray(content)) return;

		for (const chunk of content) {
			if (chunk.type !== "text") continue;

			const text = chunk.text?.toLowerCase() || "";
			// Check for permission-related keywords
			if (
				text.includes("permission") ||
				text.includes("denied") ||
				text.includes("blocked") ||
				text.includes("requires approval") ||
				text.includes("needs confirmation")
			) {
				sendNotification(
					"Pi Agent Needs Permission",
					truncate(chunk.text || "Permission required", 100),
					"critical",
					event.cwd,
				);
				break;
			}
		}
	});
}
