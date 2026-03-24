# Command Selection

Load this when choosing which `ai-drawio` command should satisfy the task.

- Start the desktop app directly by executing the resolved packaged app path only when you need to start the desktop app itself.
- `status`: only when you need to know whether the desktop app is running.
- `session status <session-id>`: only when you need to know whether one session is ready.
- `session create`: only when the user explicitly needs a new ready session.
- `session list`: not a preferred default; use it when the user needs persisted session IDs or session discovery is genuinely required.
- `session open <session-id>`: only when the user explicitly wants a session opened or when later session-targeted work must ensure readiness first.
- `session close <session-id>`: use as the session cleanup step after the full bounded task is complete only when the current app state is tray state, unless the user explicitly wants that session kept open.
- `canvas document.get <session-id>`: default entry point when you need the current XML first.
- `canvas document.svg <session-id>`: direct SVG export or inspection.
- `canvas document.preview <session-id>`: PNG preview export.
- `canvas document.apply <session-id> <prompt>`: normal forward edits.
- `canvas document.restore <session-id>`: rollback or revert only.
