# CLI Document Preview PNG Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `canvas document.preview <output-directory> [--page <n>]` so the packaged `ai-drawio` CLI can export one PNG per draw.io page, or a single selected page, into a required output directory and return structured JSON with absolute paths.

**Architecture:** Extend the existing packaged CLI and Rust control pipeline instead of introducing a sidecar export path. Reuse the current session resolution flow, add a new page-level PNG export bridge in the session workspace, route it through the Rust control server, and reuse the packaged CLI's existing file-writing pattern from `document.svg` with PNG-specific filtering and validation.

**Tech Stack:** Rust, Tauri, Clap, serde_json, Next.js, React, Node test runner, Rust unit tests

---

## Chunk 1: CLI Surface and Rust Parsing

### Task 1: Add failing packaged CLI parser tests for `canvas document.preview`

**Files:**
- Modify: `src-tauri/src/packaged_cli.rs`
- Modify: `src-tauri/src/cli_schema.rs`
- Test: `src-tauri/src/packaged_cli.rs`

- [ ] **Step 1: Write the failing tests**

Add Rust tests that require:

- `parse_cli_args(&["canvas", "document.preview", "./previews"])` to produce `PackagedCliCommand::CanvasDocumentPreview`
- `parse_cli_args(&["canvas", "document.preview", "./previews", "--page", "2"])` to capture the selected page
- `parse_cli_args(&["canvas", "document.preview"])` to fail because the positional output directory is required
- `parse_cli_args(&["canvas", "document.preview", "./previews", "--page", "0"])` to fail because page numbers are 1-based

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml parses_document_preview -- --nocapture`

Expected: FAIL because `document.preview` is not exposed or parsed yet.

### Task 2: Implement the new CLI schema and parser variant

**Files:**
- Modify: `src-tauri/src/cli_schema.rs`
- Modify: `src-tauri/src/packaged_cli.rs`

- [ ] **Step 3: Write minimal implementation**

Update the Rust CLI surface to:

- add `Command::new("document.preview")` under `canvas`
- require a positional `output-directory` argument
- accept optional `--page <page-number>`
- add `PackagedCliCommand::CanvasDocumentPreview { locator, output_directory, page }`
- parse and validate `--page` as a positive 1-based integer
- keep `--session` and `--session-title` handling aligned with `document.get` and `document.svg`

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml parses_document_preview -- --nocapture`

Expected: PASS

### Task 3: Add failing resolution and command-name tests for the preview command

**Files:**
- Modify: `src-tauri/src/packaged_cli.rs`
- Test: `src-tauri/src/packaged_cli.rs`

- [ ] **Step 5: Write the failing tests**

Add tests that require:

- `build_resolution_request(&PackagedCliCommand::CanvasDocumentPreview { ... })` to use `session.ensure` without a locator
- `build_request_for_command(...)` to produce `command: "canvas.document.preview"`
- `command_name_for(&PackagedCliCommand::CanvasDocumentPreview { ... })` to report `canvas.document.preview`

- [ ] **Step 6: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml document_preview -- --nocapture`

Expected: FAIL because the preview command is not wired into request construction yet.

### Task 4: Implement request construction and session resolution support

**Files:**
- Modify: `src-tauri/src/packaged_cli.rs`

- [ ] **Step 7: Write minimal implementation**

Update packaged CLI request handling to:

- treat `CanvasDocumentPreview` as a session-resolved document read command
- build `canvas.document.preview` requests
- include the selected page in the payload only when `--page` is provided

- [ ] **Step 8: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml document_preview -- --nocapture`

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src-tauri/src/cli_schema.rs src-tauri/src/packaged_cli.rs
git commit -m "feat: add preview CLI parsing"
```

## Chunk 2: Control Protocol and PNG Export Bridge

### Task 5: Add failing Rust tests for `canvas.document.preview` validation

**Files:**
- Modify: `src-tauri/src/control_protocol.rs`
- Test: `src-tauri/src/control_protocol.rs`

- [ ] **Step 10: Write the failing tests**

Add tests that require:

- `CommandKind::CanvasDocumentPreview`
- `base_request("canvas.document.preview")` with a session id to validate successfully
- payload validation to accept optional `page`
- payload validation to reject `page: 0`

- [ ] **Step 11: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml validates_document_preview_requests -- --nocapture`

