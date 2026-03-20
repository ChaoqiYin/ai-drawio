# `ai-drawio canvas document.restore`

Use this only for rollback or revert workflows.

## Command

```bash
ai-drawio canvas document.restore sess-123 '<mxfile><diagram id="page-1">...</diagram></mxfile>'
```

## Optional Base Version

```bash
ai-drawio canvas document.restore sess-123 '<mxfile><diagram id="page-1">...</diagram></mxfile>' --base-version sha256:restore
```

## Optional XML File

```bash
ai-drawio canvas document.restore sess-123 --xml-file ./restore.drawio
```

## Optional Stdin

```bash
cat ./restore.drawio | ai-drawio canvas document.restore sess-123 --xml-stdin
```

- Use this only for rollback or revert workflows.
- Every restore command must include the target session id as the first positional argument.
- Prefer one multi-diagram XML payload over several separate XML payloads when one request includes multiple diagrams.
- Prefer inline XML when the XML is already in memory.
- Use `--xml-file` only when the XML already exists on disk.
- Use `--xml-stdin` only for actual piped XML.
- If the app is not running, this command returns `APP_NOT_RUNNING`.
