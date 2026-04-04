import { Dirent } from "node:fs";
import { lstat, readFile, readdir, readlink } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import { homedir } from "node:os";

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Box, Text } from "@mariozechner/pi-tui";
import ignore from "ignore";
import { buildHashlinePreview, resolveHashlinePath } from "../hashline-tools/index.ts";

const CONTEXT_TYPE = "at-preload-context";
const SUMMARY_TYPE = "at-preload-summary";
const UI_KEY = "at-preload";
const FILE_PRELOAD_LIMIT = 200;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico", ".avif"]);
const IGNORE_FILE_NAMES = [".gitignore", ".ignore", ".piignore"] as const;
const DEFAULT_IGNORE_RULES = [".git/", ".jj/", ".svn/", "node_modules/"] as const;
type PreloadItem =
	| {
			kind: "file";
			mention: string;
			requestedPath: string;
			resolvedPath: string;
			displayPath: string;
			totalLines: number;
			loadedLines: number;
			content: string;
	  }
	| {
			kind: "directory";
			mention: string;
			requestedPath: string;
			resolvedPath: string;
			displayPath: string;
			entryCount: number;
			content: string;
	  }
	| {
			kind: "missing" | "unsupported" | "error";
			mention: string;
			requestedPath: string;
			resolvedPath?: string;
			displayPath: string;
			message: string;
	  };

type PendingState = {
	items: PreloadItem[];
	summaryLines: string[];
	contextText?: string;
	announced: boolean;
};

type SummaryDetails = {
	items: Array<{
		kind: PreloadItem["kind"];
		displayPath: string;
		detail: string;
		previewLines?: string[];
		remainingLineCount?: number;
	}>;
};

type IgnoreMatcher = {
	baseRelativePath: string;
	matcher: ReturnType<typeof ignore>;
};

function isProbablyText(buffer: Buffer, path: string): boolean {
	const extension = extname(path).toLowerCase();
	if (IMAGE_EXTENSIONS.has(extension)) return false;
	if (buffer.includes(0)) return false;
	if (buffer.length === 0) return true;

	let suspicious = 0;
	const sampleLength = Math.min(buffer.length, 4096);
	for (let i = 0; i < sampleLength; i++) {
		const byte = buffer[i] ?? 0;
		const isControl = byte < 32 && byte !== 9 && byte !== 10 && byte !== 13;
		if (isControl) suspicious++;
	}
	return suspicious / sampleLength < 0.1;
}


function resolveMentionPath(cwd: string, rawPath: string): string {
	if (rawPath === "~") return homedir();
	if (rawPath.startsWith(`~${sep}`) || rawPath.startsWith("~/")) {
		return resolve(homedir(), rawPath.slice(2));
	}
	return resolveHashlinePath(cwd, rawPath);
}

function toDisplayPath(cwd: string, absolutePath: string): string {
	const rel = relative(cwd, absolutePath);
	if (!rel || rel === "") return ".";
	if (!rel.startsWith(`..${sep}`) && rel !== "..") return rel;
	return absolutePath;
}

function stripTrailingPunctuation(value: string): string {
	return value.replace(/[),.;:!?]+$/g, "");
}

