# focus-tracker

Tiny pi extension for showing what the model is trying to do right now.

## What it adds

- `focus_update` tool
- footer status line like `🎯 goal -> subgoal -> problem`
- `/focus` command for a simple read-only detail view
- tiny rolling history, max 3 entries
- focus state is kept only for the current live session
- focus state is cleared on session start, switch, fork, tree change, shutdown, and reload

## Files

- `focus-tracker/index.ts`
- `focus-tracker/README.md`

## Usage

Reload pi after changes:

```text
/reload
```

After reload, focus starts empty again.

Then the model can call `focus_update` when the work meaningfully changes.

Open the detail view with:

```text
/focus
```

Close it with `Esc`.
