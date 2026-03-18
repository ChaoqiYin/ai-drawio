# `ai-drawio session open`

Use only when the user explicitly wants one persisted session opened.

## Commands

By id:

```bash
ai-drawio session open sess-123
```

By title:

```bash
ai-drawio session open --title "Architecture Draft"
```

- Choose exactly one selector.
- Prefer `<session-id>` when the user already gave the exact id.
- If the app is not running, this command returns `APP_NOT_RUNNING`.
