# `ai-drawio session create`

Use only when the user explicitly needs a new ready session.

## Command

```bash
ai-drawio session create
```

- This command creates a new persisted session, opens it, waits for readiness, and returns the new session id.
- Do not run `ai-drawio status` first unless the task is specifically about status.
- If the app is not running, this command returns `APP_NOT_RUNNING`.
