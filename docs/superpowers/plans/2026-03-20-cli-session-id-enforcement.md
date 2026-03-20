# CLI Session ID Enforcement Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require explicit session IDs for CLI session-targeted commands, add `session create`, and remove CLI-side auto session resolution.

**Architecture:** The CLI parser will move all existing session-targeted commands to positional `session-id` arguments. The packaged CLI executor will stop using title or `session.ensure` resolution, add a `session create` orchestration path, and keep runtime readiness checks limited to `session open` and `canvas.document.*`.

**Tech Stack:** Rust, Clap, Tauri control server, Node source assertion tests

---

## Chunk 1: Parser Contract

### Task 1: Update CLI schema for positional session IDs

**Files:**
- Modify: `src-tauri/src/cli_schema.rs`
- Test: `src-tauri/src/packaged_cli.rs`

- [ ] **Step 1: Write the failing test**

Add parser tests that expect:
- `session create` parses successfully
- `session open --title Alpha` fails
- `canvas document.get` without a session ID fails
- `canvas document.get sess-1` parses successfully
- `canvas document.apply sess-1 "prompt" ...` parses successfully

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml packaged_cli::tests`
Expected: FAIL because the old parser still supports title and omitted session lookup.

- [ ] **Step 3: Write minimal implementation**

Change the Clap schema so:
- `session` gains `create`
- `session open` accepts only positional `session-id`
- every `canvas document.*` subcommand requires a positional `session-id`
- old `--session`, `--session-title`, and `--title` flags are removed

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml packaged_cli::tests`
Expected: PASS for the new parser coverage.

## Chunk 2: CLI Execution Flow

### Task 2: Remove CLI-side title and ensure resolution

**Files:**
- Modify: `src-tauri/src/packaged_cli.rs`
- Test: `src-tauri/src/packaged_cli.rs`

- [ ] **Step 1: Write the failing test**

Add execution/request-building tests that expect:
- `session create` becomes a first-class CLI command
- `build_resolution_request` always produces `session.open` for canvas commands
- no canvas command can produce `session.ensure`

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml packaged_cli::tests`
Expected: FAIL because the old executor still has optional locators and `session.ensure`.

- [ ] **Step 3: Write minimal implementation**

Update the packaged CLI command model and execution flow so:
- `session create` first sends `conversation.create`, then `session.open`, then returns a `session.create` response
- `session open` only supports ID-based requests
- `canvas` commands always resolve readiness through `session.open`
- request builders only pass explicit session IDs

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml packaged_cli::tests`
Expected: PASS for request-building and execution-path coverage.

## Chunk 3: User-Facing Docs

### Task 3: Update README and source assertions

**Files:**
- Modify: `README.md`
- Modify: `tests/packaged-tauri-cli-source.test.ts`

- [ ] **Step 1: Write the failing test**

Update source assertion tests to require:
- `session create`
- `session open <session-id>`
- `canvas document.get <session-id>`
- `canvas document.apply <session-id> <prompt>`
- removal of title-based examples

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/packaged-tauri-cli-source.test.ts`
Expected: FAIL because the README and assertions still describe old command forms.

- [ ] **Step 3: Write minimal implementation**

Refresh README examples and source assertions to match the new CLI contract.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/packaged-tauri-cli-source.test.ts`
Expected: PASS

Plan complete and saved to `docs/superpowers/plans/2026-03-20-cli-session-id-enforcement.md`. Ready to execute?
