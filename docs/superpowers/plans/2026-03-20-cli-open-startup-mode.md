# CLI Open Startup Mode Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `ai-drawio open --mode <tray|window>` so the CLI can launch the desktop app with a one-time startup mode override that defaults to tray mode.

**Architecture:** Extend the packaged CLI parser with a new top-level `open` command and a small `OpenMode` enum. When the desktop app is not already running, the CLI spawns a fresh copy of the packaged binary without CLI arguments and passes a transient environment override into Tauri startup. The tray runtime reads that override during setup and app-ready checks without persisting it into the stored tray preference.

**Tech Stack:** Rust, Tauri, Clap, Node source tests

---

## Chunk 1: CLI surface and launch path

### Task 1: Add the CLI contract first

**Files:**
- Modify: `src-tauri/src/cli_schema.rs`
- Modify: `src-tauri/src/packaged_cli.rs`
- Test: `tests/packaged-tauri-cli-source.test.ts`

- [ ] **Step 1: Write the failing test**
  Add assertions that the packaged CLI exposes a top-level `open` command, supports `--mode`, defaults to `tray`, and no longer rejects `PackagedCliCommand::Open`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm run test -- tests/packaged-tauri-cli-source.test.ts`
  Expected: FAIL because the source still lacks the `open` command and mode parsing.

- [ ] **Step 3: Write minimal implementation**
  Add `OpenMode` and `PackagedCliCommand::Open`, parse `ai-drawio open --mode <tray|window>`, and teach CLI execution to either return a no-op success when already running or spawn a new GUI instance with a transient startup override when the app is not running.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm run test -- tests/packaged-tauri-cli-source.test.ts`
  Expected: PASS

## Chunk 2: One-time startup mode override

### Task 2: Cover tray/window startup override behavior at source level

**Files:**
- Modify: `src-tauri/src/tray_settings.rs`
- Modify: `src-tauri/src/main.rs`
- Test: `tests/tauri-tray-runtime-source.test.ts`

- [ ] **Step 1: Write the failing test**
  Add assertions for a transient startup mode override path that can force tray startup or window startup without rewriting the persisted tray preference.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm run test -- tests/tauri-tray-runtime-source.test.ts`
  Expected: FAIL because startup still only reads the persisted tray preference.

- [ ] **Step 3: Write minimal implementation**
  Add a startup override reader plus effective-mode helpers in `tray_settings.rs`, use them from `setup_tray`, `should_show_main_window_on_app_ready`, and any tray settings state helpers, and keep persistence writes unchanged.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm run test -- tests/tauri-tray-runtime-source.test.ts`
  Expected: PASS

## Chunk 3: Documentation and verification

### Task 3: Document the new command and verify the targeted suite

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update docs**
  Document `ai-drawio open`, its default tray mode, and the explicit `--mode window` escape hatch.

- [ ] **Step 2: Run focused verification**
  Run: `npm run test -- tests/packaged-tauri-cli-source.test.ts tests/tauri-tray-runtime-source.test.ts`
  Expected: PASS
