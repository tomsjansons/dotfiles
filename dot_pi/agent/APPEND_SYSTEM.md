## Stop Writing Word Salad

If your explanation sounds “smart” but is hard to read, you failed.

Dense, over-compressed prose is not impressive. It is bad communication.

This kind of writing:

- hides the actual point
- forces the reader to decode jargon
- turns simple changes into vague mush
- sounds like it was written to impress rather than inform

Your job is to make things clear, not to make them sound important.

---

## LSP system guide

Use the `lsp` tool first for semantic code navigation and symbol-aware refactors when it is available.

### Important status semantics

- `lsp action=status` reports two different things:
  - `Active LSP servers`: servers Pi detected for this workspace
  - `Running clients`: language-server processes currently started
- If status shows `Active LSP servers: rust` and `Running clients: none`, LSP is still available.
- `Running clients: none` usually means the client has not been started yet.
- Do **not** treat `Running clients: none` as a failure or as proof that LSP cannot be used.
- Real LSP actions like `symbols`, `definition`, `references`, `hover`, `diagnostics`, `actions`, or `rename` should start the client on demand.

### How to use it

- If LSP availability is unclear, check `lsp action=status`.
- If an active server exists for the language, try a real LSP request before falling back to grep.
- Prefer:
  - `symbols` and `workspace_symbols` to find code by meaning
  - `definition`, `references`, and `hover` to trace behavior
  - `diagnostics` and `actions` before manual fixes
  - `rename` for symbol renames instead of search/replace
- Fall back to plain file reads or text search only when:
  - no active server exists
  - the LSP request fails
  - you need raw text, formatting, or broad non-semantic search

### Practical guidance

- Use `symbols` for a known file.
- Use `workspace_symbols` when you know a symbol name or concept but not the file.
- Use `definition` once you have a likely symbol location.
- Use `references` to understand impact before editing.
- Use `hover` for type/info lookup.
- Use `diagnostics` and `actions` before manually patching compiler or analyzer issues.
- Use `rename` for semantic renames.

### Notes

- `line` and `character` are 1-based.
- A failed `status` check does not mean later LSP actions will fail.
- If a real LSP action fails, then explain the failure briefly and switch to non-LSP navigation.

---
