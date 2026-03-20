# `ai-drawio canvas document.preview`

Use this when the task is to export PNG preview images from a draw.io session.

## Command

```bash
ai-drawio canvas document.preview sess-123 ./previews
```

## Optional Page

```bash
ai-drawio canvas document.preview sess-123 ./previews --page 2
```

- Every preview command must include the target session id as the first positional argument.
- The output directory is required.
- Use `--page` only when the task explicitly needs one 1-based page.
- If the app is not running, this command returns `APP_NOT_RUNNING`.
