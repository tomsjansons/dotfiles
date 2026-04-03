# at-preload

Pi extension that preloads `@path` mentions from prompts.

## What it does

- `@file`
  - preloads lines `1-200`
  - formats them with `LINE#ID:content` hash markers
  - injects the preload into the model context before the turn starts

- `@directory`
  - preloads an ordered recursive path list
  - uses plain paths without hash prefixes
  - injects that listing into the model context before the turn starts

- UI
  - shows a visible summary message in the conversation with a 10-line preview per preload
  - shows a widget below the editor with the preloaded refs
  - does not use a footer status entry

## Mention syntax

Supported forms:

- `@src/index.ts`
- `@./src/index.ts`
- `@../package.json`
- `@/absolute/path`
- `@"path with spaces/file.ts"`
- `@'path with spaces/dir'`

## Notes

- File preloads are limited to the first `200` lines.
- Directory preloads load structure only, not file contents.
- Directory listings are plain ordered paths, not visual trees.
- Binary and image files are detected and skipped as text preloads.
- The visible summary message is filtered out of model context.
- Only the latest hidden preload context message is kept in context.

## Reload

After editing the extension, run:

```text
/reload
```
