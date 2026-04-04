import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createWriteTool } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

import { normalizePath, stripHashlinePrefixesFromText } from "./hashline.ts";

const writeSchema = Type.Object({
	path: Type.String({ description: "Path to the file to write (relative or absolute)" }),
	content: Type.String({ description: "Content to write to the file" }),
});

export function registerWriteTool(pi: ExtensionAPI): void {
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
			return writeTool.execute(
				toolCallId,
				{
					path: normalizePath(params.path),
					content: stripHashlinePrefixesFromText(params.content),
				},
				signal,
			);
		},
	});
}
