# `ai-drawio canvas document.svg`

Use this when the task is to inspect or export the current document as SVG pages.

## Command

```bash
ai-drawio canvas document.svg sess-123
```

## Optional Output

```bash
ai-drawio canvas document.svg sess-123 --output-file ./exports
```

- Every svg command must include the target session id as the first positional argument.
- Add `--output-file` only when the SVG pages must be written to disk.
- `--output-file` is a directory, not a single SVG file.
- If the app is not running, this command returns `APP_NOT_RUNNING`.
