# `ai-drawio canvas document.svg`

Use this when the task is to inspect or export the current document as SVG pages.

## Commands

Minimal command:

```bash
ai-drawio canvas document.svg
```

Write SVG pages to disk:

```bash
ai-drawio canvas document.svg --output-file ./exports
```

- Use this directly for SVG export.
- Add `--output-file` only when the SVG pages must be written to disk.
- If the app is not running, this command returns `APP_NOT_RUNNING`.
- `--output-file` is a directory, not a single SVG file.
