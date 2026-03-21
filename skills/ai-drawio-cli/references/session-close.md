# `ai-drawio session close`

Use this command as the session cleanup step after a bounded task is fully complete.

## Command

```bash
"$AI_DRAWIO_BIN" session close sess-123
```

- Use the exact persisted session id as the required positional argument.
- This command closes only an already-opened session tab in the workspace detail page.
- If the persisted session exists but is not currently open in the detail page, this command returns `SESSION_NOT_OPEN`.
- If the persisted session does not exist in local storage, this command returns `SESSION_NOT_FOUND`.
- Prefer this command for end-of-task cleanup unless the user explicitly wants the session kept open.
