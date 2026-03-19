# CLI Document Preview PNG Design

**Date:** 2026-03-19

**Goal:** Add a CLI command that exports the current or specified draw.io document as per-page PNG preview images, writes them into a required output directory, and returns structured JSON with the generated file paths for AI image recognition workflows.

## Context

The current CLI already supports:

- resolving the active session automatically or targeting a session by id or title
- reading the current draw.io XML document
- exporting the current document as per-page SVG
- applying or restoring draw.io XML documents

The missing capability is a PNG-oriented preview command for downstream image recognition.

The user requirement is:

- expose a new terminal command dedicated to preview output
- make the output directory mandatory and positional instead of using `--output-file`
- export one PNG per page when no page selector is provided
- allow `--page <n>` to export exactly one selected page
- return local file paths instead of raw PNG bytes

One important product constraint is that a single draw.io XML document may contain multiple pages, so the command cannot assume a one-document-to-one-image model.

Another important implementation constraint is fidelity. The PNG output should come from draw.io's own page image export path rather than from a CLI-side `SVG -> PNG` conversion step.

## Product Decision

Add a new CLI command:

- `canvas document.preview`

Supported forms:

- `ai-drawio canvas document.preview <output-directory>`
- `ai-drawio canvas document.preview <output-directory> --session <session-id>`
- `ai-drawio canvas document.preview <output-directory> --session-title <session-title>`
- `ai-drawio canvas document.preview <output-directory> --page <page-number>`
- `ai-drawio canvas document.preview <output-directory> --session <session-id> --page <page-number>`
- `ai-drawio canvas document.preview <output-directory> --session-title <session-title> --page <page-number>`

Rules:

- `<output-directory>` is a required positional argument
- `--page` is optional
- `--page` is 1-based
- omitting `--page` exports all pages
- providing `--page N` exports only page `N`
- `--session` and `--session-title` remain mutually exclusive
- the command always writes PNG files to disk and always returns JSON to stdout

## User Experience

### Full Preview Export

When the user runs:

- `ai-drawio canvas document.preview ./previews`

the CLI resolves the target session, exports every page as PNG, writes one `.png` file per page into `./previews`, and prints JSON describing the generated files.

### Single Page Preview Export

When the user runs:

- `ai-drawio canvas document.preview ./previews --page 2`

the CLI exports only the second page of the resolved document.

The response shape stays the same as the full export flow. The `pages` array simply contains one item.

### Output Directory Behavior

Directory behavior is fixed:

- create the directory if it does not exist
- overwrite any existing file with the same generated name
- return absolute file paths in the JSON payload so AI tooling can consume them directly

## File Naming

File naming should remain deterministic and human-readable.

Recommended format:

- `01-<sanitized-page-name>.png`
- `02-<sanitized-page-name>.png`

Fallback rule:

- if a page name is empty after normalization, use `page-01.png`, `page-02.png`, and so on

Even when only one page is exported, the generated filename should preserve that page's original 1-based index inside the document.

The sanitization rules should match the existing SVG export filename rules so the CLI stays internally consistent across export commands.

## Response Shape

Recommended success payload shape:

```json
{
  "ok": true,
  "command": "canvas.document.preview",
  "sessionId": "sess-123",
  "data": {
    "timestamp": "2026-03-19T12:34:56.000Z",
    "outputDir": "/absolute/path/to/previews",
    "pages": [
      {
        "index": 1,
        "id": "page-1",
        "name": "首页",
        "path": "/absolute/path/to/previews/01-首页.png"
      },
      {
        "index": 2,
        "id": "page-2",
        "name": "流程图",
        "path": "/absolute/path/to/previews/02-流程图.png"
      }
    ]
  }
}
```

Each page entry should include:

- `index`
- `id`
- `name`
- `path`

The preview command does not need to include raw PNG bytes in stdout once the files have been written successfully.

## Error Handling

### CLI Validation Errors

These should fail during argument parsing:

- missing `<output-directory>`
- `--page` less than `1`
- invalid non-numeric `--page`

