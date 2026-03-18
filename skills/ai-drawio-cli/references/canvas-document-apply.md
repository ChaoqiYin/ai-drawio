# `ai-drawio canvas document.apply`

Use this for normal forward edits.

## Commands

Inline XML:

```bash
ai-drawio canvas document.apply "Update the approval flow diagram" '<mxfile><diagram id="page-1">...</diagram></mxfile>'
```

With optional targeting or metadata:

```bash
ai-drawio canvas document.apply "Add a summary node" '<mxfile><diagram id="page-1">...</diagram></mxfile>'
ai-drawio canvas document.apply "Update the live session" --session sess-123 '<mxfile><diagram id="page-1">...</diagram></mxfile>'
ai-drawio canvas document.apply "Apply the architecture draft" --session-title "Architecture Draft" '<mxfile><diagram id="page-1">...</diagram></mxfile>'
ai-drawio canvas document.apply "Apply version-checked changes" --base-version sha256:abc '<mxfile><diagram id="page-1">...</diagram></mxfile>'
```

From a file:

```bash
ai-drawio canvas document.apply "Apply the prepared drawio file" --xml-file /tmp/ai-drawio-next.drawio
```

From stdin:

```bash
cat /tmp/ai-drawio-next.drawio | ai-drawio canvas document.apply "Apply xml from stdin" --xml-stdin
```

- The prompt argument is required for every apply command.
- Prefer one multi-diagram XML payload over several separate XML payloads when one request includes multiple diagrams.
- Prefer inline XML when the XML is already in memory and fits safely in one command.
- Use `--xml-file` only when the XML already exists on disk or an oversized inline payload requires a temporary file under the system temp directory.
- Do not create temporary `.drawio` files in the project directory.
- Use `--xml-stdin` only for actual piped XML.
- Do not add optional flags unless the request explicitly needs them.
- If the app is not running, this command returns `APP_NOT_RUNNING`.
