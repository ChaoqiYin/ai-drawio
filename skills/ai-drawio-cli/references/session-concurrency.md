# Session Concurrency

Load this when the task may touch more than one session or when command ordering matters.

- Commands for different session IDs may run in parallel.
- Commands that target the same session ID must run strictly serially.
- Treat `session open <session-id>`, `session close <session-id>`, and every `canvas document.* <session-id>` command as work that locks that session until the command completes.
- `session create` is serial for the new session it returns. After it completes, use the returned session ID for later locking decisions.
- Do not use a global one-command-at-a-time rule when separate session IDs are available.
