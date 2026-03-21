# `ai-drawio status`

Use only to check whether the desktop control service is already running.

## Command

```bash
"$AI_DRAWIO_BIN" status
```

- This command is detection-only.
- A non-running app returns JSON with `running: false`.
- Do not execute this command inside the default sandbox.
- If `running: false`, the skill should follow by executing the resolved packaged app path directly outside the sandbox instead of asking the user to open the app manually.