function extractAtMentions(text: string): string[] {
	const mentions: string[] = [];
	const regex = /(^|[\s([{"'`])@(?:"([^"]+)"|'([^']+)'|`([^`]+)`|([^\s\])},:;!?]+))/g;

	for (const match of text.matchAll(regex)) {
		const quoted = match[2] ?? match[3] ?? match[4];
		const bare = match[5];
		const value = quoted ?? stripTrailingPunctuation(bare ?? "");
		if (!value) continue;
		mentions.push(value);
	}

	return [...new Set(mentions)];
}

async function preloadFile(cwd: string, requestedPath: string): Promise<PreloadItem> {
	const resolvedPath = resolveMentionPath(cwd, requestedPath);
	const displayPath = toDisplayPath(cwd, resolvedPath);
	const buffer = await readFile(resolvedPath);

	if (!isProbablyText(buffer, resolvedPath)) {
		return {
			kind: "unsupported",
			mention: `@${requestedPath}`,
			requestedPath,
			resolvedPath,
			displayPath,
			message: "Binary or image file; skipped text preload.",
		};
	}

	const preview = buildHashlinePreview(buffer.toString("utf8"), {
		offset: 1,
		limit: FILE_PRELOAD_LIMIT,
	});

	return {
		kind: "file",
		mention: `@${requestedPath}`,
		requestedPath,
		resolvedPath,
		displayPath,
		totalLines: preview.totalFileLines,
		loadedLines: preview.selectedLines.length,
		content: preview.anchored,
	};
}

function sortDirents(entries: Dirent[]): Dirent[] {
	return [...entries].sort((a, b) => {
		const aDir = a.isDirectory() ? 0 : 1;
		const bDir = b.isDirectory() ? 0 : 1;
		if (aDir !== bDir) return aDir - bDir;
		return a.name.localeCompare(b.name);
	});
}

function formatDirectoryPath(path: string): string {
	if (path === "/") return path;
	return `${path.replace(/[\\/]+$/g, "")}/`;
}

function joinDisplayPath(parent: string, child: string): string {
	if (parent === ".") return `./${child}`;
	return `${parent}/${child}`;
}

function normalizeIgnorePath(path: string): string {
	return path.split("\\").join("/");
}

function normalizeToLF(text: string): string {
	return text.replace(/\r\n?/g, "\n");
}

function trimTrailingSlash(path: string): string {
	return path.replace(/\/+$/g, "");
}

function toMatcherRelativePath(relativePath: string, baseRelativePath: string): string | null {
	const normalizedRelativePath = trimTrailingSlash(normalizeIgnorePath(relativePath));
	const normalizedBasePath = trimTrailingSlash(normalizeIgnorePath(baseRelativePath));
	if (!normalizedBasePath) return normalizedRelativePath;
	if (normalizedRelativePath === normalizedBasePath) return "";
	const prefix = `${normalizedBasePath}/`;
	if (!normalizedRelativePath.startsWith(prefix)) return null;
	return normalizedRelativePath.slice(prefix.length);
}

async function loadIgnoreMatcher(baseRelativePath: string, absoluteDirectoryPath: string): Promise<IgnoreMatcher | undefined> {
	let combinedRules = "";
	for (const fileName of IGNORE_FILE_NAMES) {
		try {
			const raw = await readFile(resolve(absoluteDirectoryPath, fileName), "utf8");
			if (raw.trim() === "") continue;
			combinedRules += `${combinedRules ? "\n" : ""}${normalizeToLF(raw)}`;
		} catch (error: any) {
			if (error?.code !== "ENOENT") throw error;
		}
	}
	if (!combinedRules) return undefined;
	return {
		baseRelativePath,
		matcher: ignore().add(combinedRules),
	};
}

function shouldIgnorePath(relativePath: string, isDirectory: boolean, matchers: IgnoreMatcher[]): boolean {
	const normalizedRelativePath = trimTrailingSlash(normalizeIgnorePath(relativePath));
	let ignored = false;
	for (const { baseRelativePath, matcher } of matchers) {
		const matcherRelativePath = toMatcherRelativePath(normalizedRelativePath, baseRelativePath);
		if (matcherRelativePath == null || matcherRelativePath === "") continue;
		const candidates = isDirectory ? [matcherRelativePath, `${matcherRelativePath}/`] : [matcherRelativePath];
		for (const candidate of candidates) {
			const result = (matcher as any).test?.(candidate);
			if (result && (result.ignored || result.unignored)) {
				ignored = !!result.ignored;
				continue;
			}
			if (matcher.ignores(candidate)) ignored = true;
		}
	}
	return ignored;
}

async function buildPathList(
	path: string,
	displayPath: string,
	directoryRelativePath = "",
	parentMatchers: IgnoreMatcher[] = [{ baseRelativePath: "", matcher: ignore().add(DEFAULT_IGNORE_RULES) }],
): Promise<{ lines: string[]; entryCount: number }> {
	const localMatcher = await loadIgnoreMatcher(directoryRelativePath, path);
	const matchers = localMatcher ? [...parentMatchers, localMatcher] : parentMatchers;
	const entries = sortDirents(await readdir(path, { withFileTypes: true }));
	const lines: string[] = [];
	let entryCount = 0;

	for (const entry of entries) {
		const entryPath = resolve(path, entry.name);
		const entryRelativePath = normalizeIgnorePath(directoryRelativePath ? `${directoryRelativePath}/${entry.name}` : entry.name);
		if (shouldIgnorePath(entryRelativePath, entry.isDirectory(), matchers)) continue;
		const entryDisplayPath = joinDisplayPath(displayPath, entry.name);
		entryCount++;

		if (entry.isSymbolicLink()) {
			let target = "";
			try {
				target = await readlink(entryPath);
			} catch {
				target = "?";
			}
			lines.push(`${entryDisplayPath}@ -> ${target}`);
			continue;
		}

		if (entry.isDirectory()) {
			lines.push(formatDirectoryPath(entryDisplayPath));
			try {
				const child = await buildPathList(entryPath, entryDisplayPath, entryRelativePath, matchers);
				lines.push(...child.lines);
				entryCount += child.entryCount;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				lines.push(`${formatDirectoryPath(entryDisplayPath)} [error: ${message}]`);
			}
			continue;
		}

		lines.push(entryDisplayPath);
	}

	return { lines, entryCount };
}

async function preloadDirectory(cwd: string, requestedPath: string): Promise<PreloadItem> {
	const resolvedPath = resolveMentionPath(cwd, requestedPath);
	const displayPath = toDisplayPath(cwd, resolvedPath);
	const rootLabel = formatDirectoryPath(displayPath === "." ? requestedPath || "." : displayPath);
	const listing = await buildPathList(resolvedPath, rootLabel.slice(0, -1));
	const lines = [rootLabel, ...listing.lines];

	return {
		kind: "directory",
		mention: `@${requestedPath}`,
		requestedPath,
		resolvedPath,
		displayPath,
		entryCount: listing.entryCount,
		content: lines.join("\n"),
	};
}

async function preloadMention(cwd: string, requestedPath: string): Promise<PreloadItem> {
	const resolvedPath = resolveMentionPath(cwd, requestedPath);
	const displayPath = toDisplayPath(cwd, resolvedPath);

	try {
		const stats = await lstat(resolvedPath);
		if (stats.isDirectory()) return preloadDirectory(cwd, requestedPath);
		if (stats.isFile()) return preloadFile(cwd, requestedPath);
		return {
			kind: "unsupported",
			mention: `@${requestedPath}`,
			requestedPath,
			resolvedPath,
			displayPath,
			message: "Not a regular file or directory.",
		};
	} catch (error: any) {
		if (error?.code === "ENOENT") {
			return {
				kind: "missing",
				mention: `@${requestedPath}`,
				requestedPath,
				resolvedPath,
				displayPath,
				message: "Path not found.",
			};
		}
		return {
			kind: "error",
			mention: `@${requestedPath}`,
			requestedPath,
			resolvedPath,
			displayPath,
			message: error instanceof Error ? error.message : String(error),
		};
	}
}

function buildContextText(items: PreloadItem[]): string | undefined {
	if (items.length === 0) return undefined;

	const sections: string[] = [
		"The @-preload extension detected @path mentions in the user's prompt and preloaded them before this turn.",
		"File sections below use the same LINE#ID:content hashline style as the hashline read workflow.",
		"Directory sections below are plain ordered path lists.",
		"If you need fresh anchors or lines outside 1-200, call read yourself.",
	];

	for (const item of items) {
		if (item.kind === "file") {
			sections.push(
				[
					``,
					`=== FILE ${item.mention} ===`,
					`Resolved path: ${item.displayPath}`,
					`Equivalent preload: read(path=${JSON.stringify(item.requestedPath)}, offset=1, limit=${FILE_PRELOAD_LIMIT})`,
					`Loaded lines: 1-${item.loadedLines}${item.totalLines > item.loadedLines ? ` of ${item.totalLines}` : ""}`,
					item.content || "[empty file]",
				].join("\n"),
			);
			continue;
		}

		if (item.kind === "directory") {
			sections.push(
				[
					``,
					`=== DIRECTORY ${item.mention} ===`,
					`Resolved path: ${item.displayPath}`,
					`Ordered path preload (${item.entryCount} entries):`,
					item.content,
				].join("\n"),
			);
			continue;
		}

		sections.push(
			[
				``,
				`=== ${item.kind.toUpperCase()} ${item.mention} ===`,
				`Resolved path: ${item.displayPath}`,
				item.message,
			].join("\n"),
		);
	}

	return sections.join("\n");
}

function buildPreviewLines(content: string, limit = 10): { lines: string[]; remainingLineCount: number } {
	const lines = content === "" ? [] : content.split("\n");
	return {
		lines: lines.slice(0, limit),
		remainingLineCount: Math.max(0, lines.length - limit),
	};
}

function buildSummaryState(items: PreloadItem[]): PendingState {
	const summaryLines: string[] = [];

	for (const item of items) {
		if (item.kind === "file") {
			const detail =
				item.totalLines > item.loadedLines
					? `file · lines 1-${item.loadedLines} of ${item.totalLines}`
					: `file · ${item.loadedLines} lines`;
			summaryLines.push(`✓ ${item.displayPath} — ${detail}`);
			continue;
		}

		if (item.kind === "directory") {
			const detail = `dir · ${item.entryCount} entries`;
			summaryLines.push(`✓ ${item.displayPath}/ — ${detail}`);
			continue;
		}

		summaryLines.push(`⚠ ${item.displayPath} — ${item.message}`);
	}

	return {
		items,
		summaryLines,
		contextText: buildContextText(items),
		announced: false,
	};
}

function summaryDetailsFromState(state: PendingState): SummaryDetails {
	return {
		items: state.items.map((item) => {
			if (item.kind === "file") {
				const preview = buildPreviewLines(item.content);
				return {
					kind: item.kind,
					displayPath: item.displayPath,
					detail:
						item.totalLines > item.loadedLines
							? `lines 1-${item.loadedLines} of ${item.totalLines}`
							: `${item.loadedLines} lines`,
					previewLines: preview.lines,
					remainingLineCount: preview.remainingLineCount,
				};
			}
			if (item.kind === "directory") {
				const preview = buildPreviewLines(item.content);
				return {
					kind: item.kind,
					displayPath: `${item.displayPath}/`,
					detail: `${item.entryCount} entries`,
					previewLines: preview.lines,
					remainingLineCount: preview.remainingLineCount,
				};
			}
			return {
				kind: item.kind,
				displayPath: item.displayPath,
				detail: item.message,
			};
		}),
	};
}

function applyUI(ctx: ExtensionContext): void {
	if (!ctx.hasUI) return;
	ctx.ui.setStatus(UI_KEY, undefined);
	ctx.ui.setWidget(UI_KEY, undefined, { placement: "belowEditor" });
}

function clearState(ctx?: ExtensionContext): void {
	if (ctx) applyUI(ctx);
}

export default function atPreloadExtension(pi: ExtensionAPI) {
	let pendingState: PendingState | null = null;

	pi.registerMessageRenderer(SUMMARY_TYPE, (message, { expanded }, theme) => {
		const details = (message.details as SummaryDetails | undefined)?.items ?? [];
		let text = `${theme.fg("accent", theme.bold("📥 @ preloads"))}`;

		for (const item of details) {
			const isSuccess = item.kind === "file" || item.kind === "directory";
			const icon = isSuccess ? theme.fg("success", "✓") : theme.fg("warning", "⚠");
			text += `\n${icon} ${item.displayPath}`;
			if (item.detail) {
				text += theme.fg("dim", ` — ${item.detail}`);
			}
			if (item.previewLines && item.previewLines.length > 0) {
				for (const line of item.previewLines) {
					text += `\n${theme.fg("muted", line)}`;
				}
				if ((item.remainingLineCount ?? 0) > 0) {
					text += `\n${theme.fg("muted", `... ${item.remainingLineCount} more lines`)}`;
				}
			}
		}

		if (expanded) {
			text += theme.fg("muted", "\n(preview capped at 10 lines per item)");
		}

		const box = new Box(1, 1, (value) => theme.bg("customMessageBg", value));
		box.addChild(new Text(text, 0, 0));
		return box;
	});

	pi.on("session_start", async (_event, ctx) => {
		pendingState = null;
		clearState(ctx);
	});

	pi.on("session_switch", async (_event, ctx) => {
		pendingState = null;
		clearState(ctx);
	});

	pi.on("context", async (event) => {
		let lastContextIndex = -1;
		for (let i = 0; i < event.messages.length; i++) {
			const message = event.messages[i] as { customType?: string };
			if (message.customType === CONTEXT_TYPE) lastContextIndex = i;
		}

		return {
			messages: event.messages.filter((message, index) => {
				const customType = (message as { customType?: string }).customType;
				if (customType === SUMMARY_TYPE) return false;
				if (customType === CONTEXT_TYPE && index !== lastContextIndex) return false;
				return true;
			}),
		};
	});

	pi.on("before_agent_start", async (event, ctx) => {
		const mentions = extractAtMentions(event.prompt);
		if (mentions.length === 0) {
			pendingState = null;
			clearState(ctx);
			return undefined;
		}

		const items = await Promise.all(mentions.map((mention) => preloadMention(ctx.cwd, mention)));
		pendingState = buildSummaryState(items);
		applyUI(ctx);

		if (!pendingState.contextText) return undefined;
		return {
			message: {
				customType: CONTEXT_TYPE,
				content: pendingState.contextText,
				display: false,
			},
		};
	});

	pi.on("agent_start", async (_event, ctx) => {
		if (!pendingState || pendingState.announced) return;
		pendingState.announced = true;
		applyUI(ctx);
		pi.sendMessage(
			{
				customType: SUMMARY_TYPE,
				content: pendingState.summaryLines.join("\n"),
				display: true,
				details: summaryDetailsFromState(pendingState),
			},
			{ triggerTurn: false },
		);
	});
}
