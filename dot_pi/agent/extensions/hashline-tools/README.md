# hashline-tools

Pi extension that replaces the built-in `read`, `edit`, and `write` tools with a hashline workflow inspired by oh-my-pi.

## What it does

- `read`
  - returns text files as `LINE#ID:content`
  - preserves `offset` / `limit`
  - truncates output with pi's standard limits
  - delegates image reads to pi's built-in image-capable read tool

- `edit`
  - expects hashline edits using anchors copied from the latest `read`
  - supports:
    - `"append"`
    - `"prepend"`
    - `{ append: "LINE#ID" }`
    - `{ prepend: "LINE#ID" }`
    - `{ range: { pos: "LINE#ID", end: "LINE#ID" } }`
  - hard cutover: only `{ loc, content }` hashline edit blocks are accepted
  - rejects stale edits if anchored lines changed since the file was read
  - applies edits bottom-up
  - preserves BOM and original line endings

- `find`
  - finds files in a directory recursively
  - supports a glob-style `pattern` filter
  - emits a sorted file list plus per-file first-level LSP outline previews with hashline prefixes
  - falls back to a short hashline preview when no outline is available
  - uses `max-file-count`, `preview-offset`, and `preview-limit` to control output

- `write`
  - behaves like pi's built-in write tool
  - strips accidental `LINE#ID:` prefixes if copied from hashline `read` output
## Activation

This extension lives in `~/.pi/agent/extensions/hashline-tools/index.ts`, so pi auto-discovers it.

Reload pi resources after changes:

```text
/reload
```


The extension also adds a `find` tool for multi-file directory inspection with LSP outlines.
