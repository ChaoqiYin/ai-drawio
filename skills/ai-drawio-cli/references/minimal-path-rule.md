# Minimal Path Rule

Load this when choosing the CLI command path for a task.

- Prefer one `ai-drawio` command when one command can finish the job and still satisfy the applicable completion checks.
- Never use the smallest command sequence as a reason to skip stricter paired-skill requirements.
- Do not run `ai-drawio status` as a routine pre-check before every command.
- Do not prefer `session list` when another command already satisfies the task.
- For live drawing requests, default to `canvas document.apply`, not file generation.
- Treat authored XML as an intermediate artifact and continue to the apply command when the user wants a live result.
- Use `canvas document.get`, `canvas document.svg`, `canvas document.preview`, `canvas document.apply`, or `canvas document.restore` directly when each one already matches the task.
- Only use a two-step path such as `canvas document.get <session-id>` followed by `canvas document.apply <session-id> <prompt>` when the task truly needs the current XML first.
- If one request needs multiple diagrams together, prefer one XML document with multiple diagrams or pages over several separate payloads.
