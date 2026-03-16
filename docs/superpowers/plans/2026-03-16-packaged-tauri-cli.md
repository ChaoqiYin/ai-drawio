# Packaged Tauri CLI Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the approved `ai-drawio` command surface into the packaged Tauri binary, preserve the existing JSON contract, and generate shell completion files during desktop builds.

**Architecture:** Keep the current control protocol as the compatibility backbone. Add a Rust CLI parsing and execution layer that reads Tauri CLI plugin matches, forwards to an already running control server when available, and otherwise executes commands inside the current app instance. Generate completion files from the same command model during build so command parsing and completions stay aligned.

**Tech Stack:** Rust, Tauri v2, `tauri-plugin-cli`, existing local control server, Node test runner, Cargo unit tests

---

## Chunk 1: CLI Model And Parser

### Task 1: Add failing Rust tests for the approved CLI command surface

**Files:**
- Create: `src-tauri/src/packaged_cli.rs`
- Modify: `src-tauri/Cargo.toml`
- Test: `src-tauri/src/packaged_cli.rs`

- [ ] **Step 1: Write the failing tests**

Add parser-focused unit tests for:
- `session open <session-id>`
- `session open --title <session-title>`
- `canvas document.apply <xml-file>`
- `canvas document.apply --xml-stdin`
- invalid mutual exclusion cases

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml packaged_cli -- --nocapture`
Expected: FAIL because `packaged_cli.rs` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `src-tauri/src/packaged_cli.rs` with:
- internal CLI command structs
- Tauri plugin match extraction helpers
- translation into existing control request shapes

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml packaged_cli -- --nocapture`
Expected: PASS

## Chunk 2: Runtime Execution And Existing-Instance Forwarding

### Task 2: Add failing tests for execution routing

**Files:**
- Modify: `src-tauri/src/control_server.rs`
- Modify: `src-tauri/src/main.rs`
- Test: `src-tauri/src/control_server.rs`
- Test: `src-tauri/src/packaged_cli.rs`

- [ ] **Step 1: Write the failing tests**

Add tests for:
- control-server bind conflicts are detectable without panicking
- CLI command execution can route to an existing instance through HTTP
- `canvas document.get/apply` preserve current session-resolution behavior

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml control_server packaged_cli -- --nocapture`
Expected: FAIL because routing helpers and conflict handling do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement:
- `start_control_server` conflict detection
- local HTTP client helper for forwarding control requests
- startup logic in `main.rs` that:
  - installs `tauri-plugin-cli`
  - reads command matches
  - forwards to the existing instance when the port is already taken
  - otherwise executes against the current app instance
  - prints JSON output and exits for CLI invocations

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml control_server packaged_cli -- --nocapture`
Expected: PASS

## Chunk 3: Build Integration And Completion Output

### Task 3: Add failing tests for build-time completion generation and config wiring

**Files:**
- Modify: `src-tauri/build.rs`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `README.md`
- Test: `tests/packaged-tauri-cli-source.test.ts`

- [ ] **Step 1: Write the failing test**

Add a source-level Node test that checks for:
- `tauri-plugin-cli` registration
- approved CLI schema in `src-tauri/tauri.conf.json`
- build-time completion generation hooks

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/packaged-tauri-cli-source.test.ts`
Expected: FAIL because the CLI plugin and completion hooks are not wired yet.

- [ ] **Step 3: Write minimal implementation**

Implement:
- CLI schema in `src-tauri/tauri.conf.json`
- `tauri-plugin-cli` and completion dependencies in `src-tauri/Cargo.toml`
- build-time completion generation in `src-tauri/build.rs`
- README updates for packaged binary usage and completion artifact location

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:node -- tests/packaged-tauri-cli-source.test.ts`
Expected: PASS

## Chunk 4: Full Verification

### Task 4: Run the project verifications for the packaged CLI change

**Files:**
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/src/control_server.rs`
- Modify: `src-tauri/src/packaged_cli.rs`
- Modify: `src-tauri/build.rs`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `README.md`
- Test: `tests/packaged-tauri-cli-source.test.ts`

- [ ] **Step 1: Run targeted Node tests**

Run: `npm run test:node -- tests/ai-drawio-cli.test.ts tests/packaged-tauri-cli-source.test.ts`
Expected: PASS

- [ ] **Step 2: Run targeted Rust tests**

Run: `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml packaged_cli control_server -- --nocapture`
Expected: PASS

- [ ] **Step 3: Run Rust type/build verification**

Run: `source ~/.cargo/env && cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 4: Run the full existing Node suite**

Run: `npm run test:node`
Expected: PASS
