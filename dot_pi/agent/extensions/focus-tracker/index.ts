import type { ExtensionAPI, ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { matchesKey, Text, truncateToWidth } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";

const TOOL_NAME = "focus_update";
const STATUS_KEY = "focus";
const HISTORY_LIMIT = 3;

const focusUpdateSchema = Type.Object(
	{
		goal: Type.Optional(Type.String({ description: "Overall goal. Keep it short." })),
		subgoal: Type.Optional(Type.String({ description: "Current subgoal or sidequest. Keep it short." })),
		problem: Type.Optional(Type.String({ description: "Current blocker or problem. Keep it short." })),
	},
	{ additionalProperties: false },
);

type FocusState = {
	goal?: string;
	subgoal?: string;
	problem?: string;
	updatedAt?: number;
};

type FocusDetails = {
	current: FocusState;
	history: FocusState[];
};

type FocusUpdateParams = {
	goal?: string;
	subgoal?: string;
	problem?: string;
};

class FocusPopupComponent {
	private cachedWidth?: number;
	private cachedLines?: string[];

	constructor(
		private readonly current: FocusState,
		private readonly history: FocusState[],
		private readonly theme: Theme,
		private readonly onClose: () => void,
	) {}

	handleInput(data: string): void {
		if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) {
			this.onClose();
		}
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) {
			return this.cachedLines;
		}

		const lines: string[] = [];
		const header = (text: string) => this.theme.fg("accent", this.theme.bold(text));
		const label = (text: string) => this.theme.fg("dim", `${text}:`);
		const hint = (text: string) => this.theme.fg("dim", text);
		const pushLine = (text = "") => lines.push(truncateToWidth(text, width));
		const pushField = (name: string, value?: string, prefix = "") => {
			if (!value) return;
			pushLine(`${prefix}${label(name)} ${value}`);
		};

		pushLine("");
		pushLine(header("Current Focus"));
		pushLine("");

		if (!hasFocus(this.current)) {
			pushLine("No focus state recorded yet.");
		} else {
			pushField("Goal", this.current.goal);
			pushField("Subgoal", this.current.subgoal);
			pushField("Problem", this.current.problem);
		}

		pushLine("");
		pushLine(header("Recent Focus History"));
		pushLine("");

		if (this.history.length === 0) {
			pushLine("No focus history yet.");
		} else {
			for (const [index, item] of this.history.slice(0, HISTORY_LIMIT).entries()) {
				pushField(`${index + 1}. Goal`, item.goal);
				pushField("Subgoal", item.subgoal, "   ");
				pushField("Problem", item.problem, "   ");
				if (index < this.history.length - 1) pushLine("");
			}
		}

		pushLine("");
		pushLine(hint("Press Esc to close"));
		pushLine("");

		this.cachedWidth = width;
		this.cachedLines = lines;
		return lines;
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}
}

function normalizeText(value?: string): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeFocus(input?: FocusState): FocusState {
	const normalized: FocusState = {};
	const goal = normalizeText(input?.goal);
	const subgoal = normalizeText(input?.subgoal);
	const problem = normalizeText(input?.problem);

	if (goal) normalized.goal = goal;
	if (subgoal) normalized.subgoal = subgoal;
	if (problem) normalized.problem = problem;
	if (typeof input?.updatedAt === "number" && Number.isFinite(input.updatedAt)) {
		normalized.updatedAt = input.updatedAt;
	}

	return normalized;
}

function hasFocus(state?: FocusState): boolean {
	return !!(state?.goal || state?.subgoal || state?.problem);
}

function sameFocusState(a?: FocusState, b?: FocusState): boolean {
	return normalizeText(a?.goal) === normalizeText(b?.goal)
		&& normalizeText(a?.subgoal) === normalizeText(b?.subgoal)
		&& normalizeText(a?.problem) === normalizeText(b?.problem);
}

function cloneFocus(state?: FocusState): FocusState {
	return normalizeFocus(state);
}

function buildFocusState(patch: FocusUpdateParams): FocusState {
	const next: FocusState = {};
	const goal = normalizeText(patch.goal);
	const subgoal = normalizeText(patch.subgoal);
	const problem = normalizeText(patch.problem);

	if (goal) next.goal = goal;
	if (subgoal) next.subgoal = subgoal;
	if (problem) next.problem = problem;
	next.updatedAt = Date.now();
	return next;
}

function pushHistory(history: FocusState[], snapshot?: FocusState): FocusState[] {
	const normalized = cloneFocus(snapshot);
	if (!hasFocus(normalized)) return history.slice(0, HISTORY_LIMIT);

	const next = [normalized, ...history.filter((item) => !sameFocusState(item, normalized))];
	return next.slice(0, HISTORY_LIMIT).map(cloneFocus);
}

function formatStatus(state?: FocusState): string | undefined {
	const parts = [state?.goal, state?.subgoal, state?.problem].filter(
		(part): part is string => typeof part === "string" && part.trim().length > 0,
	);
	if (parts.length === 0) return undefined;
	return `🎯 ${parts.join(" -> ")}`;
}

