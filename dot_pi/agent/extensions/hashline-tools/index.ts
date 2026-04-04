import { createHash } from "node:crypto";
import { Dirent } from "node:fs";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";

import type { ExtensionAPI, ReadToolDetails, EditToolDetails } from "@mariozechner/pi-coding-agent";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	createReadTool,
	createWriteTool,
	truncateHead,
	withFileMutationQueue,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import ignore from "ignore";


const HASH_ALPHABET = "ZPMQVRWSNKTXJBYH";
const SIGNIFICANT_RE = /[A-Za-z0-9]/;
const HASHLINE_RE = /^\s*(\d+)\s*#\s*([ZPMQVRWSNKTXJBYH]{2})/;
const HASHLINE_PREFIX_RE = new RegExp(`^\\s*\\d+\\s*#\\s*[${HASH_ALPHABET}]{2}\\s*:`);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const FIND_IGNORE_FILE_NAMES = [".gitignore", ".ignore", ".piignore"] as const;
const FIND_DEFAULT_IGNORE_RULES = [".git/", ".jj/", ".svn/", "node_modules/"] as const;
const FIND_FALLBACK_PREVIEW_START = 1;
const FIND_FALLBACK_PREVIEW_LIMIT = 20;


const readSchema = Type.Object({
	path: Type.String({ description: "Path to the file to read (relative or absolute)" }),
	offset: Type.Optional(Type.Number({ description: "Line number to start reading from (1-indexed)" })),
	limit: Type.Optional(Type.Number({ description: "Maximum number of lines to read" })),
});

const findSchema = Type.Object({
	path: Type.Optional(Type.String({ description: "Directory to search from (relative or absolute, default .)" })),
	pattern: Type.Optional(Type.String({ description: "Glob pattern for matching files (default **)" })),
	"max-file-count": Type.Optional(Type.Number({ description: "Maximum number of matching files to include (default 200)" })),
});

const editItemSchema = Type.Object(
	{
		loc: Type.Any({
			description:
				'Hashline location: "append", "prepend", { append: "LINE#ID" }, { prepend: "LINE#ID" }, or { range: { pos: "LINE#ID", end: "LINE#ID" } }.',
		}),
		content: Type.Any({
			description: "Replacement/inserted lines. Usually an array of strings, one output line per array entry.",
		}),
	},
	{
		additionalProperties: false,
		description: "Hashline edit block: { loc, content }.",
	},
);

const editSchema = Type.Object(
	{
		path: Type.String({ description: "Path to the file to edit (relative or absolute)" }),
		edits: Type.Array(editItemSchema, {
			description:
				"Batch all edits for one file into a single call. Always copy LINE#ID anchors exactly from the most recent read output.",
		}),
	},
	{ additionalProperties: false },
);

const writeSchema = Type.Object({
	path: Type.String({ description: "Path to the file to write (relative or absolute)" }),
	content: Type.String({ description: "Content to write to the file" }),
});

type Anchor = {
	line: number;
	hash: string;
};

type HashlineMismatch = {
	line: number;
	expected: string;
	actual?: string;
	missing?: boolean;
};

type ParsedEditOperation = {
	kind: "append" | "prepend" | "insertAfter" | "insertBefore" | "replaceRange";
	contentLines: string[];
	oldStartIndex: number;
	oldEndIndex: number;
	priority: number;
	sortLine: number;
	description: string;
};

function normalizePath(path: string): string {
	return path.startsWith("@") ? path.slice(1) : path;
}

export function normalizeHashlinePath(path: string): string {
	return normalizePath(path);
}

function resolvePath(cwd: string, path: string): string {
	return resolve(cwd, normalizePath(path));
}

export function resolveHashlinePath(cwd: string, path: string): string {
	return resolvePath(cwd, path);
}

function isImagePath(path: string): boolean {
	return IMAGE_EXTENSIONS.has(extname(path).toLowerCase());
}

function isProbablyTextBuffer(buffer: Buffer, path: string): boolean {
	if (isImagePath(path)) return false;
	if (buffer.includes(0)) return false;
	if (buffer.length === 0) return true;

	let suspicious = 0;
	const sampleLength = Math.min(buffer.length, 4096);
	for (let index = 0; index < sampleLength; index++) {
		const byte = buffer[index] ?? 0;
		const isControl = byte < 32 && byte !== 9 && byte !== 10 && byte !== 13;
		if (isControl) suspicious++;
	}
	return suspicious / sampleLength < 0.1;
}

function sortDirents(entries: Dirent[]): Dirent[] {
	return [...entries].sort((a, b) => a.name.localeCompare(b.name));
}

function toDisplayPath(rootAbsolutePath: string, displayRoot: string, absolutePath: string): string {
	const rel = relative(rootAbsolutePath, absolutePath).split("\\").join("/");
	const normalizedRoot = normalizePath(displayRoot).replace(/[\\/]+$/g, "").split("\\").join("/") || ".";
	return rel ? `${normalizedRoot}/${rel}` : normalizedRoot;
}

