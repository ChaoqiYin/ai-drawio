# `ai-drawio status`

Use only to check whether the desktop control service is already running.

## Command

```bash
ai-drawio status
```

- This command is detection-only.
- A non-running app returns JSON with `running: false`.
- Do not execute this command inside the default sandbox.
- If `running: false`, the skill should follow by running `ai-drawio open` outside the sandbox instead of asking the user to open the app manually.
