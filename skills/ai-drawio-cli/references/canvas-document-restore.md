# `ai-drawio canvas document.restore`

Use this only for rollback or revert workflows.

## Commands

Inline XML:

```bash
ai-drawio canvas document.restore '<mxfile><diagram id="page-1">...</diagram></mxfile>'
```

With optional targeting or metadata:

```bash
ai-drawio canvas document.restore '<mxfile><diagram id="page-1">...</diagram></mxfile>' --session sess-123
ai-drawio canvas document.restore '<mxfile><diagram id="page-1">...</diagram></mxfile>' --session-title "Architecture Draft"
ai-drawio canvas document.restore '<mxfile><diagram id="page-1">...</diagram></mxfile>' --base-version sha256:restore
```

From a file:

```bash
ai-drawio canvas document.restore --xml-file ./restore.drawio
```

From stdin:

```bash
cat ./restore.drawio | ai-drawio canvas document.restore --xml-stdin
```

- Use this only for rollback or revert workflows.
- Prefer one multi-diagram XML payload over several separate XML payloads when one request includes multiple diagrams.
- Prefer inline XML when the XML is already in memory.
- Use `--xml-file` only when the XML already exists on disk.
- Use `--xml-stdin` only for actual piped XML.
- If the app is not running, this command returns `APP_NOT_RUNNING`.
