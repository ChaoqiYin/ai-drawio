# `ai-drawio session open`

Use only when the user explicitly wants one persisted session opened.

## Command

```bash
ai-drawio session open sess-123
```

- Use the exact persisted session id as the required positional argument.
- This command waits until the requested session is ready.
- If the app is not running, this command returns `APP_NOT_RUNNING`.
