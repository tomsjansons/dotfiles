import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { spawn } from "node:child_process";

const SUMMARY_MODEL = process.env.PI_IDLE_NOTIFY_MODEL ?? "openrouter/google/gemini-2.0-flash-lite-001";
const SUMMARY_TIMEOUT_MS = Number(process.env.PI_IDLE_NOTIFY_TIMEOUT_MS ?? 12000);
const NOTIFICATION_TIMEOUT_MS = Number(process.env.PI_IDLE_NOTIFY_NOTIFICATION_TIMEOUT_MS ?? 60000);
const MAX_MESSAGE_CHARS = Number(process.env.PI_IDLE_NOTIFY_MAX_MESSAGE_CHARS ?? 8000);
const SUMMARY_MAX_CHARS = Number(process.env.PI_IDLE_NOTIFY_SUMMARY_MAX_CHARS ?? 160);

type SummaryStatus = "WAITING" | "DONE";

type SummaryResult = {
	status: SummaryStatus;
	summary: string;
};

type AssistantTextBlock = {
	type: string;
	text?: string;
};

type AssistantMessageLike = {
	role: string;
	content?: AssistantTextBlock[];
};

function isAssistantMessage(message: unknown): message is AssistantMessageLike {
	return !!message && typeof message === "object" && (message as { role?: string }).role === "assistant";
}

function getAssistantText(message: AssistantMessageLike): string {
	if (!Array.isArray(message.content)) return "";
	return message.content
		.filter((block): block is AssistantTextBlock => !!block && block.type === "text" && typeof block.text === "string")
		.map((block) => block.text!.trim())
		.filter(Boolean)
		.join("\n");
}

function compactWhitespace(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

function truncate(text: string, maxChars: number): string {
	if (text.length <= maxChars) return text;
	return `${text.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function sanitizeSummary(text: string): string {
	return truncate(compactWhitespace(text), SUMMARY_MAX_CHARS);
}

function fallbackSummary(lastMessage: string): SummaryResult {
	const compact = compactWhitespace(lastMessage);
	const waiting = /\?|\b(please|can you|could you|would you|which|what|where|when|why|how|choose|confirm|decide|provide|share|tell me|let me know|want me to)\b/i.test(
		compact,
	);

	if (!compact) {
		return {
			status: "DONE",
			summary: "Pi is idle.",
		};
	}

	return {
		status: waiting ? "WAITING" : "DONE",
		summary: waiting
			? sanitizeSummary(compact)
			: sanitizeSummary(compact.endsWith(".") ? compact : `${compact}.`),
	};
}

function parseSummary(stdout: string): SummaryResult | null {
	const firstLine = stdout
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find(Boolean);
	if (!firstLine) return null;

	const match = firstLine.match(/^(WAITING|DONE)(?:\t+|\s*[:|-]\s*)(.+)$/i);
	if (!match) return null;

	const status = match[1].toUpperCase() as SummaryStatus;
	const summary = sanitizeSummary(match[2]);
	if (!summary) return null;

	return { status, summary };
}

function runCommand(
	command: string,
	args: string[],
	options: { cwd?: string; timeoutMs?: number } = {},
): Promise<{ code: number | null; stdout: string; stderr: string }> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: options.cwd,
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";
		let finished = false;
		let timeout: NodeJS.Timeout | undefined;

		child.stdout?.on("data", (chunk) => {
			stdout += String(chunk);
		});

		child.stderr?.on("data", (chunk) => {
			stderr += String(chunk);
		});

		child.on("error", (error) => {
			if (finished) return;
			finished = true;
			if (timeout) clearTimeout(timeout);
			reject(error);
		});

		child.on("close", (code) => {
			if (finished) return;
			finished = true;
			if (timeout) clearTimeout(timeout);
			resolve({ code, stdout, stderr });
		});

		if (options.timeoutMs && options.timeoutMs > 0) {
			timeout = setTimeout(() => {
				if (finished) return;
				finished = true;
				child.kill("SIGTERM");
				reject(new Error(`${command} timed out after ${options.timeoutMs}ms`));
			}, options.timeoutMs);
		}
	});
}

async function summarizeLastMessage(lastMessage: string, cwd: string): Promise<SummaryResult | null> {
	const prompt = [
		"You are summarizing the assistant's final message for a desktop notification.",
		"Decide whether the assistant is waiting for user input because it asked questions, requested missing information, or asked the user to choose or confirm something.",
		"Return exactly one line in this format:",
		"WAITING<TAB>one short sentence",	
		"or",	
		"DONE<TAB>one short sentence",	
		"Keep the sentence under 140 characters.",
		"Do not use markdown.",
		"Do not add any extra lines or explanation.",
		"",	
		"Assistant message:",
		truncate(lastMessage, MAX_MESSAGE_CHARS),
	].join("\n");

	const result = await runCommand(
		"pi",
		[
			"-p",
			"--no-session",
			"--no-tools",
			"--no-extensions",
			"--no-skills",
			"--no-prompt-templates",
			"--no-themes",
			"--thinking",
			"off",
			"--model",
			SUMMARY_MODEL,
			prompt,
		],
		{ cwd, timeoutMs: SUMMARY_TIMEOUT_MS },
	);

	if (result.code !== 0) return null;
	return parseSummary(result.stdout);
}

function sendNotification(title: string, body: string, urgency: "low" | "normal"): void {
	const child = spawn("notify-send", ["-u", urgency, "-t", String(NOTIFICATION_TIMEOUT_MS), title, body], {
		stdio: "ignore",
		detached: true,
	});
	child.on("error", () => undefined);
	child.unref();
}

export default function idleNotifyExtension(pi: ExtensionAPI): void {
	pi.on("agent_end", async (event, ctx) => {
		if (process.env.PI_IDLE_NOTIFY_DISABLED === "1") return;

		const lastAssistant = [...event.messages].reverse().find(isAssistantMessage);
		const lastMessage = compactWhitespace(lastAssistant ? getAssistantText(lastAssistant) : "");

		const summary = lastMessage
			? (await summarizeLastMessage(lastMessage, ctx.cwd).catch(() => null)) ?? fallbackSummary(lastMessage)
			: fallbackSummary("");

		const waitingForInput = summary.status === "WAITING";
		const emoji = waitingForInput ? "❓" : "✅";
		const title = waitingForInput ? `${emoji} Pi idle — input needed` : `${emoji} Pi idle — task done`;
		const body = [`📁 ${ctx.cwd}`, summary.summary].join("\n");

		sendNotification(title, body, waitingForInput ? "normal" : "low");
	});
}