function toMatchPath(rootAbsolutePath: string, absolutePath: string): string {
	return relative(rootAbsolutePath, absolutePath).split("\\").join("/");
}

type IgnoreMatcher = {
	baseRelativePath: string;
	matcher: ReturnType<typeof ignore>;
};

function trimTrailingSlash(path: string): string {
	return path.replace(/\/+$/g, "");
}

function toMatcherRelativePath(relativePath: string, baseRelativePath: string): string | null {
	const normalizedRelativePath = trimTrailingSlash(normalizeMatchCandidate(relativePath));
	const normalizedBasePath = trimTrailingSlash(normalizeMatchCandidate(baseRelativePath));
	if (!normalizedBasePath) return normalizedRelativePath;
	if (normalizedRelativePath === normalizedBasePath) return "";
	const prefix = `${normalizedBasePath}/`;
	if (!normalizedRelativePath.startsWith(prefix)) return null;
	return normalizedRelativePath.slice(prefix.length);
}

async function loadIgnoreMatcher(baseRelativePath: string, absoluteDirectoryPath: string): Promise<IgnoreMatcher | undefined> {
	let combinedRules = "";
	for (const fileName of FIND_IGNORE_FILE_NAMES) {
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
	const normalizedRelativePath = trimTrailingSlash(normalizeMatchCandidate(relativePath));
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

async function collectDirectoryFiles(
	absoluteDirectoryPath: string,
	directoryRelativePath = "",
	parentMatchers: IgnoreMatcher[] = [{ baseRelativePath: "", matcher: ignore().add(FIND_DEFAULT_IGNORE_RULES) }],
): Promise<string[]> {
	const localMatcher = await loadIgnoreMatcher(directoryRelativePath, absoluteDirectoryPath);
	const matchers = localMatcher ? [...parentMatchers, localMatcher] : parentMatchers;
	const entries = sortDirents(await readdir(absoluteDirectoryPath, { withFileTypes: true }));
	let files: string[] = [];
	for (const entry of entries) {
		const absolutePath = resolve(absoluteDirectoryPath, entry.name);
		const relativePath = normalizeMatchCandidate(directoryRelativePath ? `${directoryRelativePath}/${entry.name}` : entry.name);
		if (shouldIgnorePath(relativePath, entry.isDirectory(), matchers)) continue;
		if (entry.isDirectory()) {
			files = files.concat(await collectDirectoryFiles(absolutePath, relativePath, matchers));
			continue;
		}
		if (entry.isFile()) files.push(absolutePath);
	}
	return files;
}

function escapeRegex(text: string): string {
	return text.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function globToRegExp(pattern: string): RegExp {
	let regex = "^";
	for (let index = 0; index < pattern.length; ) {
		const char = pattern[index];
		const next = pattern[index + 1];
		if (char === "*" && next === "*") {
			regex += ".*";
			index += 2;
			continue;
		}
		if (char === "*") {
			regex += "[^/]*";
			index += 1;
			continue;
		}
		if (char === "?") {
			regex += "[^/]";
			index += 1;
			continue;
		}
		regex += escapeRegex(char);
		index += 1;
	}
	regex += "$";
	return new RegExp(regex);
}

function normalizeMatchCandidate(path: string): string {
	return path.split("\\").join("/").replace(/^\.\//, "");
}

function matchesPattern(displayPath: string, relativePath: string, pattern: string): boolean {
	const normalizedPattern = pattern.trim() || "**";
	const regex = globToRegExp(normalizedPattern.split("\\").join("/"));
	const candidates = [displayPath, relativePath, normalizeMatchCandidate(displayPath), normalizeMatchCandidate(relativePath)]
		.filter((value, index, values) => value !== "" && values.indexOf(value) === index);
	if (!normalizedPattern.includes("/")) {
		return candidates.some((candidate) => regex.test(candidate.split("/").pop() ?? candidate));
	}
	return candidates.some((candidate) => regex.test(candidate));
}

type OutlineEntry = {
	name: string;
	line: number;
	kind?: number;
};

async function requestOutline(pi: ExtensionAPI, file: string, timeoutMs = 1500): Promise<OutlineEntry[]> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error("Timed out waiting for LSP outline")), timeoutMs);
		pi.events.emit("pi-lsp:outline-request", {
			file,
			resolve: (value: OutlineEntry[]) => {
				clearTimeout(timer);
				resolve(Array.isArray(value) ? value : []);
			},
			reject: (error: unknown) => {
				clearTimeout(timer);
				reject(error instanceof Error ? error : new Error(String(error)));
			},
		});
	});
}

