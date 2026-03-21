# `ai-drawio canvas document.get`

Use this as the default entry point when you need the current XML before editing.

## Command

```bash
"$AI_DRAWIO_BIN" canvas document.get sess-123
```

## Optional Output

```bash
"$AI_DRAWIO_BIN" canvas document.get sess-123 --output-file ./current.xml
```

- Every get command must include the target session id as the first positional argument.
- Add `--output-file` only when the XML must be written to disk.
- `--output-file` writes one XML file.
- If the app is not running, this command returns `APP_NOT_RUNNING`.
