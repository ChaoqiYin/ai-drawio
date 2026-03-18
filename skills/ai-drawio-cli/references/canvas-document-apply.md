# `ai-drawio canvas document.apply`

Use this for normal forward edits.

## Commands

Inline XML:

```bash
ai-drawio canvas document.apply '<mxfile><diagram id="page-1">...</diagram></mxfile>'
```

With optional targeting or metadata:

```bash
ai-drawio canvas document.apply '<mxfile><diagram id="page-1">...</diagram></mxfile>' --session sess-123
ai-drawio canvas document.apply '<mxfile><diagram id="page-1">...</diagram></mxfile>' --session-title "Architecture Draft"
ai-drawio canvas document.apply '<mxfile><diagram id="page-1">...</diagram></mxfile>' --base-version sha256:abc
ai-drawio canvas document.apply '<mxfile><diagram id="page-1">...</diagram></mxfile>' --prompt "Add a summary node"
```

From a file:

```bash
ai-drawio canvas document.apply --xml-file ./next.drawio
```

From stdin:

```bash
cat ./next.drawio | ai-drawio canvas document.apply --xml-stdin
```

- Prefer one multi-diagram XML payload over several separate XML payloads when one request includes multiple diagrams.
- Prefer inline XML when the XML is already in memory.
- Use `--xml-file` only when the XML already exists on disk.
- Use `--xml-stdin` only for actual piped XML.
- Do not add optional flags unless the request explicitly needs them.
- If the app is not running, this command returns `APP_NOT_RUNNING`.
