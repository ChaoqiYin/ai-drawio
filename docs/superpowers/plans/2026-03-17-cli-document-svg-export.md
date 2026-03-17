# CLI Document SVG Export Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `canvas document.svg` so the CLI can export all pages of the resolved draw.io document as SVG, optionally writing one `.svg` file per page into an output directory.

**Architecture:** Extend the existing CLI and control-server pipeline instead of introducing a parallel export path. The Node CLI, packaged Tauri CLI, Rust control protocol, and the draw.io bridge will all gain one aligned command that returns `pages[]` and optionally maps those pages to output files.

**Tech Stack:** Node.js CLI, TypeScript, Rust, Tauri, Next.js/React, Node test runner, Rust unit tests

---

## Chunk 1: CLI Parsing and Node Output Handling

### Task 1: Add failing Node CLI tests for `canvas document.svg`

**Files:**
- Modify: `tests/ai-drawio-cli.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests that require:

- `parseCliArgs(["canvas", "document.svg"])` to produce `command: "canvas.document.svg"`
- `parseCliArgs(["canvas", "document.svg", "--session", "sess-1", "--output-file", "./exports"])` to capture session id and output directory
- `parseCliArgs(["canvas", "document.svg", "--session-title", "Alpha"])` to capture title lookup
- `getSessionResolutionCommand(...)` to accept `canvas.document.svg` like other document commands

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:node -- tests/ai-drawio-cli.test.ts`

Expected: FAIL because `document.svg` is not parsed or treated as a session-resolved command yet.

### Task 2: Implement Node CLI parsing for `canvas document.svg`

**Files:**
- Modify: `scripts/ai-drawio-cli.ts`

- [ ] **Step 3: Write minimal implementation**

Update `scripts/ai-drawio-cli.ts` to:

- allow `canvas document.svg`
- reuse `--session`, `--session-title`, and `--output-file`
- include `"canvas.document.svg"` in session resolution handling
- build an empty payload control envelope for the new command

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:node -- tests/ai-drawio-cli.test.ts`

Expected: PASS

### Task 3: Add failing Node CLI output-directory behavior test

**Files:**
- Modify: `tests/ai-drawio-cli.test.ts`

- [ ] **Step 5: Write the failing test**

Add a focused test for a helper or execution path that:

- receives a response payload with multiple SVG pages
- writes `01-...svg`, `02-...svg` into a target directory
- annotates the JSON payload with `outputPath`

Prefer extracting a small helper from `scripts/ai-drawio-cli.ts` so the test can verify real behavior without requiring a live control server.

- [ ] **Step 6: Run test to verify it fails**

Run: `npm run test:node -- tests/ai-drawio-cli.test.ts`

Expected: FAIL because the directory-writing helper does not exist yet.

### Task 4: Implement Node CLI directory export behavior

**Files:**
- Modify: `scripts/ai-drawio-cli.ts`

- [ ] **Step 7: Write minimal implementation**

Add helper logic to:

- create the output directory recursively
- sanitize page names for filesystem-safe filenames
- write one `.svg` file per page for `canvas.document.svg`
- add `outputPath` to each written page object

Keep existing XML output handling unchanged for `document.get` and `document.apply`.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm run test:node -- tests/ai-drawio-cli.test.ts`

Expected: PASS

## Chunk 2: Rust Control Protocol and Packaged CLI

### Task 5: Add failing Rust tests for the new control command

**Files:**
- Modify: `src-tauri/src/control_protocol.rs`
- Modify: `src-tauri/src/cli_schema.rs`
- Modify: `src-tauri/src/packaged_cli.rs`

- [ ] **Step 9: Write the failing tests**

Add tests that require:

- `canvas.document.svg` to be a supported `CommandKind`
- validation to require session resolution for that command
- packaged CLI schema to expose `document.svg`
- packaged CLI parser to accept `canvas document.svg`
- packaged CLI resolution builder to treat it like `document.get`

- [ ] **Step 10: Run tests to verify they fail**

