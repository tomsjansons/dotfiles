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

- `write`
  - behaves like pi's built-in write tool
  - strips accidental `LINE#ID:` prefixes if copied from hashline `read` output

## Activation

This extension lives in `~/.pi/agent/extensions/hashline-tools/index.ts`, so pi auto-discovers it.

Reload pi resources after changes:

```text
/reload
```

Because the tools are registered with the same names (`read`, `edit`, `write`), they override the standard pi tools.