function buildOutlineHashPreview(
	raw: string,
	outline: OutlineEntry[],
): { totalFileLines: number; lines: string[]; usedOutline: boolean } {
	const text = normalizeToLF(raw);
	const allLines = textToLines(text);
	const totalFileLines = allLines.length;
	const deduped = new Set<number>();
	const availableOutline = outline.filter(
		(entry) => entry.line >= 1 && entry.line <= totalFileLines && !deduped.has(entry.line) && deduped.add(entry.line),
	);
	if (availableOutline.length > 0) {
		const outlineLines = availableOutline.map((entry) => {
			const sourceLine = allLines[entry.line - 1] ?? "";
			return formatHashLine(entry.line, sourceLine);
		});
		return { totalFileLines, lines: outlineLines, usedOutline: true };
	}
	const fallback = buildHashlinePreview(raw, {
		offset: FIND_FALLBACK_PREVIEW_START,
		limit: FIND_FALLBACK_PREVIEW_LIMIT,
	});
	return { totalFileLines, lines: fallback.anchored ? fallback.anchored.split("\n") : [], usedOutline: false };
}

function textToLines(text: string): string[] {
	if (text === "") return [];
	return text.split("\n");
}

function stripBom(text: string): { bom: string; text: string } {
	return text.startsWith("\uFEFF") ? { bom: "\uFEFF", text: text.slice(1) } : { bom: "", text };
}

function detectLineEnding(text: string): "\n" | "\r\n" {
	return text.includes("\r\n") ? "\r\n" : "\n";
}

