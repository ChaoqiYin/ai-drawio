# `ai-drawio status`

Use only to check whether the desktop control service is already running.

## Command

```bash
"$AI_DRAWIO_BIN" status
```

- This command is detection-only.
- A non-running app returns JSON with `running: false`.
- If `running: false`, launch the desktop app by executing the resolved packaged app path directly instead of asking the user to open the app manually.
- Apply the same recovery step when another `ai-drawio` command returns `APP_NOT_RUNNING`.