Expected: FAIL because the control protocol does not know about `canvas.document.preview` yet.

### Task 6: Implement control protocol support for preview requests

**Files:**
- Modify: `src-tauri/src/control_protocol.rs`

- [ ] **Step 12: Write minimal implementation**

Update the control protocol to:

- add `CanvasDocumentPreview` to `CommandKind`
- map `"canvas.document.preview"` in `command_kind()`
- validate it like a session-resolved document-read command
- enforce positive page values when `payload.page` is present

- [ ] **Step 13: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml validates_document_preview_requests -- --nocapture`

Expected: PASS

### Task 7: Add failing bridge tests for page-level PNG export

**Files:**
- Modify: `app/(internal)/_components/session-workspace.tsx`
- Create: `tests/session-workspace-preview-export-source.test.ts`
- Modify: `src-tauri/src/document_bridge.rs`
- Test: `src-tauri/src/document_bridge.rs`

- [ ] **Step 14: Write the failing tests**

Add source and Rust tests that require:

- a workspace helper that exports PNG preview pages
- a shell bridge method named `exportPreviewPages`
- `document_bridge.rs` to normalize `pages[]` entries with `id`, `name`, and `pngDataUri`
- PNG data to use a `data:image/png` prefix

- [ ] **Step 15: Run test to verify it fails**

Run: `npm run test:node -- tests/session-workspace-preview-export-source.test.ts`
Run: `cargo test --manifest-path src-tauri/Cargo.toml preview_pages -- --nocapture`

Expected: FAIL because only SVG export exists today.

### Task 8: Implement the draw.io PNG preview bridge and Rust payload builder

**Files:**
- Modify: `app/(internal)/_components/session-workspace.tsx`
- Modify: `src-tauri/src/document_bridge.rs`

- [ ] **Step 16: Write minimal implementation**

Implement a reusable preview export path that:

- adds a draw.io remote invoke using draw.io's own page image export API
- returns one PNG data URI per page with stable `id` and `name`
- exposes `documentBridge.exportPreviewPages()`
- adds a Rust `export_preview_pages(...)` bridge function
- normalizes the payload to a JSON shape suitable for the packaged CLI writer

Keep the existing SVG export path unchanged.

- [ ] **Step 17: Run test to verify it passes**

Run: `npm run test:node -- tests/session-workspace-preview-export-source.test.ts`
Run: `cargo test --manifest-path src-tauri/Cargo.toml preview_pages -- --nocapture`

Expected: PASS

### Task 9: Route the new command through the control server

**Files:**
- Modify: `src-tauri/src/control_server.rs`

- [ ] **Step 18: Write the failing test**

Add or extend Rust coverage so `canvas.document.preview` dispatches to the preview bridge path.

- [ ] **Step 19: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml control_server -- --nocapture`

Expected: FAIL because the server is not routing preview requests yet.

- [ ] **Step 20: Write minimal implementation**

Update `control_server.rs` to:

- read `payload.page` when present
- call `document_bridge::export_preview_pages(...)`
- return the preview payload through the existing success envelope

- [ ] **Step 21: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml control_server -- --nocapture`

Expected: PASS

- [ ] **Step 22: Commit**

```bash
git add app/\(internal\)/_components/session-workspace.tsx src-tauri/src/control_protocol.rs src-tauri/src/document_bridge.rs src-tauri/src/control_server.rs tests/session-workspace-preview-export-source.test.ts
git commit -m "feat: add preview export bridge"
```

## Chunk 3: PNG File Writing, Page Filtering, and Error Handling

### Task 10: Add failing packaged CLI output-writer tests for PNG previews

**Files:**
- Modify: `src-tauri/src/packaged_cli.rs`
- Test: `src-tauri/src/packaged_cli.rs`

- [ ] **Step 23: Write the failing tests**

Add tests that require:

- preview responses to create the target directory recursively
- full preview export to write multiple `.png` files
- single-page preview export to write only the selected page
- generated file names to use `01-<name>.png` and `page-01.png` fallback rules
- written page entries to include absolute `path`

Use a temp directory and a minimal fake response payload with PNG data URIs.

- [ ] **Step 24: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml writes_preview_pages -- --nocapture`

Expected: FAIL because preview output writing does not exist.

### Task 11: Implement preview directory writing and absolute path enrichment

