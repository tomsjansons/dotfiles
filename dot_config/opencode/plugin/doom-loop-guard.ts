import type { Plugin } from "@opencode-ai/plugin";

const DOOM_LOOP_THRESHOLD = 5;
const LOOP_WINDOW = 1024;
const MIN_REPEAT_LENGTH = 200;
const MIN_REPEAT_COUNT = 3;

const BREAKOUT_MESSAGE =
  "STOP. You are repeating the same content over and over. Take a different approach to solve this problem.";

const hashSnippet = (value: string): number => {
  let acc = 0;
  for (let i = 0; i < value.length; i++) {
    acc = (acc * 31 + value.charCodeAt(i)) >>> 0;
  }
  return acc;
};

const trimWindow = (value: string): string => value.trim().slice(-LOOP_WINDOW);

const snippetMatches = (
  value: string,
  snippet: string,
  signature: number,
): boolean => {
  const candidate = trimWindow(value);
  return hashSnippet(candidate) === signature && candidate === snippet;
};

const detectRepeatSnippet = (
  values: string[],
  current: string,
  threshold = DOOM_LOOP_THRESHOLD,
): string | undefined => {
  if (values.length < threshold) return undefined;
  const snippet = trimWindow(current);
  const signature = hashSnippet(snippet);
  if (
    values
      .slice(-threshold)
      .every((value) => snippetMatches(value, snippet, signature))
  ) {
    return snippet;
  }
  return undefined;
};

const detectSelfRepeating = (
  text: string,
  minLength = MIN_REPEAT_LENGTH,
  minCount = MIN_REPEAT_COUNT,
): string | undefined => {
  const trimmed = text.trim();
  if (trimmed.length < minLength * minCount) return undefined;

  for (let len = Math.floor(trimmed.length / minCount); len >= minLength; len -= 50) {
    const chunk = trimmed.slice(0, len);
    if (chunk.trim().length < minLength) continue;

    const signature = hashSnippet(chunk);
    let count = 0;
    for (let i = 0; i <= trimmed.length - len; i += len) {
      const candidate = trimmed.slice(i, i + len);
      if (hashSnippet(candidate) === signature && candidate === chunk) {
        count++;
      }
    }

    if (count >= minCount) {
      return chunk.slice(0, 200);
    }
  }

  return undefined;
};

type HistoryTracker = {
  history: string[];
  triggered: boolean;
};

const createHistoryTracker = (): HistoryTracker => ({
  history: [],
  triggered: false,
});

const appendHistory = (tracker: HistoryTracker, value: string): void => {
  tracker.history.push(value);
  const maxLength = DOOM_LOOP_THRESHOLD * 2;
  if (tracker.history.length > maxLength) {
    tracker.history.shift();
  }
};

export const DoomLoopGuard: Plugin = async ({ client }) => {
  const sessionState = new Map<
    string,
    {
      reasoning: HistoryTracker;
      text: HistoryTracker;
      tool: HistoryTracker;
    }
  >();

  const getOrCreateSession = (sessionId: string) => {
    let state = sessionState.get(sessionId);
    if (!state) {
      state = {
        reasoning: createHistoryTracker(),
        text: createHistoryTracker(),
        tool: createHistoryTracker(),
      };
      sessionState.set(sessionId, state);
    }
    return state;
  };

  const breakLoop = async (
    sessionId: string,
    type: "reasoning" | "text" | "tool",
    snippet: string,
  ) => {
    const state = getOrCreateSession(sessionId);
    if (state[type].triggered) return;
    state[type].triggered = true;

    await client.app.log({
      body: {
        service: "doom-loop-guard",
        level: "warn",
        message: `Doom loop detected in ${type}`,
        extra: { snippet: snippet.slice(0, 100) },
      },
    });

    await client.session.abort({ path: { id: sessionId } });

    await client.session.prompt({
      path: { id: sessionId },
      body: {
        noReply: false,
        parts: [{ type: "text", text: BREAKOUT_MESSAGE }],
      },
    });

    await client.tui.showToast({
      body: {
        message: `Doom loop detected in ${type}. Injecting break-out message.`,
        variant: "warning",
      },
    });
  };

  return {
    "message.part.updated": async (input, output) => {
      const sessionId = output.part.sessionID;
      if (!sessionId) return;

      const state = getOrCreateSession(sessionId);
      const part = output.part;

      if (part.type === "reasoning") {
        appendHistory(state.reasoning, part.text);
        const snippet = detectRepeatSnippet(state.reasoning.history, part.text);
        if (snippet && !state.reasoning.triggered) {
          await breakLoop(sessionId, "reasoning", snippet);
        } else {
          const selfRepeat = detectSelfRepeating(part.text);
          if (selfRepeat && !state.reasoning.triggered) {
            await breakLoop(sessionId, "reasoning", selfRepeat);
          }
        }
      }

      if (part.type === "text") {
        appendHistory(state.text, part.text);
        const snippet = detectRepeatSnippet(state.text.history, part.text);
        if (snippet && !state.text.triggered) {
          await breakLoop(sessionId, "text", snippet);
        } else {
          const selfRepeat = detectSelfRepeating(part.text);
          if (selfRepeat && !state.text.triggered) {
            await breakLoop(sessionId, "text", selfRepeat);
          }
        }
      }
    },

    "tool.execute.before": async (input, output) => {
      const sessionId = input.sessionID;
      if (!sessionId) return;

      const state = getOrCreateSession(sessionId);
      const toolKey = `${input.tool}:${JSON.stringify(output.args)}`;
      appendHistory(state.tool, toolKey);
      const snippet = detectRepeatSnippet(state.tool.history, toolKey);
      if (snippet && !state.tool.triggered) {
        await breakLoop(sessionId, "tool", snippet);
        throw new Error("Doom loop detected - blocking repeated tool call");
      }
    },

    "session.idle": async (input, output) => {
      const sessionId = output.session.id;
      if (sessionId) {
        sessionState.delete(sessionId);
      }
    },

    "session.deleted": async (input, output) => {
      const sessionId = output.session.id;
      if (sessionId) {
        sessionState.delete(sessionId);
      }
    },
  };
};

export default DoomLoopGuard;
