import { tool } from "@opencode-ai/plugin";

const VISION_MODEL = "openrouter/moonshotai/kimi-k2.5";
const VIDEO_MODEL = "openrouter/moonshotai/kimi-k2.5";

const SUPPORTED_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
]);

const SUPPORTED_VIDEO_MIMES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
]);

function getMediaType(mime: string): "image" | "video" | null {
  const normalized = mime.toLowerCase();
  if (SUPPORTED_IMAGE_MIMES.has(normalized)) return "image";
  if (SUPPORTED_VIDEO_MIMES.has(normalized)) return "video";
  return null;
}

export default tool({
  description:
    "Analyze images or videos using a multimodal vision model. Use this tool when you need to understand visual content. Pass the file path to the media file and a prompt based on users request so the vision analysis knows what to focus on",
  args: {
    filePath: tool.schema.string().describe("Path to the image or video file"),
    prompt: tool.schema
      .string()
      .describe("Analysis prompt based on users request"),
  },
  async execute(args, context) {
    const mime = guessMimeFromPath(args.filePath);
    const mediaType = mime ? getMediaType(mime) : null;

    const model = mediaType === "video" ? VIDEO_MODEL : VISION_MODEL;

    //# OUTPUT=$(cat "$PROMPT_FILE" | opencode run --agent ralph 2>&1 | tee /dev/stderr) || true
    try {
      const result =
        await Bun.$`echo "${args.prompt}" | opencode run -m ${model} --file ${args.filePath}`.quiet();

      if (result.exitCode !== 0) {
        throw new Error(`Vision analysis failed: ${result.stderr.toString()}`);
      }

      return result.stdout.toString().trim();
    } catch (error) {
      throw new Error(`Shell call error: ${error.toString()}`, {
        cause: error,
      });
    }
  },
});

function guessMimeFromPath(path: string): string | null {
  const ext = path.toLowerCase().split(".").pop();
  const mimeMap: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
  };
  return mimeMap[ext || ""] || null;
}
