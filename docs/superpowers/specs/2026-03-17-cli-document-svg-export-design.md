# CLI Document SVG Export Design

**Date:** 2026-03-17

**Goal:** Add a CLI command that exports the current or specified session draw.io document as per-page SVG output, returning structured JSON by default and optionally writing one `.svg` file per page into an output directory.

## Context

The current CLI already supports:

- opening the desktop app
- resolving sessions by id, title, or current active context
- reading the current draw.io XML document
- applying or restoring draw.io XML documents

The missing capability is SVG export.

The user needs a command that converts the current draw.io XML document into SVG output. One important product constraint is that a single draw.io XML document may contain multiple pages, so the CLI cannot assume a one-document-to-one-SVG model.

The requested behavior is:

- expose a new terminal command for SVG export
- default to the current active drawing when no session locator is provided
- treat a multi-page XML document as multiple SVG outputs
- when no output path is provided, return JSON in stdout
- when `--output-file` is provided, treat it as a target directory and write one `.svg` file per page

## Product Decision

Add a new CLI command:

- `canvas document.svg`

This command exports the resolved draw.io document as per-page SVG output.

The command reuses the existing session resolution rules:

- `--session <session-id>`
- `--session-title <session-title>`
- no locator means resolve the current active session via `session.ensure`

The command does not export raw XML. It exports page-level SVG renderings derived from the active draw.io runtime.

## User Experience

### Default CLI Output

When the user runs:

- `ai-drawio canvas document.svg`

the CLI returns JSON to stdout.

The response payload includes:

- resolved session id
- per-page SVG results
- launch metadata consistent with the current CLI contract

Each page entry should include:

- `id`
- `name`
- `svg`

### Output Directory Mode

When the user runs:

- `ai-drawio canvas document.svg --output-file ./exports/session-a`

the CLI treats `./exports/session-a` as a directory path.

Behavior:

- create the directory if it does not exist
- write one `.svg` file per page
- preserve stdout JSON output for machine-readable usage
- include each written file path in the JSON response as `outputPath`

### File Naming

For directory export, file naming should be deterministic and human-readable.

Recommended format:

- `01-<sanitized-page-name>.svg`
- `02-<sanitized-page-name>.svg`

Fallback rule:

- if a page name is empty after normalization, use `page-01.svg`, `page-02.svg`, and so on

The filename generation should sanitize path separators and other filesystem-hostile characters.

## CLI Surface

Supported forms:

- `ai-drawio canvas document.svg`
- `ai-drawio canvas document.svg --session <session-id>`
- `ai-drawio canvas document.svg --session-title <session-title>`
- `ai-drawio canvas document.svg --output-file <directory>`
- `ai-drawio canvas document.svg --session <session-id> --output-file <directory>`
- `ai-drawio canvas document.svg --session-title <session-title> --output-file <directory>`

Rules:

- `--session` and `--session-title` are mutually exclusive
- `--output-file` means directory path for this command
- the command exports all pages of the resolved document
- partial page export is out of scope for this version

## Compatibility Contract

### Session Resolution Compatibility

The new command must follow the same resolution flow as:

- `canvas.document.get`
- `canvas.document.apply`
- `canvas.document.restore`

That means:

- explicit session id uses `session.open`
- explicit session title uses title-based `session.open`
- no locator uses `session.ensure`

### Output Compatibility

The CLI must remain machine-readable.

Therefore:

- stdout output remains JSON
- directory export is additive, not a replacement for JSON output
- success/failure semantics remain aligned with `ok: true/false`

## Architecture

### Unit 1: Node CLI Argument and Output Handling

Location: `scripts/ai-drawio-cli.ts`

Responsibility:

- parse `canvas document.svg`
- reuse existing session resolution flow
- send a new control command to the desktop shell
- when `--output-file` exists, create a directory and write one `.svg` file per page
- enrich the JSON result with `outputPath` values for written files

This unit should mirror the current CLI architecture instead of introducing a second execution path.

### Unit 2: Desktop Control Protocol

Locations:

- `src-tauri/src/control_protocol.rs`
- related Rust command dispatch files under `src-tauri/src/`

Responsibility:

- accept a new control command for SVG export
- validate it as a document-read style command
- route it through the existing session runtime safety checks

### Unit 3: Draw.io SVG Export Bridge

Locations:

- `app/(internal)/_components/session-workspace.tsx`
- `src-tauri/src/document_bridge.rs`

Responsibility:

- expose a page-level SVG export function from the embedded draw.io runtime
- return all page SVGs for the active document
- keep the export fidelity aligned with the existing in-app SVG preview generation path

This should reuse the existing draw.io runtime export logic rather than reimplementing SVG conversion in Rust or Node.

## Data Flow

### Stdout JSON Flow

1. User runs `canvas document.svg`.
2. CLI resolves the session using existing rules.
3. CLI sends a new export-SVG control request.
4. Desktop shell asks the embedded draw.io runtime to export all pages as SVG.
5. Control response returns `pages[]`.
6. CLI prints JSON to stdout.

### Directory Export Flow

1. User runs `canvas document.svg --output-file <directory>`.
2. CLI resolves the session and receives `pages[]`.
3. CLI creates the output directory when needed.
4. CLI writes one `.svg` file per page.
5. CLI returns JSON to stdout with `outputPath` for each page.

## Response Shape

Recommended success payload shape:

```json
{
  "ok": true,
  "sessionId": "sess-123",
  "data": {
    "pages": [
      {
        "id": "page-1",
        "name": "首页流程图",
        "svg": "<svg ...>...</svg>",
        "outputPath": "./exports/session-a/01-首页流程图.svg"
      }
    ],
    "launched": false
  }
}
```

`outputPath` should be present only when the CLI actually writes files.

## Error Handling

### Session Resolution Errors

If the active session cannot be resolved:

- return the same style of structured error used by existing document commands
- do not create the output directory

### Export Errors

If draw.io is not ready, the document is unavailable, or page SVG export fails:

- return a control-layer failure
- do not report partial success

### Filesystem Errors

If the output directory cannot be created or a page file cannot be written:

- the CLI returns an error
- the command is treated as failed
- partial directory output is acceptable on disk but must not be reported as success

This keeps CLI semantics honest even if some files were already written before failure.

## Testing Strategy

### Node CLI Tests

Add or extend tests for:

- parsing `canvas document.svg`
- parsing `--session`, `--session-title`, and `--output-file`
- treating the command as session-resolved like other document commands
- writing one `.svg` file per page when directory output is requested

### Rust CLI Schema / Packaged CLI Tests

Add or extend tests for:

- packaged CLI schema exposing `document.svg`
- packaged CLI parser accepting the new command and options
- session resolution behavior for the new command

### Desktop Bridge / Source Tests

Add or extend tests for:

- a new export-SVG bridge function being exposed
- per-page SVG payload shape
- command routing through the control layer

## Implementation Notes

- Keep the first version focused on exporting all pages only.
- Do not add per-page filtering or page selection flags in this scope.
- Reuse the existing SVG preview export behavior rather than creating a second rendering implementation.
- Preserve the current JSON-first CLI contract even when files are written.
