import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";

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

const HASH_ALPHABET = "ZPMQVRWSNKTXJBYH";
const SIGNIFICANT_RE = /[A-Za-z0-9]/;
const HASHLINE_RE = /^\s*(\d+)\s*#\s*([ZPMQVRWSNKTXJBYH]{2})/;
const HASHLINE_PREFIX_RE = new RegExp(`^\\s*\\d+\\s*#\\s*[${HASH_ALPHABET}]{2}\\s*:`);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

const readSchema = Type.Object({
	path: Type.String({ description: "Path to the file to read (relative or absolute)" }),
	offset: Type.Optional(Type.Number({ description: "Line number to start reading from (1-indexed)" })),
	limit: Type.Optional(Type.Number({ description: "Maximum number of lines to read" })),
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

function resolvePath(cwd: string, path: string): string {
	return resolve(cwd, normalizePath(path));
}

function isImagePath(path: string): boolean {
	return IMAGE_EXTENSIONS.has(extname(path).toLowerCase());
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

function prefixHashLines(lines: string[], startLineNumber: number): string {
	return lines.map((line, index) => formatHashLine(startLineNumber + index, line)).join("\n");
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

			const text = normalizeToLF(raw);
			const allLines = textToLines(text);
			const totalFileLines = allLines.length;
			const startIndex = params.offset ? Math.max(0, params.offset - 1) : 0;
			if (startIndex > allLines.length - 1 && !(allLines.length === 0 && startIndex === 0)) {
				throw new Error(`Offset ${params.offset} is beyond end of file (${totalFileLines} lines total)`);
			}

			const endIndex = params.limit ? startIndex + Math.max(0, params.limit) : allLines.length;
			const selectedLines = allLines.slice(startIndex, endIndex).map((line) => line.replace(/\r$/, ""));
			const anchored = prefixHashLines(selectedLines, startIndex + 1);
			const truncation = truncateHead(anchored, {
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
					details: { diff: diff.diff, firstChangedLine: diff.firstChangedLine } satisfies EditToolDetails,
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
			const details = result.details as EditToolDetails | undefined;
			const content = result.content[0];
			if (context.isError || (content?.type === "text" && /^error/i.test(content.text))) {
				const message = content?.type === "text" ? content.text.split("\n")[0] : "Edit failed";
				return new Text(theme.fg("error", message), 0, 0);
			}
			if (!details?.diff) {
				return new Text(theme.fg("success", "Applied"), 0, 0);
			}
			const { additions, removals } = countDiffLines(details.diff);
			let text = theme.fg("success", `+${additions}`);
			text += theme.fg("dim", " / ");
			text += theme.fg("error", `-${removals}`);
			if (expanded) {
				const lines = details.diff.split("\n").slice(0, 40);
				for (const line of lines) {
					if (line.startsWith("+") && !line.startsWith("+++")) text += `\n${theme.fg("success", line)}`;
					else if (line.startsWith("-") && !line.startsWith("---")) text += `\n${theme.fg("error", line)}`;
					else text += `\n${theme.fg("dim", line)}`;
				}
				if (details.diff.split("\n").length > 40) {
					text += `\n${theme.fg("muted", "... more diff lines")}`;
				}
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