function normalizeToLF(text: string): string {
	return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function restoreLineEndings(text: string, lineEnding: "\n" | "\r\n"): string {
	return lineEnding === "\r\n" ? text.replace(/\n/g, "\r\n") : text;
}

function normalizeHashInput(line: string): string {
	return line.replace(/\r/g, "").replace(/[ \t]+$/g, "");
}

export function computeLineHash(lineNumber: number, line: string): string {
	const normalized = normalizeHashInput(line);
	const seed = SIGNIFICANT_RE.test(normalized) ? 0 : lineNumber;
	const digest = createHash("sha1").update(String(seed)).update("\0").update(normalized).digest();
	const byte = digest[0] ?? 0;
	return `${HASH_ALPHABET[(byte >> 4) & 0x0f]}${HASH_ALPHABET[byte & 0x0f]}`;
}

function formatHashLine(lineNumber: number, line: string): string {
	return `${lineNumber}#${computeLineHash(lineNumber, line)}:${line.replace(/\r$/, "")}`;
}

export function stripHashlinePrefix(line: string): string {
	return line.replace(HASHLINE_PREFIX_RE, "");
}

function sanitizeContentLine(line: string): string {
	const withoutPrefix = stripHashlinePrefix(line.replace(/\r$/, ""));
	const escapedTabs = withoutPrefix.match(/^(?:\\t)+/);
	if (!escapedTabs) return withoutPrefix;
	return "\t".repeat(escapedTabs[0].length / 2) + withoutPrefix.slice(escapedTabs[0].length);
}

function normalizeContentLines(content: unknown): string[] {
	if (Array.isArray(content)) {
		return content.map((line) => sanitizeContentLine(String(line)));
	}
	if (typeof content === "string") {
		return content.split("\n").map((line) => sanitizeContentLine(line));
	}
	throw new Error("Each edit.content must be a string array (or a newline-delimited string).");
}

function parseAnchor(value: string): Anchor {
	const match = value.match(HASHLINE_RE);
	if (!match) {
		throw new Error(`Invalid LINE#ID anchor: ${JSON.stringify(value)}. Expected a value like \"12#RZ\" copied from read output.`);
	}
	const line = Number(match[1]);
	if (!Number.isInteger(line) || line <= 0) {
		throw new Error(`Invalid anchor line number in ${JSON.stringify(value)}.`);
	}
	return { line, hash: match[2] };
}

function validateAnchor(anchor: Anchor, fileLines: string[], mismatches: HashlineMismatch[]): void {
	const current = fileLines[anchor.line - 1];
	if (current === undefined) {
		mismatches.push({ line: anchor.line, expected: anchor.hash, missing: true });
		return;
	}
	const actual = computeLineHash(anchor.line, current);
	if (actual !== anchor.hash) {
		mismatches.push({ line: anchor.line, expected: anchor.hash, actual });
	}
}

function renderMismatchContext(fileLines: string[], mismatchLine: number): string {
	if (fileLines.length === 0) {
		return "    [file is currently empty]";
	}

	const start = Math.max(1, mismatchLine - 1);
	const end = Math.min(fileLines.length, mismatchLine + 1);
	const lines: string[] = [];
	for (let line = start; line <= end; line++) {
		const marker = line === mismatchLine ? ">>>" : "   ";
		lines.push(`${marker} ${formatHashLine(line, fileLines[line - 1])}`);
	}
	if (mismatchLine > fileLines.length) {
		lines.push(`>>> line ${mismatchLine} no longer exists`);
	}
	return lines.join("\n");
}

function formatMismatchError(mismatches: HashlineMismatch[], fileLines: string[]): string {
	const uniqueLines = [...new Set(mismatches.map((m) => m.line))].sort((a, b) => a - b);
	const label = uniqueLines.length === 1 ? "line has" : "lines have";
	const sections = uniqueLines.map((line) => renderMismatchContext(fileLines, line)).join("\n\n");
	return `${uniqueLines.length} ${label} changed since the last read. Use the updated LINE#ID references shown below (>>> marks changed lines).\n\n${sections}`;
}

function dedupeOperations(operations: ParsedEditOperation[]): ParsedEditOperation[] {
	const seen = new Set<string>();
	const result: ParsedEditOperation[] = [];
	for (const operation of operations) {
		const key = JSON.stringify({
			kind: operation.kind,
			contentLines: operation.contentLines,
			oldStartIndex: operation.oldStartIndex,
			oldEndIndex: operation.oldEndIndex,
		});
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(operation);
	}
	return result;
}

function assertNoOverlappingRangeReplacements(operations: ParsedEditOperation[]): void {
	const ranges = operations
		.filter((operation) => operation.kind === "replaceRange")
		.sort((a, b) => a.oldStartIndex - b.oldStartIndex);

	for (let i = 1; i < ranges.length; i++) {
		const previous = ranges[i - 1];
		const current = ranges[i];
		if (current.oldStartIndex < previous.oldEndIndex) {
			throw new Error(
				`Overlapping range edits are not allowed. ${previous.description} overlaps ${current.description}. Merge them into one range edit.`,
			);
		}
	}
}

function parseHashlineOperations(rawEdits: unknown[], fileLines: string[]): ParsedEditOperation[] {
	const mismatches: HashlineMismatch[] = [];
	const operations: ParsedEditOperation[] = [];

	for (const rawEdit of rawEdits) {
		if (!rawEdit || typeof rawEdit !== "object") {
			throw new Error("Each edit must be an object.");
		}

		const loc = (rawEdit as any).loc;
		const contentLines = normalizeContentLines((rawEdit as any).content);

		if (loc === "append") {
			operations.push({
				kind: "append",
				contentLines,
				oldStartIndex: fileLines.length,
				oldEndIndex: fileLines.length,
				priority: 4,
				sortLine: fileLines.length + 1,
				description: "append",
			});
			continue;
		}

		if (loc === "prepend") {
			operations.push({
				kind: "prepend",
				contentLines,
				oldStartIndex: 0,
				oldEndIndex: 0,
				priority: 0,
				sortLine: 0,
				description: "prepend",
			});
			continue;
		}

		if (!loc || typeof loc !== "object") {
			throw new Error(
				"Each hashline edit must provide loc as one of: \"append\", \"prepend\", { append: \"LINE#ID\" }, { prepend: \"LINE#ID\" }, or { range: { pos: \"LINE#ID\", end: \"LINE#ID\" } }.",
			);
		}

		if (typeof (loc as any).append === "string") {
			const anchor = parseAnchor((loc as any).append);
			validateAnchor(anchor, fileLines, mismatches);
			operations.push({
				kind: "insertAfter",
				contentLines,
				oldStartIndex: anchor.line,
				oldEndIndex: anchor.line,
				priority: 2,
				sortLine: anchor.line,
				description: `insert after ${anchor.line}#${anchor.hash}`,
			});
			continue;
		}

		if (typeof (loc as any).prepend === "string") {
			const anchor = parseAnchor((loc as any).prepend);
			validateAnchor(anchor, fileLines, mismatches);
			operations.push({
				kind: "insertBefore",
				contentLines,
				oldStartIndex: anchor.line - 1,
				oldEndIndex: anchor.line - 1,
				priority: 1,
				sortLine: anchor.line,
				description: `insert before ${anchor.line}#${anchor.hash}`,
			});
			continue;
		}

		const range = (loc as any).range;
		if (range && typeof range === "object" && typeof range.pos === "string" && typeof range.end === "string") {
			const start = parseAnchor(range.pos);
			const end = parseAnchor(range.end);
			if (end.line < start.line) {
				throw new Error(`Invalid range ${range.pos}..${range.end}: end must be on or after start.`);
			}
			validateAnchor(start, fileLines, mismatches);
			if (end.line !== start.line || end.hash !== start.hash) {
				validateAnchor(end, fileLines, mismatches);
			}
			operations.push({
				kind: "replaceRange",
				contentLines,
				oldStartIndex: start.line - 1,
				oldEndIndex: end.line,
				priority: 3,
				sortLine: end.line,
				description: `replace ${start.line}#${start.hash}..${end.line}#${end.hash}`,
			});
			continue;
		}

		throw new Error(
			"Unsupported hashline edit loc. Use \"append\", \"prepend\", { append: \"LINE#ID\" }, { prepend: \"LINE#ID\" }, or { range: { pos: \"LINE#ID\", end: \"LINE#ID\" } }.",
		);
	}

	if (mismatches.length > 0) {
		throw new Error(formatMismatchError(mismatches, fileLines));
	}

	const deduped = dedupeOperations(operations);
	assertNoOverlappingRangeReplacements(deduped);
	return deduped;
}

function operationSortValue(operation: ParsedEditOperation): number {
	return operation.sortLine * 10 + operation.priority;
}

function applyOperations(originalLines: string[], operations: ParsedEditOperation[]): string[] {
	const lines = [...originalLines];
	const sorted = [...operations].sort((a, b) => operationSortValue(b) - operationSortValue(a));

	for (const operation of sorted) {
		switch (operation.kind) {
			case "append":
				lines.splice(lines.length, 0, ...operation.contentLines);
				break;
			case "prepend":
				lines.splice(0, 0, ...operation.contentLines);
				break;
			case "insertAfter":
				lines.splice(operation.oldStartIndex, 0, ...operation.contentLines);
				break;
			case "insertBefore":
				lines.splice(operation.oldStartIndex, 0, ...operation.contentLines);
				break;
			case "replaceRange":
				lines.splice(
					operation.oldStartIndex,
					operation.oldEndIndex - operation.oldStartIndex,
					...operation.contentLines,
				);
				break;
		}
	}

	return lines;
}
function buildEditOverview(nextLines: string[], operations: ParsedEditOperation[]): string[] {
	if (operations.length === 0) return [];
	if (nextLines.length === 0) return ["[empty file]"];
	const sorted = [...operations].sort((a, b) => a.oldStartIndex - b.oldStartIndex || a.priority - b.priority);
	const ranges: Array<{ start: number; end: number }> = [];
	let delta = 0;

	for (const operation of sorted) {
		const oldCount = operation.oldEndIndex - operation.oldStartIndex;
		const newStart = operation.oldStartIndex + 1 + delta;
		const newCount = operation.contentLines.length;

		if (newCount > 0) {
			ranges.push({ start: Math.max(1, newStart), end: Math.max(1, newStart + newCount - 1) });
		} else {
			const anchor = Math.min(Math.max(1, newStart), nextLines.length);
			ranges.push({ start: anchor, end: anchor });
		}

		delta += newCount - oldCount;
	}

	const merged: Array<{ start: number; end: number }> = [];
	for (const range of ranges) {
		if (range.start < 1 || range.start > nextLines.length) continue;
		const previous = merged[merged.length - 1];
		if (previous && range.start <= previous.end + 1) {
			previous.end = Math.max(previous.end, Math.min(range.end, nextLines.length));
			continue;
		}
		merged.push({ start: range.start, end: Math.min(range.end, nextLines.length) });
	}

	const overview: string[] = [];
	for (const range of merged) {
		if (overview.length > 0) overview.push("...");
		for (let lineNumber = range.start; lineNumber <= range.end; lineNumber++) {
			overview.push(formatHashLine(lineNumber, nextLines[lineNumber - 1] ?? ""));
		}
	}

	return overview;
}

function buildUnifiedDiff(originalLines: string[], operations: ParsedEditOperation[]): { diff: string; firstChangedLine?: number } {
	if (operations.length === 0) return { diff: "" };

	const sorted = [...operations].sort((a, b) => a.oldStartIndex - b.oldStartIndex || a.priority - b.priority);
	const diffLines = ["--- before", "+++ after"];
	let delta = 0;
	let firstChangedLine: number | undefined;

	for (const operation of sorted) {
		const oldStart = operation.oldStartIndex + 1;
		const oldCount = operation.oldEndIndex - operation.oldStartIndex;
		const newStart = operation.oldStartIndex + 1 + delta;
		const newCount = operation.contentLines.length;
		if (firstChangedLine === undefined) {
			firstChangedLine = Math.max(1, newStart);
		}

		diffLines.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
		for (const line of originalLines.slice(operation.oldStartIndex, operation.oldEndIndex)) {
			diffLines.push(`-${line}`);
		}
		for (const line of operation.contentLines) {
			diffLines.push(`+${line}`);
		}

		delta += newCount - oldCount;
	}

	return { diff: diffLines.join("\n"), firstChangedLine };
}

function countDiffLines(diff: string): { additions: number; removals: number } {
	let additions = 0;
	let removals = 0;
	for (const line of diff.split("\n")) {
		if (line.startsWith("+") && !line.startsWith("+++")) additions++;
		if (line.startsWith("-") && !line.startsWith("---")) removals++;
	}
	return { additions, removals };
}

export function prefixHashLines(lines: string[], startLineNumber: number): string {
	return lines.map((line, index) => formatHashLine(startLineNumber + index, line)).join("\n");
}

export function buildHashlinePreview(
	raw: string,
	options: { offset?: number; limit?: number } = {},
): { totalFileLines: number; selectedLines: string[]; anchored: string; startLine: number } {
	const text = normalizeToLF(raw);
	const allLines = textToLines(text);
	const totalFileLines = allLines.length;
	const startIndex = options.offset ? Math.max(0, options.offset - 1) : 0;
	if (startIndex > allLines.length - 1 && !(allLines.length === 0 && startIndex === 0)) {
		throw new Error(`Offset ${options.offset} is beyond end of file (${totalFileLines} lines total)`);
	}

	const endIndex = options.limit ? startIndex + Math.max(0, options.limit) : allLines.length;
	const selectedLines = allLines.slice(startIndex, endIndex).map((line) => line.replace(/\r$/, ""));
	return {
		totalFileLines,
		selectedLines,
		anchored: prefixHashLines(selectedLines, startIndex + 1),
		startLine: startIndex + 1,
	};
}

export function stripHashlinePrefixesFromText(text: string): string {
	return text
		.split("\n")
		.map((line) => stripHashlinePrefix(line))
		.join("\n");
}

export default function hashlineTools(pi: ExtensionAPI) {
	pi.registerTool({
		name: "read",
		label: "read",
		description:
			"Read file contents with LINE#ID hash anchors. Text files are returned as LINE#ID:content so later edit calls can target exact lines and fail safely if the file changed since it was read. Images are handled like the built-in read tool.",
		promptSnippet: "Read file contents with LINE#ID hash anchors",
		promptGuidelines: [
			"Use read to examine files instead of cat or sed.",
			"Hashline read prefixes each text line as LINE#ID:content. Copy LINE#ID anchors exactly when using edit.",
			"If a hashline edit fails because anchors changed, re-read the file and retry with the updated LINE#ID values.",
		],
		parameters: readSchema,
		async execute(toolCallId, params, signal, _onUpdate, ctx) {
			const path = normalizePath(params.path);
			const absolutePath = resolvePath(ctx.cwd, path);

			if (isImagePath(path)) {
				const imageRead = createReadTool(ctx.cwd);
				return imageRead.execute(toolCallId, { ...params, path }, signal);
			}

			if (signal?.aborted) throw new Error("Operation aborted");
			await access(absolutePath);
			const raw = await readFile(absolutePath, "utf8");
			if (signal?.aborted) throw new Error("Operation aborted");

			const preview = buildHashlinePreview(raw, { offset: params.offset, limit: params.limit });
			const truncation = truncateHead(preview.anchored, {
				maxLines: DEFAULT_MAX_LINES,
				maxBytes: DEFAULT_MAX_BYTES,
			});

			const result: { content: Array<{ type: "text"; text: string }>; details?: ReadToolDetails } = {
				content: [{ type: "text", text: truncation.content }],
			};
			if (truncation.truncated) {
				result.details = { truncation };
			}
			return result;
		},
	});

	pi.registerTool({
		name: "find",
		label: "find",
		description:
			"Find files in a directory and show the full first-level LSP outline for each matching text file with hashline prefixes. Falls back to a hashline preview of lines 1-20 only when the file has no LSP outline.",
		promptSnippet: "Prefer this find tool over bash find when inspecting code directories",
		promptGuidelines: [
			"Prefer this find tool over bash find when the user wants to inspect files in a code directory.",
			"Use pattern to filter files, for example *.ts or src/**/*.rs.",
			"This tool always shows the full first-level LSP outline for the whole file when available, with hashline-prefixed source lines.",
			"If there is no outline, it falls back to hashline preview lines 1-20.",
		],
		parameters: findSchema,
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const searchPath = normalizePath(params.path ?? ".");
			const absolutePath = resolvePath(ctx.cwd, searchPath);
			const displayRoot = searchPath.replace(/[\\/]+$/g, "") || ".";
			const pattern = (params.pattern ?? "**").trim() || "**";
			const fileLimit = params["max-file-count"] ?? 200;
			if (signal?.aborted) throw new Error("Operation aborted");
			await access(absolutePath);

			let absoluteFiles: string[];
			try {
				absoluteFiles = await collectDirectoryFiles(absolutePath);
			} catch (error: any) {
				if (error?.code === "ENOTDIR") throw new Error(`Path is not a directory: ${searchPath}`);
				throw error;
			}

			const matchedFiles = absoluteFiles
				.map((absoluteFile) => ({
					absolute: absoluteFile,
					display: toDisplayPath(absolutePath, displayRoot, absoluteFile),
					relative: toMatchPath(absolutePath, absoluteFile),
				}))
				.filter((file) => matchesPattern(file.display, file.relative, pattern))
				.sort((a, b) => a.display.localeCompare(b.display));

			const files = matchedFiles.slice(0, fileLimit);
			const sections: string[] = [`--- ${displayRoot} files ---`, ...files.map((file) => `   ${file.display}`)];

			for (const file of files) {
				if (signal?.aborted) throw new Error("Operation aborted");
				const buffer = await readFile(file.absolute);
				sections.push("");

				if (!isProbablyTextBuffer(buffer, file.display)) {
					sections.push(`   --- ${file.display} ---`);
					sections.push("   [binary or image file skipped]");
					continue;
				}

				let outline: OutlineEntry[] = [];
				try {
					outline = await requestOutline(pi, file.absolute);
				} catch {
					outline = [];
				}

				const preview = buildOutlineHashPreview(buffer.toString("utf8"), outline);
				const fallbackStartLine = FIND_FALLBACK_PREVIEW_START;
				const fallbackEndLine = preview.totalFileLines > 0
					? Math.min(preview.totalFileLines, fallbackStartLine + FIND_FALLBACK_PREVIEW_LIMIT - 1)
					: 0;
				const headerLabel = preview.usedOutline
					? "lsp outline"
					: preview.totalFileLines > 0
						? `lines ${fallbackStartLine}-${fallbackEndLine}${preview.totalFileLines > fallbackEndLine ? ` of ${preview.totalFileLines}` : ""}; fallback preview`
						: "empty file";
				sections.push(`   --- ${file.display} (${headerLabel}) ---`);
				if (preview.lines.length === 0) {
					sections.push("   [empty file]");
					continue;
				}
				for (const line of preview.lines) sections.push(`   ${line}`);
			}

			const combined = sections.join("\n");
			const truncation = truncateHead(combined, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
			return {
				content: [{ type: "text" as const, text: truncation.content }],
				details: {
					fileCount: files.length,
					matchedCount: matchedFiles.length,
					pattern,
					...(matchedFiles.length > fileLimit ? { resultLimitReached: matchedFiles.length } : {}),
					...(truncation.truncated ? { truncation } : {}),
				},
			};
		},
		renderCall(args, theme) {
			const pathValue = String((args as any)?.path ?? ".");
			const pattern = String((args as any)?.pattern ?? "**");
			let text = theme.fg("toolTitle", theme.bold("find "));
			text += theme.fg("accent", pathValue);
			text += theme.fg("dim", ` -name ${pattern}`);
			return new Text(text, 0, 0);
		},
		renderResult(result, { expanded, isPartial }, theme, context) {
			if (isPartial) return new Text(theme.fg("warning", "Finding files..."), 0, 0);
			const content = result.content[0];
			const details = (result.details ?? {}) as {
				fileCount?: number;
				matchedCount?: number;
				pattern?: string;
				resultLimitReached?: number;
				truncation?: { truncated: boolean; totalLines?: number };
			};
			if (context.isError || (content?.type === "text" && /^error/i.test(content.text))) {
				const fullMessage = content?.type === "text" ? content.text : "find failed";
				const lines = fullMessage.split("\n");
				const previewLimit = expanded ? 40 : 12;
				let text = theme.fg("error", lines[0] ?? "find failed");
				for (const line of lines.slice(1, previewLimit)) text += `\n${theme.fg("dim", line)}`;
				if (lines.length > previewLimit) text += `\n${theme.fg("muted", expanded ? "... more error lines" : "... more error lines")}`;
				return new Text(text, 0, 0);
			}
			const outputLines = content?.type === "text" ? content.text.split("\n") : [];
			const visibleLineCount = expanded ? 80 : 12;
			let text = theme.fg("success", `${details.fileCount ?? 0} files`);
			if ((details.matchedCount ?? 0) > (details.fileCount ?? 0)) text += theme.fg("warning", ` of ${details.matchedCount}`);
			text += theme.fg("dim", ` · ${details.pattern ?? "**"}`);
			if (details.truncation?.truncated) text += theme.fg("warning", " [truncated]");
			for (const line of outputLines.slice(0, visibleLineCount)) {
				text += `\n${theme.fg("dim", line)}`;
			}
			if (outputLines.length > visibleLineCount) {
				text += `\n${theme.fg("muted", expanded ? "... more output lines" : "... more output lines")}`;
			}
			return new Text(text, 0, 0);
		},
	});

	pi.registerTool({
		name: "edit",
		label: "edit",
		description:
			"Edit a single file using LINE#ID anchors from the latest read output. Supported loc shapes: \"append\", \"prepend\", { append: \"LINE#ID\" }, { prepend: \"LINE#ID\" }, or { range: { pos: \"LINE#ID\", end: \"LINE#ID\" } }. If the referenced line hashes changed since the file was read, the edit is rejected before mutation.",
		promptSnippet: "Edit files using LINE#ID hash anchors from the latest read output",
		promptGuidelines: [
			"Always read a file before editing it so you have fresh LINE#ID anchors.",
			"Batch all edits for one file into a single edit call.",
			"Copy LINE#ID anchors exactly from the latest read output.",
			"Use only hashline edit blocks shaped like { loc, content }.",
			"If edit reports that anchors changed, re-read the file and retry with the updated LINE#ID values.",
		],
		parameters: editSchema,
		async execute(toolCallId, params, signal, _onUpdate, ctx) {
			const path = normalizePath((params as any).path);
			const edits = Array.isArray((params as any).edits) ? ((params as any).edits as unknown[]) : [];
			if (edits.length === 0) {
				throw new Error("edit requires at least one edit block.");
			}

			const absolutePath = resolvePath(ctx.cwd, path);

			return withFileMutationQueue(absolutePath, async () => {
				if (signal?.aborted) throw new Error("Operation aborted");

				let raw = "";
				let existed = true;
				try {
					await access(absolutePath);
					raw = await readFile(absolutePath, "utf8");
				} catch {
					existed = false;
				}

				if (signal?.aborted) throw new Error("Operation aborted");

				const { bom, text: bomStripped } = stripBom(raw);
				const originalLineEnding = detectLineEnding(bomStripped);
				const normalizedOriginal = normalizeToLF(bomStripped);
				const originalLines = existed ? textToLines(normalizedOriginal) : [];

				if (!existed) {
					for (const edit of edits) {
						const loc = (edit as any)?.loc;
						if (loc !== "append" && loc !== "prepend") {
							throw new Error(`File not found: ${path}. New files can only be created with anchorless \"append\" or \"prepend\" edits.`);
						}
					}
				}

				const operations = parseHashlineOperations(edits, originalLines);
				const nextLines = applyOperations(originalLines, operations);
				const normalizedNext = nextLines.join("\n");

				if (normalizedNext === normalizedOriginal) {
					throw new Error("The hashline edit produced no changes.");
				}

				const diff = buildUnifiedDiff(originalLines, operations);
				const overviewLines = buildEditOverview(nextLines, operations);
				const finalContent = bom + restoreLineEndings(normalizedNext, originalLineEnding);
				await mkdir(dirname(absolutePath), { recursive: true });
				await writeFile(absolutePath, finalContent, "utf8");
				if (signal?.aborted) throw new Error("Operation aborted");

				return {
					content: [
						{
							type: "text" as const,
							text: `Successfully applied ${operations.length} hashline edit block(s) to ${path}.`,
						},
					],
					details: { diff: diff.diff, firstChangedLine: diff.firstChangedLine, overviewLines } as EditToolDetails & { overviewLines: string[] },
				};
			});
		},
		renderCall(args, theme) {
			const editCount = Array.isArray((args as any)?.edits) ? (args as any).edits.length : 0;
			let text = theme.fg("toolTitle", theme.bold("edit "));
			text += theme.fg("accent", String((args as any)?.path ?? ""));
			text += theme.fg("dim", ` (${editCount} block${editCount === 1 ? "" : "s"}, hashline)`);
			return new Text(text, 0, 0);
		},
		renderResult(result, { expanded, isPartial }, theme, context) {
			if (isPartial) return new Text(theme.fg("warning", "Editing..."), 0, 0);
			const details = result.details as (EditToolDetails & { overviewLines?: string[] }) | undefined;
			const content = result.content[0];
			if (context.isError || (content?.type === "text" && /^error/i.test(content.text))) {
				const fullMessage = content?.type === "text" ? content.text : "Edit failed";
				const lines = fullMessage.split("\n");
				const previewLimit = expanded ? 40 : 12;
				let text = theme.fg("error", lines[0] ?? "Edit failed");
				for (const line of lines.slice(1, previewLimit)) {
					if (line.startsWith(">>>")) text += `\n${theme.fg("warning", line)}`;
					else text += `\n${theme.fg("dim", line)}`;
				}
				if (lines.length > previewLimit) {
					text += `\n${theme.fg("muted", expanded ? "... more error lines" : "... ctrl+e for full mismatch preview")}`;
				}
				return new Text(text, 0, 0);
			}
			if (!details?.diff) {
				return new Text(theme.fg("success", "Applied"), 0, 0);
			}
			const { additions, removals } = countDiffLines(details.diff);
			const overviewLines = details.overviewLines ?? [];
			const visibleLineCount = expanded ? 24 : 8;
			let text = theme.fg("success", `+${additions}`);
			text += theme.fg("dim", " / ");
			text += theme.fg("error", `-${removals}`);
			for (const line of overviewLines.slice(0, visibleLineCount)) {
				text += `\n${theme.fg("dim", line)}`;
			}
			if (overviewLines.length > visibleLineCount) {
				const remaining = overviewLines.length - visibleLineCount;
				text += `\n${theme.fg("muted", `... ${remaining} more edited line${remaining === 1 ? "" : "s"}`)}`;
			}
			return new Text(text, 0, 0);
		},
	});

	pi.registerTool({
		name: "write",
		label: "write",
		description:
			"Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Automatically creates parent directories. If the content accidentally includes copied LINE#ID: prefixes from hashline reads, they are stripped before writing.",
		promptSnippet: "Create or overwrite files",
		promptGuidelines: [
			"Use write only for new files or complete rewrites.",
			"If writing content copied from hashline read output, LINE#ID prefixes are stripped automatically.",
		],
		parameters: writeSchema,
		async execute(toolCallId, params, signal, _onUpdate, ctx) {
			const writeTool = createWriteTool(ctx.cwd);
			return writeTool.execute(toolCallId, {
				path: normalizePath(params.path),
				content: stripHashlinePrefixesFromText(params.content),
			}, signal);
		},
	});
}
