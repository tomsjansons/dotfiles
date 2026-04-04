import { access, readFile } from "node:fs/promises";

import type { AgentToolResult, ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	createReadTool,
	truncateHead,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

import { buildHashlinePreview, isImagePath, normalizePath, resolvePath } from "./hashline.ts";

const readSchema = Type.Object({
	path: Type.String({ description: "Path to the file to read (relative or absolute)" }),
	offset: Type.Optional(Type.Number({ description: "Line number to start reading from (1-indexed)" })),
	limit: Type.Optional(Type.Number({ description: "Maximum number of lines to read" })),
});

export function registerReadTool(pi: ExtensionAPI): void {
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

			const result: AgentToolResult<{ truncation?: typeof truncation }> = {
				content: [{ type: "text", text: truncation.content }],
				details: truncation.truncated ? { truncation } : {},
			};
			return result;
		},
	});
}