### Page Selection Errors

If the user requests a page number larger than the document page count, return a structured error and do not write any file.

Recommended error payload:

```json
{
  "ok": false,
  "command": "canvas.document.preview",
  "error": {
    "code": "PAGE_OUT_OF_RANGE",
    "message": "requested page 3 is out of range",
    "details": {
      "requestedPage": 3,
      "pageCount": 2
    }
  }
}
```

### Session or Export Errors

If the desktop app is not running, the session cannot be resolved, draw.io is not ready, or the image export fails:

- return the existing structured CLI/control errors
- do not leave partially written output behind for the failed run

## Compatibility Contract

### Session Resolution Compatibility

The new command must follow the same session resolution flow as:

- `canvas.document.get`
- `canvas.document.svg`
- `canvas.document.apply`
- `canvas.document.restore`

That means:

- explicit session id uses `session.open`
- explicit session title uses title-based `session.open`
- no locator uses `session.ensure`

### Machine-Readable CLI Compatibility

The CLI must remain machine-readable.

Therefore:

- stdout stays JSON
- file writing is the command's primary effect, not a replacement for JSON
- success and failure continue to use `ok: true/false`

## Architecture

### Unit 1: CLI Schema and Match Parsing

Locations:

- `src-tauri/src/cli_schema.rs`
- `src-tauri/src/packaged_cli.rs`

Responsibility:

- add `canvas document.preview`
- require one positional output directory argument
- parse optional `--page`
- keep session targeting behavior aligned with the rest of the canvas command family

### Unit 2: Control Protocol and Dispatch

Locations:

- `src-tauri/src/control_protocol.rs`
- `src-tauri/src/control_server.rs`
- `src-tauri/src/document_bridge.rs`

Responsibility:

- accept and validate a new `canvas.document.preview` control command
- route it through the existing active-session safety checks
- return page-level PNG preview results from the embedded draw.io runtime

### Unit 3: Draw.io PNG Export Bridge

Location:

- `app/(internal)/_components/session-workspace.tsx`

Responsibility:

- expose a page-level PNG export function from the embedded draw.io runtime
- reuse draw.io's own image export APIs instead of post-processing SVG into PNG
- return all page preview images with stable page metadata

The current code already uses draw.io image export helpers for page preview generation. The new bridge method should extend that path to request PNG image data rather than SVG image data.

### Unit 4: CLI Output Writer

Location:

- `src-tauri/src/packaged_cli.rs`

Responsibility:

- decode returned PNG data
- create the output directory
- filter to a single page when `--page` is provided
- write deterministic `.png` files
- enrich the success payload with absolute output paths

## Data Flow

### Full Export Flow

1. User runs `canvas document.preview <output-directory>`.
2. CLI resolves the session using existing rules.
3. CLI sends a `canvas.document.preview` control request.
4. The desktop shell asks the embedded draw.io runtime to export every page as PNG preview data.
5. The control response returns page metadata plus PNG data for each page.
6. CLI creates the output directory.
7. CLI writes one `.png` file per page.
8. CLI prints JSON with the generated absolute paths.

### Single Page Export Flow

1. User runs `canvas document.preview <output-directory> --page N`.
2. CLI resolves the session and requests preview data.
3. CLI validates that `N` is within range.
4. CLI writes only the selected page's `.png` file.
5. CLI prints JSON with one `pages[]` entry.

## Testing

Required coverage:

- CLI parsing accepts `canvas document.preview <output-directory>`
- CLI parsing accepts `--page <n>`
- CLI parsing rejects missing positional output directory
- CLI parsing rejects invalid page values
- output writing creates the target directory when needed
- full export writes multiple PNG files and returns their absolute paths
- single-page export writes only the selected PNG file
- page-overflow export returns `PAGE_OUT_OF_RANGE`
- README and source-level tests recognize the new command path

## Out of Scope

The first version should not include:

- raw PNG bytes in stdout
- alternate output formats such as JPEG or WebP
- custom filename templates
- partial export by page name
- mixed SVG and PNG output in one command
