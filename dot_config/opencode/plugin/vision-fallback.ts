import type { Plugin } from "@opencode-ai/plugin";
import type { Message, Part, FilePart, TextPart } from "@opencode-ai/sdk";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const PLUGIN_NAME = "vision-fallback";
const TEMP_DIR_NAME = "opencode-vision-temp";

const INTERCEPT_MODELS: readonly string[] = ["openrouter/z-ai/glm-5"];

const VISION_TOOL_NAME = "vision_analyzer";

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

const SUPPORTED_MIMES = new Set([
  ...SUPPORTED_IMAGE_MIMES,
  ...SUPPORTED_VIDEO_MIMES,
]);

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-msvideo": "avi",
};

interface SavedMedia {
  path: string;
  mime: string;
  partId: string;
}

interface ModelInfo {
  providerID: string;
  modelID: string;
}

type Logger = (msg: string) => void;

function modelMatchesExact(model: ModelInfo | undefined): boolean {
  if (!model) return false;
  const modelKey = `${model.providerID}/${model.modelID}`.toLowerCase();
  return INTERCEPT_MODELS.some((pattern) => pattern.toLowerCase() === modelKey);
}

function isMediaFilePart(part: Part): part is FilePart {
  if (part.type !== "file") return false;
  const mime = (part as FilePart).mime?.toLowerCase() ?? "";
  return SUPPORTED_MIMES.has(mime);
}

function isTextPart(part: Part): part is TextPart {
  return part.type === "text";
}

function handleFileUrl(
  url: string,
  filePart: FilePart,
  log: Logger,
): SavedMedia | null {
  const localPath = url.replace("file://", "");
  log(`Media already on disk: ${localPath}`);
  return { path: localPath, mime: filePart.mime, partId: filePart.id };
}

function parseBase64DataUrl(
  dataUrl: string,
): { mime: string; data: Buffer } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;

  try {
    return { mime: match[1], data: Buffer.from(match[2], "base64") };
  } catch {
    return null;
  }
}

async function ensureTempDir(): Promise<string> {
  const dir = join(tmpdir(), TEMP_DIR_NAME);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function saveMediaToTemp(data: Buffer, mime: string): Promise<string> {
  const tempDir = await ensureTempDir();
  const ext = MIME_TO_EXTENSION[mime.toLowerCase()] ?? "bin";
  const filename = `${randomUUID()}.${ext}`;
  const filepath = join(tempDir, filename);
  await writeFile(filepath, data);
  return filepath;
}

async function handleDataUrl(
  url: string,
  filePart: FilePart,
  log: Logger,
): Promise<SavedMedia | null> {
  const parsed = parseBase64DataUrl(url);
  if (!parsed) {
    log(`Failed to parse data URL for part ${filePart.id}`);
    return null;
  }

  try {
    const savedPath = await saveMediaToTemp(parsed.data, parsed.mime);
    log(`Saved media to: ${savedPath}`);
    return { path: savedPath, mime: parsed.mime, partId: filePart.id };
  } catch (err) {
    log(`Failed to save media: ${err}`);
    return null;
  }
}

function handleHttpUrl(
  url: string,
  filePart: FilePart,
  log: Logger,
): SavedMedia {
  log(`Media is remote URL: ${url}`);
  return { path: url, mime: filePart.mime, partId: filePart.id };
}

async function processMediaPart(
  filePart: FilePart,
  log: Logger,
): Promise<SavedMedia | null> {
  const url = filePart.url;

  if (!url) {
    log(`Skipping media part ${filePart.id}: no URL`);
    return null;
  }

  if (url.startsWith("file://")) {
    return handleFileUrl(url, filePart, log);
  }

  if (url.startsWith("data:")) {
    return handleDataUrl(url, filePart, log);
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return handleHttpUrl(url, filePart, log);
  }

  log(
    `Unsupported URL scheme for part ${filePart.id}: ${url.substring(0, 50)}...`,
  );
  return null;
}

async function extractMediaFromParts(
  parts: Part[],
  log: Logger,
): Promise<SavedMedia[]> {
  const savedMedia: SavedMedia[] = [];

  for (const part of parts) {
    if (!isMediaFilePart(part)) continue;

    const result = await processMediaPart(part as FilePart, log);
    if (result) {
      savedMedia.push(result);
    }
  }

  return savedMedia;
}

function generateInjectionPrompt(
  media: SavedMedia[],
  userText: string,
  toolName: string,
): string {
  if (media.length === 0) return userText;

  const isSingle = media.length === 1;
  const mediaList = media
    .map((m, idx) => {
      const type = m.mime.startsWith("video") ? "Video" : "Image";
      return `- ${type} ${idx + 1}: ${m.path} (MIME: ${m.mime})`;
    })
    .join("\n");

  const mediaCountText = isSingle
    ? "a media file"
    : `${media.length} media files`;

  return `The user has shared ${mediaCountText}. The files are saved at:
${mediaList}

Use the \`${toolName}\` tool to analyze each media file. Call the tool once per file, passing the file path and the MIME type.

User's request: ${userText || "(analyze the media)"}`;
}

function findLastUserMessage(
  messages: Array<{ info: Message; parts: Part[] }>,
): { message: { info: Message; parts: Part[] }; index: number } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].info.role === "user") {
      return { message: messages[i], index: i };
    }
  }
  return null;
}