function formatResultLines(state: FocusState): string {
	const lines: string[] = [];
	if (state.goal) lines.push(`goal: ${state.goal}`);
	if (state.subgoal) lines.push(`sub: ${state.subgoal}`);
	if (state.problem) lines.push(`prob: ${state.problem}`);
	return lines.length > 0 ? lines.join("\n") : "Focus cleared";
}

function parseFocusState(value: unknown): FocusState | undefined {
	if (!value || typeof value !== "object") return undefined;
	return normalizeFocus(value as FocusState);
}

function parseFocusDetails(value: unknown): FocusDetails | undefined {
	if (!value || typeof value !== "object") return undefined;
	const record = value as { current?: unknown; history?: unknown };
	const current = parseFocusState(record.current) ?? {};
	const history = Array.isArray(record.history)
		? record.history
			.map((item) => parseFocusState(item))
			.filter((item): item is FocusState => !!item && hasFocus(item))
			.slice(0, HISTORY_LIMIT)
			.map(cloneFocus)
		: [];
	return { current, history };
}

function cloneDetails(current: FocusState, history: FocusState[]): FocusDetails {
	return {
		current: cloneFocus(current),
		history: history.slice(0, HISTORY_LIMIT).map(cloneFocus),
	};
}

export default function focusTrackerExtension(pi: ExtensionAPI): void {
	let current: FocusState = {};
	let history: FocusState[] = [];

	function updateStatusUi(ctx: ExtensionContext): void {
		ctx.ui.setStatus(STATUS_KEY, formatStatus(current));
	}

	function clearFocusState(ctx: ExtensionContext): void {
		current = {};
		history = [];
		updateStatusUi(ctx);
	}

	pi.on("session_start", async (_event, ctx) => clearFocusState(ctx));
	pi.on("session_switch", async (_event, ctx) => clearFocusState(ctx));
	pi.on("session_fork", async (_event, ctx) => clearFocusState(ctx));
	pi.on("session_tree", async (_event, ctx) => clearFocusState(ctx));
	pi.on("session_shutdown", async (_event, ctx) => clearFocusState(ctx));

	pi.on("before_agent_start", async (event) => {
		return {
			systemPrompt:
				`${event.systemPrompt}\n\n` +
				[
					"You have a tiny user-visibility tool named focus_update.",
					"For any non-trivial task, call focus_update near the start of the work.",
					"Call it again when the work meaningfully changes, when you change subgoal, or when you discover a blocker.",
					"If you start a sidequest, update subgoal and problem so the user can follow it.",
					"If you realize you are already on a sidequest and it did not succeed quickly, update focus_update now with the current subgoal and problem.",
					"Keep fields short.",
					"Do not call it for every tool or micro-step.",
				].join("\n"),
		};
	});

	pi.registerTool({
		name: TOOL_NAME,
		label: "focus_update",
		description: "Update the tiny shared focus state: overall goal, current subgoal, and current blocker.",
		promptSnippet: "Update the tiny shared focus state for the user",
		promptGuidelines: [
			"For non-trivial tasks, call focus_update near the start of the work.",
			"Call it again when the work meaningfully changes, when you change subgoal, or when you discover a blocker.",
			"If you start a sidequest, or realize an ongoing sidequest is not resolving quickly, update subgoal and problem so the user can follow it.",
			"Keep goal, subgoal, and problem very short.",
		],
		parameters: focusUpdateSchema,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const next = buildFocusState(params as FocusUpdateParams);
			const changed = !sameFocusState(current, next);

			if (changed) {
				history = pushHistory(history, current);
				current = next;
			} else if (!hasFocus(current)) {
				current = next;
			} else {
				current = { ...current, updatedAt: next.updatedAt };
			}

			updateStatusUi(ctx);
			const details = cloneDetails(current, history);
			const text = !hasFocus(current) ? "Focus cleared" : changed ? "Focus updated" : "Focus unchanged";

			return {
				content: [{ type: "text" as const, text }],
				details,
			};
		},
		renderCall(args, theme) {
			const params = args as FocusUpdateParams;
			const parts = [normalizeText(params.goal), normalizeText(params.subgoal)].filter(
				(part): part is string => !!part,
			);
			let text = theme.fg("toolTitle", theme.bold("focus_update"));
			if (parts.length > 0) {
				text += " " + theme.fg("muted", parts.join(" / "));
			}
			return new Text(text, 0, 0);
		},
		renderResult(result, _options, theme) {
			const details = parseFocusDetails(result.details);
			if (!details) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}

			const lines = formatResultLines(details.current)
				.split("\n")
				.map((line) => {
					if (line.startsWith("goal:")) return theme.fg("dim", "goal:") + line.slice(5);
					if (line.startsWith("sub:")) return theme.fg("dim", "sub:") + line.slice(4);
					if (line.startsWith("prob:")) return theme.fg("dim", "prob:") + line.slice(5);
					return theme.fg("muted", line);
				})
				.join("\n");

			return new Text(lines, 0, 0);
		},
	});

	pi.registerCommand("focus", {
		description: "Show the current focus state and recent focus history",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("/focus requires interactive mode", "error");
				return;
			}

			const details = cloneDetails(current, history);
			await ctx.ui.custom<void>((_tui, theme, _kb, done) => {
				return new FocusPopupComponent(details.current, details.history, theme, () => done());
			});
		},
	});
}
