# CLI Auto Session Ensure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make CLI document commands automatically acquire a ready session detail page, while keeping `--session` as an optional strict target override.

**Architecture:** Add a desktop-side `session.ensure` control command that centralizes app launch, session creation, route navigation, and readiness waiting. Update the CLI so document commands default to `session.ensure` when `--session` is omitted, and keep explicit `--session` on a strict `session.open` path that never creates a different session.

**Tech Stack:** TypeScript, Next.js App Router, React, IndexedDB, Rust, Tauri, Node test runner

---

### Task 1: Add failing CLI parser tests for optional session handling

**Files:**
- Modify: `tests/ai-drawio-cli.test.ts`
- Test: `tests/ai-drawio-cli.test.ts`

**Step 1: Write the failing test**

Add tests that verify:

- `canvas document.get` parses without `--session`
- `canvas document.apply --xml-file ./next.xml` parses without `--session`
- existing explicit `--session` parsing still works

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/ai-drawio-cli.test.ts`
Expected: FAIL because the parser still requires the old document command shape.

**Step 3: Write minimal implementation**

Update `scripts/ai-drawio-cli.ts` parsing logic so document commands accept omitted `--session`.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/ai-drawio-cli.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/ai-drawio-cli.test.ts scripts/ai-drawio-cli.ts
git commit -m "test: allow document commands without session ids"
```

### Task 2: Add failing Rust control tests for the new command contract

**Files:**
- Modify: `src-tauri/src/control_protocol.rs`
- Test: `src-tauri/src/control_protocol.rs`

**Step 1: Write the failing test**

Add a unit test asserting `conversation.create` still validates and a new unit test asserting `session.ensure` validates without a session id.

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml control_protocol::tests::validates_session_ensure_requests -- --nocapture`
Expected: FAIL because `session.ensure` is unsupported.

**Step 3: Write minimal implementation**

Add `SessionEnsure` to `CommandKind`, map `"session.ensure"` to it, and allow validation without `session_id`.

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml control_protocol::tests::validates_session_ensure_requests -- --nocapture`
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/src/control_protocol.rs
git commit -m "feat: add session ensure control command"
```

### Task 3: Add failing source tests for shared shell session orchestration helpers

**Files:**
- Create: `tests/internal-shell-bridge-source.test.ts`
- Modify: `tests/conversation-store-api.test.ts`
- Test: `tests/internal-shell-bridge-source.test.ts`
- Test: `tests/conversation-store-api.test.ts`

**Step 1: Write the failing source test**

Assert that [app/(internal)/_components/internal-shell-bridge.tsx](/Users/admin/workspace/other/ai-drawio/app/(internal)/_components/internal-shell-bridge.tsx) exposes helpers for:

- creating a conversation
- checking whether a conversation id exists
- reading current route/session state

**Step 2: Write the failing store export test**

Assert the store exports a boolean-style existence helper for conversation ids.

**Step 3: Run tests to verify they fail**

Run: `node --experimental-strip-types --test tests/internal-shell-bridge-source.test.ts tests/conversation-store-api.test.ts`
Expected: FAIL because the existence helper and bridge wiring do not exist yet.

**Step 4: Write minimal implementation**

Add:

- `hasConversation(id: string): Promise<boolean>` in [app/(internal)/_lib/conversation-store.ts](/Users/admin/workspace/other/ai-drawio/app/(internal)/_lib/conversation-store.ts)
- shell bridge methods in [app/(internal)/_components/internal-shell-bridge.tsx](/Users/admin/workspace/other/ai-drawio/app/(internal)/_components/internal-shell-bridge.tsx)

**Step 5: Run tests to verify they pass**

Run: `node --experimental-strip-types --test tests/internal-shell-bridge-source.test.ts tests/conversation-store-api.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add tests/internal-shell-bridge-source.test.ts tests/conversation-store-api.test.ts app/(internal)/_lib/conversation-store.ts app/(internal)/_components/internal-shell-bridge.tsx
git commit -m "feat: expose shared shell session helpers"
```

### Task 4: Add failing runtime tests for session readiness orchestration

**Files:**
- Modify: `src-tauri/src/session_runtime.rs`
- Test: `src-tauri/src/session_runtime.rs`

**Step 1: Write the failing test**

Add focused unit tests for helper functions that:

- detect whether a route is a session detail route
- extract the active session id from shell state
- decide whether the current shell state is reusable

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml session_runtime::tests::reuses_ready_session_route -- --nocapture`
Expected: FAIL because the helper logic does not exist yet.