function getModelFromMessage(message: {
  info: Message;
}): ModelInfo | undefined {
  const info = message.info as { model?: ModelInfo };
  return info.model;
}

function removeProcessedMediaParts(
  parts: Part[],
  processedIds: Set<string>,
): Part[] {
  return parts.filter(
    (part) => !(part.type === "file" && processedIds.has(part.id)),
  );
}

function updateOrCreateTextPart(
  message: { info: Message; parts: Part[] },
  newText: string,
): void {
  const textPartIndex = message.parts.findIndex(isTextPart);

  if (textPartIndex !== -1) {
    (message.parts[textPartIndex] as TextPart).text = newText;
  } else {
    const newTextPart: TextPart = {
      id: `transformed-${randomUUID()}`,
      sessionID: message.info.sessionID,
      messageID: message.info.id,
      type: "text",
      text: newText,
      synthetic: true,
    };
    message.parts.unshift(newTextPart);
  }
}

export const VisionFallbackPlugin: Plugin = async (input) => {
  const { client, directory } = input;

  const log: Logger = (msg) => {
    client.app
      .log({
        body: { service: PLUGIN_NAME, level: "info", message: msg },
      })
      .catch(() => {});
  };

  log(
    `Plugin initialized. Intercepting models: ${INTERCEPT_MODELS.join(", ")}`,
  );

  return {
    "experimental.chat.messages.transform": async (_input, output) => {
      const { messages } = output;

      const result = findLastUserMessage(messages);
      if (!result) return;

      const { message: lastUserMessage, index: lastUserIndex } = result;

      const model = getModelFromMessage(lastUserMessage);
      if (!modelMatchesExact(model)) return;

      log(
        `Model ${model?.providerID}/${model?.modelID} matched, checking for media...`,
      );

      const hasMedia = lastUserMessage.parts.some(isMediaFilePart);
      if (!hasMedia) return;

      log("Found media in message, processing...");

      const savedMedia = await extractMediaFromParts(
        lastUserMessage.parts,
        log,
      );
      if (savedMedia.length === 0) {
        log("No media files were successfully saved");
        return;
      }

      log(`Saved ${savedMedia.length} media file(s), transforming message...`);

      const existingTextPart = lastUserMessage.parts.find(isTextPart);
      const userText = existingTextPart?.text ?? "";

      const transformedText = generateInjectionPrompt(
        savedMedia,
        userText,
        VISION_TOOL_NAME,
      );

      const processedIds = new Set(savedMedia.map((m) => m.partId));
      lastUserMessage.parts = removeProcessedMediaParts(
        lastUserMessage.parts,
        processedIds,
      );

      updateOrCreateTextPart(lastUserMessage, transformedText);
      messages[lastUserIndex] = lastUserMessage;

      log("Successfully injected media path instructions");
    },
  };
};

export default VisionFallbackPlugin;
