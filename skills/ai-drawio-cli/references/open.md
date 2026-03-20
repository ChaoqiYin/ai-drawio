# `ai-drawio open`

Use this when the task is to launch the desktop app itself.
Use this when the desktop app is not running and the skill must launch it before continuing the original task.

## Command

```bash
ai-drawio open
```

## Optional Mode

```bash
ai-drawio open --mode window
```

- `open` does not target a session id.
- Use `--mode window` only when the task explicitly needs a visible window.
- Do not execute this command inside the default sandbox.
