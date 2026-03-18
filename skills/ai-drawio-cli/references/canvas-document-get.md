# `ai-drawio canvas document.get`

Use this as the default entry point when you need the current XML before editing.

## Commands

Minimal command:

```bash
ai-drawio canvas document.get
```

With an explicit session id:

```bash
ai-drawio canvas document.get --session sess-123
```

With an explicit session title:

```bash
ai-drawio canvas document.get --session-title "Architecture Draft"
```

Write XML to disk:

```bash
ai-drawio canvas document.get --output-file ./current.xml
```

- If the user did not specify a session, omit session flags and let the CLI resolve it.
- Add `--output-file` only when the XML must be written to disk.
- If the app is not running, this command returns `APP_NOT_RUNNING`.
- `--output-file` writes one XML file.
