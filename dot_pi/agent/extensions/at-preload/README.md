# at-preload

Pi extension that detects `@path` mentions in the user's prompt and preloads them before the turn starts.

## What it does

- `@file`
  - preloads lines `1-200`
  - formats them with `LINE#ID:content` hash markers
  - injects the preload into hidden model context before the turn starts

- `@directory`
  - preloads an ordered recursive path list
  - uses plain paths without hash prefixes
  - injects that listing into hidden model context before the turn starts

- UI
  - shows a visible summary message in the conversation with a preview for each preload
  - clears any preload widget/status indicator instead of showing one above the cwd area

## Mention syntax

Supported forms:

- `@src/index.ts`
- `@./src/index.ts`
- `@../package.json`
- `@/absolute/path`
- `@~`
- `@~/path/from/home`
- `@"path with spaces/file.ts"`
- `@'path with spaces/dir'`
- backtick-quoted paths are also supported, for example: `@` followed by `` `path with spaces/file.ts` ``

Notes about parsing:

- Bare mentions have trailing `),.;:!?` stripped.
- Duplicate mentions in the same prompt are deduplicated before preload.

## Notes

- File preloads are limited to the first `200` lines.
- Directory preloads load structure only, not file contents.
- Directory listings are plain ordered paths, not visual trees.
- Directory listings recurse, respect `.gitignore`, `.ignore`, and `.piignore`, and show symlinks as `path@ -> target`.
- Directory listings also apply default ignores for `.git/`, `.jj/`, `.svn/`, and `node_modules/`.
- Binary and image files are detected and skipped as text preloads.
- Missing or unsupported paths are shown as warnings in the summary.
- Directly mentioning a symlink path is currently unsupported; only regular files and directories are preloaded.
- The visible summary message is filtered out of model context.
- Only the latest hidden preload context message is kept in context.

## Reload

After editing the extension, run:

```text
/reload
```