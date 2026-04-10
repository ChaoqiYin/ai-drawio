# `ai-drawio canvas document.restore`

Use this only for rollback or revert workflows.

## Command

```bash
"$AI_DRAWIO_BIN" canvas document.restore sess-123 '<mxfile><diagram id="page-1">...</diagram></mxfile>'
```

## Optional Base Version

```bash
"$AI_DRAWIO_BIN" canvas document.restore sess-123 '<mxfile><diagram id="page-1">...</diagram></mxfile>' --base-version sha256:restore
```

## Optional XML File

```bash
"$AI_DRAWIO_BIN" canvas document.restore sess-123 --xml-file ./restore.drawio
```

## Optional Stdin

```bash
cat ./restore.drawio | "$AI_DRAWIO_BIN" canvas document.restore sess-123 --xml-stdin
```

- Use this only for rollback or revert workflows.
- Every restore command must include the target session id as the first positional argument.
- Prefer one multi-diagram XML payload over several separate XML payloads when one request includes multiple diagrams.
- Prefer `--xml-file` with a temporary file under the system temp directory for agent-generated XML payloads.
- Use inline XML only when the user explicitly asks for it or the payload is trivially small.
- Do not create temporary `.drawio` files in the project directory.
- Use `--xml-stdin` only for actual piped XML.
- If the app is not running, this command returns `APP_NOT_RUNNING`.