**Files:**
- Modify: `src-tauri/src/packaged_cli.rs`

- [ ] **Step 25: Write minimal implementation**

Extend packaged CLI output handling to:

- decode PNG data URIs into bytes
- create the output directory recursively
- reuse filename sanitization with a `.png` suffix
- write files into the requested directory
- replace raw PNG data in the final success payload with absolute paths

- [ ] **Step 26: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml writes_preview_pages -- --nocapture`

Expected: PASS

### Task 12: Add failing page-selection overflow tests

**Files:**
- Modify: `src-tauri/src/packaged_cli.rs`
- Test: `src-tauri/src/packaged_cli.rs`

- [ ] **Step 27: Write the failing tests**

Add tests that require:

- `--page 3` against a two-page payload to return `PAGE_OUT_OF_RANGE`
- no file writes to occur on overflow
- the error details to include `requestedPage` and `pageCount`

- [ ] **Step 28: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml page_out_of_range -- --nocapture`

Expected: FAIL because overflow handling does not exist yet.

### Task 13: Implement page filtering and overflow behavior

**Files:**
- Modify: `src-tauri/src/packaged_cli.rs`

- [ ] **Step 29: Write minimal implementation**

Update preview output handling to:

- apply 1-based page filtering before writing files
- error out with `PAGE_OUT_OF_RANGE` if the requested page exceeds the available page count
- avoid leaving partial files on overflow failures

- [ ] **Step 30: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml page_out_of_range -- --nocapture`

Expected: PASS

- [ ] **Step 31: Commit**

```bash
git add src-tauri/src/packaged_cli.rs
git commit -m "feat: write PNG preview exports"
```

## Chunk 4: Documentation and Final Verification

### Task 14: Add failing source-level coverage for public CLI exposure

**Files:**
- Modify: `tests/packaged-tauri-cli-source.test.ts`
- Modify: `README.md`

- [ ] **Step 32: Write the failing tests**

Extend source-level coverage to require:

- `document.preview` in the packaged CLI source
- README examples for full preview export and single-page preview export

- [ ] **Step 33: Run test to verify it fails**

Run: `npm run test:node -- tests/packaged-tauri-cli-source.test.ts`

Expected: FAIL because the new command is not documented or asserted yet.

### Task 15: Document the new command

**Files:**
- Modify: `README.md`
- Modify: `tests/packaged-tauri-cli-source.test.ts`

- [ ] **Step 34: Write minimal implementation**

Document:

- `ai-drawio canvas document.preview <output-directory>`
- `ai-drawio canvas document.preview <output-directory> --page <n>`
- required positional directory semantics
- JSON path-oriented output behavior

- [ ] **Step 35: Run test to verify it passes**

Run: `npm run test:node -- tests/packaged-tauri-cli-source.test.ts`

Expected: PASS

### Task 16: Run focused regression checks

**Files:**
- Verify: `tests/session-workspace-preview-export-source.test.ts`
- Verify: `tests/session-workspace-svg-export-source.test.ts`
- Verify: `tests/packaged-tauri-cli-source.test.ts`
- Verify: `src-tauri/src/packaged_cli.rs`
- Verify: `src-tauri/src/control_protocol.rs`
- Verify: `src-tauri/src/document_bridge.rs`

- [ ] **Step 36: Run final Node test batch**

Run: `npm run test:node -- tests/session-workspace-preview-export-source.test.ts tests/session-workspace-svg-export-source.test.ts tests/packaged-tauri-cli-source.test.ts`

Expected: PASS

- [ ] **Step 37: Run final Rust preview-focused batch**

Run: `cargo test --manifest-path src-tauri/Cargo.toml document_preview preview_pages writes_preview_pages page_out_of_range -- --nocapture`

Expected: PASS

- [ ] **Step 38: Run full project verification used for completion claims**

Run: `npm run test:node`
Run: `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`

Expected: PASS on both commands

## Notes

- Use `@superpowers/test-driven-development` for every behavior change in this plan.
- Use `@superpowers/verification-before-completion` before claiming the feature is done.
- Keep the first version scoped to PNG preview export only.
- Keep the existing `document.svg` implementation unchanged unless a shared helper extraction is necessary.
- Do not remove or overwrite unrelated worktree changes such as `src-tauri/icons/icon.icns`.
