# `ai-drawio canvas document.apply`

Use this for normal forward edits.

## Command

```bash
ai-drawio canvas document.apply sess-123 "Update the approval flow diagram" '<mxfile><diagram id="page-1">...</diagram></mxfile>'
```

## Optional Base Version

```bash
ai-drawio canvas document.apply sess-123 "Apply version-checked changes" --base-version sha256:abc '<mxfile><diagram id="page-1">...</diagram></mxfile>'
```

## Optional XML File

```bash
ai-drawio canvas document.apply sess-123 "Apply the prepared drawio file" --xml-file /tmp/ai-drawio-next.drawio
```

## Optional Stdin

```bash
cat /tmp/ai-drawio-next.drawio | ai-drawio canvas document.apply sess-123 "Apply xml from stdin" --xml-stdin
```

- The prompt argument is required for every apply command.
- Every apply command must include the target session id as the first positional argument.
- Prefer one multi-diagram XML payload over several separate XML payloads when one request includes multiple diagrams.
- Prefer inline XML when the XML is already in memory and fits safely in one command.
- Use `--xml-file` only when the XML already exists on disk or an oversized inline payload requires a temporary file under the system temp directory.
- Do not create temporary `.drawio` files in the project directory.
- Use `--xml-stdin` only for actual piped XML.
- Do not add optional flags unless the request explicitly needs them.
- If the app is not running, this command returns `APP_NOT_RUNNING`.