Run: `cargo test --manifest-path src-tauri/Cargo.toml control_protocol packaged_cli cli_schema -- --nocapture`

Expected: FAIL because the Rust protocol and packaged CLI do not know about `document.svg` yet.

### Task 6: Implement Rust command parsing and request construction

**Files:**
- Modify: `src-tauri/src/control_protocol.rs`
- Modify: `src-tauri/src/cli_schema.rs`
- Modify: `src-tauri/src/packaged_cli.rs`

- [ ] **Step 11: Write minimal implementation**

Update Rust code to:

- add `CanvasDocumentSvg` to `CommandKind`
- validate it as a document-read command requiring session resolution
- expose `document.svg` in the packaged CLI schema
- add a `PackagedCliCommand::CanvasDocumentSvg` variant
- make packaged CLI request/resolution/output handling understand the new command

- [ ] **Step 12: Run tests to verify they pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml control_protocol packaged_cli cli_schema -- --nocapture`

Expected: PASS

## Chunk 3: SVG Export Bridge and Control Routing

### Task 7: Add failing source or unit tests for page-level SVG export routing

**Files:**
- Modify: existing relevant tests under `tests/`
- Modify: `src-tauri/src/control_server.rs`
- Modify: `src-tauri/src/document_bridge.rs`

- [ ] **Step 13: Write the failing tests**

Add focused coverage that requires:

- control server routing `canvas.document.svg`
- document bridge returning `pages[]`
- payload entries to include page id, page name, and svg text

Use the lightest-weight test surface available in the repository:

- Rust unit tests where routing is already covered in Rust
- source-level tests where the draw.io bridge is currently verified by source inspection

- [ ] **Step 14: Run tests to verify they fail**

Run: `npm run test:node -- tests/session-workspace-restore-preview-source.test.ts`
Run: `cargo test --manifest-path src-tauri/Cargo.toml control_server document_bridge -- --nocapture`

Expected: at least one FAIL showing the new export path is missing.

### Task 8: Implement SVG export bridge and control routing

**Files:**
- Modify: `app/(internal)/_components/session-workspace.tsx`
- Modify: `src-tauri/src/document_bridge.rs`
- Modify: `src-tauri/src/control_server.rs`

- [ ] **Step 15: Write minimal implementation**

Implement a reusable SVG export path that:

- uses the embedded draw.io runtime to export all pages for the active document
- returns raw SVG strings, not data URIs
- exposes a shell bridge function callable from Rust control code
- routes `canvas.document.svg` through the control server to that bridge

Reuse existing preview export behavior where possible instead of creating a second renderer.

- [ ] **Step 16: Run tests to verify they pass**

Run: `npm run test:node -- tests/session-workspace-restore-preview-source.test.ts`
Run: `cargo test --manifest-path src-tauri/Cargo.toml control_server document_bridge -- --nocapture`

Expected: PASS

## Chunk 4: Full Verification

### Task 9: Run focused regression checks

**Files:**
- Verify: `tests/ai-drawio-cli.test.ts`
- Verify: `src-tauri/src/control_protocol.rs`
- Verify: `src-tauri/src/packaged_cli.rs`
- Verify: source tests touching `session-workspace.tsx`

- [ ] **Step 17: Run final Node test batch**

Run: `npm run test:node -- tests/ai-drawio-cli.test.ts tests/session-workspace-restore-preview-source.test.ts`

Expected: PASS

- [ ] **Step 18: Run final Rust test batch**

Run: `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`

Expected: PASS

- [ ] **Step 19: Run combined project verification used for claims**

Run: `npm run test:node`
Run: `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`

Expected: PASS on both commands

## Notes

- Do not commit unless the user explicitly asks.
- Keep the first version scoped to exporting all pages only.
- Keep `--output-file` semantics command-specific: file path for XML commands, directory path for `document.svg`.
- Prefer extracting small helpers in `scripts/ai-drawio-cli.ts` if needed to keep tests precise and avoid overgrowing `executeCli`.
