# `ai-drawio canvas document.apply`

Use this for normal forward edits.

## Command

```bash
"$AI_DRAWIO_BIN" canvas document.apply sess-123 "Update the approval flow diagram" '<mxfile><diagram id="page-1">...</diagram></mxfile>'
```

## Optional Base Version

```bash
"$AI_DRAWIO_BIN" canvas document.apply sess-123 "Apply version-checked changes" --base-version sha256:abc '<mxfile><diagram id="page-1">...</diagram></mxfile>'
```

## Optional XML File

```bash
"$AI_DRAWIO_BIN" canvas document.apply sess-123 "Apply the prepared drawio file" --xml-file /tmp/ai-drawio-next.drawio
```

## Optional Stdin

```bash
cat /tmp/ai-drawio-next.drawio | "$AI_DRAWIO_BIN" canvas document.apply sess-123 "Apply xml from stdin" --xml-stdin
```

- The prompt argument is required for every apply command.
- Every apply command must include the target session id as the first positional argument.
- Prefer one multi-diagram XML payload over several separate XML payloads when one request includes multiple diagrams.
- Prefer `--xml-file` with a temporary file under the system temp directory for agent-generated XML payloads.
- Use inline XML only when the user explicitly asks for it or the payload is trivially small.
- Do not create temporary `.drawio` files in the project directory.
- Use `--xml-stdin` only for actual piped XML.
- Do not add optional flags unless the request explicitly needs them.
- If the app is not running, this command returns `APP_NOT_RUNNING`.
