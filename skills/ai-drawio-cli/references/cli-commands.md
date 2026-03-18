# AI Drawio CLI Reference

## Scope

This reference is for the installed `ai-drawio` command only.

The current implementation is defined by `scripts/ai-drawio-cli.ts`. When examples in older docs differ from the parser, follow the parser behavior.

## General Rules

- Return the shortest valid command first.
- Do not add optional `--` flags unless the user explicitly asks for that behavior.
- Canvas commands can work without a session flag. In that mode, the CLI ensures or reuses a ready session automatically.
- `--session` and `--session-title` are mutually exclusive.
- `session open` and `session get` require exactly one selector:
  - `--id <session-id>`
  - `--title <session-title>`
- `canvas document.apply` and `canvas document.restore` require exactly one XML input mode:
  - `--xml-file <path>`
  - `--xml-stdin`

## Root Commands

### Open the app

```bash
ai-drawio open
```

Use with no extra flags.

### Check control status

```bash
ai-drawio status
```

Use with no extra flags.

### Create a conversation

```bash
ai-drawio conversation create
```

Use with no extra flags.

## Session Commands

### List sessions

```bash
ai-drawio session list
```

### Get one session

Use only when the task requires fetching one specific persisted session.

By id:

```bash
ai-drawio session get --id sess-123
```

By title:

```bash
ai-drawio session get --title "Architecture Draft"
```

Do not add both selectors.

### Open one session

Use only when the user explicitly wants a specific persisted session.

By id:

```bash
ai-drawio session open --id sess-123
```

By title:

```bash
ai-drawio session open --title "Architecture Draft"
```

Do not add both selectors.

## Canvas Commands

### Read the current XML

Minimal command:

```bash
ai-drawio canvas document.get
```

Use `--session <id>` only when the user names an exact session id:

```bash
ai-drawio canvas document.get --session sess-123
```

Use `--session-title <title>` only when the user names an exact session title:

```bash
ai-drawio canvas document.get --session-title "Architecture Draft"
```

Use `--output-file <path>` only when the XML must be written to disk:

```bash
ai-drawio canvas document.get --output-file ./current.xml
```

### Export SVG pages

Minimal command:

```bash
ai-drawio canvas document.svg
```

Use `--output-file <directory>` only when the SVG pages must be written to a directory:

```bash
ai-drawio canvas document.svg --output-file ./exports
```

### Apply XML

Prefer file input:

```bash
ai-drawio canvas document.apply --xml-file ./next.drawio
```

Add optional flags only when required:

```bash
ai-drawio canvas document.apply --session sess-123 --xml-file ./next.drawio
ai-drawio canvas document.apply --session-title "Architecture Draft" --xml-file ./next.drawio
ai-drawio canvas document.apply --xml-file ./next.drawio --base-version sha256:abc
ai-drawio canvas document.apply --xml-file ./next.drawio --prompt "Add a summary node"
```

Use stdin only when XML is explicitly piped:

```bash
cat ./next.drawio | ai-drawio canvas document.apply --xml-stdin
```

Do not add `--base-version` or `--prompt` unless the user explicitly asks for optimistic concurrency or prompt metadata.

### Restore XML

Prefer file input:

```bash
ai-drawio canvas document.restore --xml-file ./restore.drawio
```

Add optional flags only when required:

```bash
ai-drawio canvas document.restore --session sess-123 --xml-file ./restore.drawio
ai-drawio canvas document.restore --session-title "Architecture Draft" --xml-file ./restore.drawio
ai-drawio canvas document.restore --xml-file ./restore.drawio --base-version sha256:restore
```

Use stdin only when XML is explicitly piped:

```bash
cat ./restore.drawio | ai-drawio canvas document.restore --xml-stdin
```

## Output Notes

- The CLI prints JSON to stdout.
- Successful commands usually return `ok: true`.
- Validation and runtime failures return JSON with `ok: false` and a non-zero exit code.
- For `canvas document.get`, `--output-file` writes one XML file.
- For `canvas document.svg`, `--output-file` is a directory, not a single SVG file.

## Default Decision Rule

If the user does not explicitly ask for a selector, output path, base version, prompt metadata, or stdin input, omit the optional `--` flag and use the minimal command.
