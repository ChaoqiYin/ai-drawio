# CLI Session Close Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `ai-drawio session close <session-id>` so the CLI can close an already-opened workspace session tab with the same behavior as the detail-page tab close button.

**Architecture:** Extend the packaged CLI and control protocol with a new `session.close` command. The Rust runtime will validate that the persisted session exists and then delegate the actual close action to the frontend shell bridge, which will reuse the existing workspace-session store close logic and reject requests for sessions that are not currently opened.

**Tech Stack:** Rust, Clap, Tauri control server, Next.js shell bridge, Zustand, Node source assertion tests

---

## Chunk 1: CLI And Protocol Contract

### Task 1: Add parser and request support for `session close`

**Files:**
- Modify: `src-tauri/src/cli_schema.rs`
- Modify: `src-tauri/src/packaged_cli.rs`
- Modify: `src-tauri/src/control_protocol.rs`
- Test: `src-tauri/src/packaged_cli.rs`
- Test: `src-tauri/src/control_protocol.rs`

- [ ] **Step 1: Write the failing test**

Add tests that require:
- `session close sess-1` parses successfully
- `session close` without a session id fails
- `build_request_for_command` maps the new CLI command to `session.close`
- `session.close` validates in the control protocol and requires `sessionId`

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml packaged_cli::tests control_protocol::tests`
Expected: FAIL because the parser and protocol do not yet know about `session close`.

- [ ] **Step 3: Write minimal implementation**

Update the Rust CLI and protocol layers so:
- the Clap schema exposes `session close <session-id>`
- `PackagedCliCommand` includes `SessionClose`
- request building emits `session.close`
- `CommandKind` includes `SessionClose`
- `session.close` uses the same `sessionId` validation rule as `session.open`

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml packaged_cli::tests control_protocol::tests`
Expected: PASS

## Chunk 2: Runtime And Shell Bridge

### Task 2: Reuse the detail-page tab close behavior

**Files:**
- Modify: `src-tauri/src/control_server.rs`
- Modify: `src-tauri/src/session_runtime.rs`
- Modify: `app/(internal)/_components/internal-shell-bridge.tsx`
- Test: `tests/internal-shell-bridge-source.test.ts`

- [ ] **Step 1: Write the failing test**

Add source assertions that require:
- the shell bridge exposes `conversationStore.closeSession`
- the bridge reads `useWorkspaceSessionStore.getState().openedSessions`
- the bridge throws `SESSION_NOT_OPEN` before calling the store close method when the target tab is not open
- the bridge reuses `useWorkspaceSessionStore.getState().closeSession`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/internal-shell-bridge-source.test.ts`
Expected: FAIL because the shell bridge does not yet expose CLI close support.

- [ ] **Step 3: Write minimal implementation**

Update the runtime path so:
- `control_server` dispatches `session.close`
- `session_runtime::close_session` checks persisted-session existence first
- the runtime calls `window.__AI_DRAWIO_SHELL__.conversationStore.closeSession(sessionId)`
- the frontend bridge returns a structured success payload on close
- the frontend bridge throws `SESSION_NOT_OPEN` when the tab is not open

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/internal-shell-bridge-source.test.ts`
Expected: PASS

## Chunk 3: Documentation And Source Assertions

### Task 3: Document the new command

**Files:**
- Modify: `README.md`
- Modify: `tests/packaged-tauri-cli-source.test.ts`

- [ ] **Step 1: Write the failing test**

Update source assertions to require:
- `ai-drawio session close <session-id>` in README
- the CLI schema or packaged CLI source references `session close`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/packaged-tauri-cli-source.test.ts`
Expected: FAIL because user-facing docs do not mention `session close`.

- [ ] **Step 3: Write minimal implementation**

Refresh README and source assertions to describe the new close command and its purpose.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/packaged-tauri-cli-source.test.ts`
Expected: PASS

Plan complete and saved to `docs/superpowers/plans/2026-03-21-cli-session-close.md`. Ready to execute?
