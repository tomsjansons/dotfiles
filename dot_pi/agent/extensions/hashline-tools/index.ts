import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { registerEditTool } from "./edit-tool.ts";
import { registerFindTool } from "./find-tool.ts";
export {
	buildHashlinePreview,
	computeLineHash,
	normalizeHashlinePath,
	prefixHashLines,
	resolveHashlinePath,
	stripHashlinePrefix,
	stripHashlinePrefixesFromText,
} from "./hashline.ts";
import { registerReadTool } from "./read-tool.ts";
import { registerWriteTool } from "./write-tool.ts";

export default function hashlineTools(pi: ExtensionAPI): void {
	registerReadTool(pi);
	registerFindTool(pi);
	registerEditTool(pi);
	registerWriteTool(pi);
}