**Step 3: Write minimal implementation**

In [src-tauri/src/session_runtime.rs](/Users/admin/workspace/other/ai-drawio/src-tauri/src/session_runtime.rs):

- add helper functions for route/session reuse checks
- add `ensure_session(...)`
- tighten `open_session(...)` to fail if the requested session does not exist

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml session_runtime::tests::reuses_ready_session_route -- --nocapture`
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/src/session_runtime.rs
git commit -m "feat: centralize automatic session readiness flow"
```

### Task 5: Wire the new command through the control server

**Files:**
- Modify: `src-tauri/src/control_server.rs`
- Test: `src-tauri/src/control_protocol.rs`
- Test: `src-tauri/src/session_runtime.rs`

**Step 1: Write the failing integration-oriented test**

Add a test or assertion coverage path that the new `SessionEnsure` command reaches runtime handling.

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
Expected: FAIL because `control_server` does not dispatch `SessionEnsure`.

**Step 3: Write minimal implementation**

Route `SessionEnsure` to `session_runtime::ensure_session(...)`.

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/src/control_server.rs src-tauri/src/control_protocol.rs src-tauri/src/session_runtime.rs
git commit -m "feat: dispatch session ensure in control server"
```

### Task 6: Make CLI document commands use automatic session resolution

**Files:**
- Modify: `scripts/ai-drawio-cli.ts`
- Modify: `tests/ai-drawio-cli.test.ts`
- Test: `tests/ai-drawio-cli.test.ts`

**Step 1: Write the failing behavior test**

Add tests for command-envelope selection logic:

- no `--session` -> document command should first resolve through `session.ensure`
- with `--session` -> document command should still honor strict target opening

If needed, extract a small pure helper in the CLI to make this testable.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/ai-drawio-cli.test.ts`
Expected: FAIL because document commands still directly hit control endpoints with nullable session ids.

**Step 3: Write minimal implementation**

Update CLI execution flow so:

- `canvas document.get/apply` without `--session` first calls `session.ensure`
- `canvas document.get/apply` with `--session` first calls `session.open`
- later document request uses the ensured/opened session id

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/ai-drawio-cli.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/ai-drawio-cli.ts tests/ai-drawio-cli.test.ts
git commit -m "feat: auto-resolve session for CLI document commands"
```

### Task 7: Verify end-to-end flows against the live desktop shell

**Files:**
- Modify: `README.md`

**Step 1: Start the app**

Run: `npm run dev`
Expected: Next dev server and Tauri app both start successfully.

**Step 2: Verify automatic read flow from home**

Run: `node --experimental-strip-types ./scripts/ai-drawio-cli.ts canvas document.get`
Expected: PASS and returns a real session id plus XML.

**Step 3: Verify automatic apply flow from home**

Run: `node --experimental-strip-types ./scripts/ai-drawio-cli.ts canvas document.apply --xml-file /tmp/updated.drawio`
Expected: PASS and returns updated XML/version.

**Step 4: Verify reuse flow from an active session**

Run the same get/apply commands again without `--session`.
Expected: Reuses the current session instead of creating a second one.

**Step 5: Verify explicit failure mode**

Run: `node --experimental-strip-types ./scripts/ai-drawio-cli.ts canvas document.get --session missing-session-id`
Expected: FAIL with a direct missing-session error.

**Step 6: Update CLI docs**

Document the new default behavior and the strict semantics of `--session`.

**Step 7: Run regression checks**

Run:

```bash
npm run test:node
cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: All pass.

**Step 8: Commit**

```bash
git add README.md scripts/ai-drawio-cli.ts tests src-tauri
git commit -m "feat: auto-open ready sessions for CLI document commands"
```
