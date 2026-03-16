# Local AI Canvas Document Bridge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a companion CLI and local desktop control path that can open the app, switch sessions, fetch the full draw.io XML document, and apply a full replacement XML back into the embedded canvas.

**Architecture:** Add a loopback-only control server inside the Tauri runtime, keep the Next.js session page as the iframe shell, and introduce a document bridge that reads and replaces full XML documents through the existing iframe execution bridge. Expose a small standalone CLI surface for the local AI skill while keeping draw.io runtime details isolated inside a dedicated adapter.

**Tech Stack:** Tauri v2, Rust, Next.js static export, React, Node.js CLI, IndexedDB session store, loopback HTTP, draw.io iframe runtime

---

### Task 1: Probe the embedded draw.io runtime for document get/apply hooks

**Files:**
- Modify: `src-tauri/src/webview_api.rs`
- Modify: `components/session-workspace.js`
- Create: `docs/plans/2026-03-12-drawio-runtime-probe-notes.md`

**Step 1: Write the failing Rust probe tests**

Add tests that define the exact JavaScript wrapper shape needed for:

- reading the current XML document from the iframe runtime
- applying a replacement XML document to the iframe runtime

The tests should fail because the script builders do not exist yet.

**Step 2: Run test to verify it fails**

Run: `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml webview_api -- --nocapture`
Expected: FAIL because the new document probe helpers are not implemented.

**Step 3: Add minimal probe script builders**

Implement temporary script-builder helpers in `src-tauri/src/webview_api.rs` that can execute runtime discovery scripts against the iframe window through `window.__AI_DRAWIO_SHELL__.getFrameWindow()`.

**Step 4: Expose shell probe metadata**

Extend `components/session-workspace.js` so the shell can expose current route, session ID, and iframe readiness in a stable top-level object for debugging and runtime verification.

**Step 5: Run the probe tests and manual discovery**

Run:

- `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml webview_api -- --nocapture`
- `npm run build:web`
- `source ~/.cargo/env && npm run dev`

Expected:

- Rust tests pass
- the desktop app launches
- manual probe notes can be captured in `docs/plans/2026-03-12-drawio-runtime-probe-notes.md`

**Step 6: Commit**

```bash
git add src-tauri/src/webview_api.rs components/session-workspace.js docs/plans/2026-03-12-drawio-runtime-probe-notes.md
git commit -m "test: probe drawio document runtime hooks"
```

### Task 2: Add a typed desktop control protocol

**Files:**
- Create: `src-tauri/src/control_protocol.rs`
- Test: `src-tauri/src/control_protocol.rs`

**Step 1: Write the failing protocol tests**

Add unit tests for:

- request envelope validation
- unsupported command rejection
- empty XML rejection for `canvas.document.apply`
- `baseVersion` field handling

**Step 2: Run test to verify it fails**

Run: `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml control_protocol -- --nocapture`
Expected: FAIL because the module does not exist yet.

**Step 3: Write the minimal protocol types**

Create request and response structs for:

- `open`
- `status`
- `session.open`
- `canvas.document.get`
- `canvas.document.apply`

Include validation helpers and the first-pass error code enum.

**Step 4: Run test to verify it passes**

Run: `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml control_protocol -- --nocapture`
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/src/control_protocol.rs
git commit -m "feat: add desktop control protocol types"
```

### Task 3: Build the local loopback control server

**Files:**
- Create: `src-tauri/src/control_server.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/Cargo.toml`
- Test: `src-tauri/src/control_server.rs`

**Step 1: Write the failing server tests**

Add tests for:

- loopback binding only
- JSON request parsing
- command routing to stub handlers
- structured error responses

**Step 2: Run test to verify it fails**

Run: `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml control_server -- --nocapture`
Expected: FAIL because the control server is not implemented.

**Step 3: Add the minimal server implementation**

Create a small HTTP server that:

- binds to `127.0.0.1`
- accepts JSON POST requests
- deserializes the envelope from `control_protocol`
- dispatches to internal handlers
- returns structured JSON

Update `src-tauri/src/main.rs` to start the server during app bootstrap and manage shutdown cleanly.

**Step 4: Run test to verify it passes**

Run: `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml control_server -- --nocapture`
Expected: PASS

**Step 5: Run a compile check**

Run: `source ~/.cargo/env && cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS

**Step 6: Commit**

```bash
git add src-tauri/src/control_server.rs src-tauri/src/main.rs src-tauri/Cargo.toml
git commit -m "feat: add loopback desktop control server"
```

### Task 4: Add session runtime state and desktop status handling

**Files:**
- Modify: `components/session-workspace.js`
- Create: `src-tauri/src/session_runtime.rs`
- Modify: `src-tauri/src/main.rs`
- Test: `src-tauri/src/session_runtime.rs`

**Step 1: Write the failing state tests**

Add Rust tests for:

- session route URL generation
- session state parsing from injected page metadata
- iframe readiness validation

**Step 2: Run test to verify it fails**

Run: `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml session_runtime -- --nocapture`
Expected: FAIL because the runtime state module does not exist.

**Step 3: Expose stable shell state**

Extend `components/session-workspace.js` to publish a stable shell state object with:

- current route
- active `sessionId`
- iframe ready state
- document bridge availability

**Step 4: Implement session runtime helpers**

Create `src-tauri/src/session_runtime.rs` helpers that:

- navigate the main window to `/session?id=...`
- query page state through the existing eval bridge
- verify the active session before document operations

**Step 5: Run test to verify it passes**

Run: `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml session_runtime -- --nocapture`
Expected: PASS

**Step 6: Commit**

```bash
git add components/session-workspace.js src-tauri/src/session_runtime.rs src-tauri/src/main.rs
git commit -m "feat: add session runtime state bridge"
```

### Task 5: Implement the draw.io document adapter

**Files:**
- Create: `src-tauri/src/drawio_adapter.rs`
- Modify: `src-tauri/src/webview_api.rs`
- Test: `src-tauri/src/drawio_adapter.rs`

**Step 1: Write the failing adapter tests**

Add tests for:

- document-read script generation
- document-apply script generation
- empty XML rejection
- structured parseable return payloads

**Step 2: Run test to verify it fails**

Run: `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml drawio_adapter -- --nocapture`
Expected: FAIL because the adapter module does not exist.

**Step 3: Implement the minimal adapter**

Create `src-tauri/src/drawio_adapter.rs` with two public operations:

- `get_current_document`
- `apply_document`

Keep all draw.io runtime assumptions isolated inside this module.
Reuse `webview_api` helpers for iframe-targeted execution.

**Step 4: Run test to verify it passes**

Run: `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml drawio_adapter -- --nocapture`
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/src/drawio_adapter.rs src-tauri/src/webview_api.rs
git commit -m "feat: add drawio document adapter"
```

### Task 6: Implement the document service with optimistic concurrency

**Files:**
- Create: `src-tauri/src/document_bridge.rs`
- Modify: `src-tauri/src/main.rs`
- Test: `src-tauri/src/document_bridge.rs`

**Step 1: Write the failing document service tests**

Add tests for:

- version generation from XML
- `baseVersion` mismatch rejection
- get/apply happy path with stub adapter responses
- structured error mapping

**Step 2: Run test to verify it fails**

Run: `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml document_bridge -- --nocapture`
Expected: FAIL because the module does not exist.

**Step 3: Implement the minimal document service**

Create `src-tauri/src/document_bridge.rs` that:

- computes `sha256(xml)`
- validates `baseVersion`
- delegates reads and writes to `drawio_adapter`
- returns `canvas.document.get` and `canvas.document.apply` results

**Step 4: Run test to verify it passes**

Run: `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml document_bridge -- --nocapture`
Expected: PASS

**Step 5: Run compile verification**

Run: `source ~/.cargo/env && cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS

**Step 6: Commit**

```bash
git add src-tauri/src/document_bridge.rs src-tauri/src/main.rs
git commit -m "feat: add document bridge service"
```

### Task 7: Build the companion CLI

**Files:**
- Create: `scripts/ai-drawio-cli.mjs`
- Modify: `package.json`
- Create: `tests/ai-drawio-cli.test.mjs`

**Step 1: Write the failing CLI tests**

Add Node tests for:

- command parsing for `open`, `status`, `session open`
- XML input from `--xml-file`
- XML input from `--xml-stdin`
- JSON output shape

**Step 2: Run test to verify it fails**

Run: `node --test tests/ai-drawio-cli.test.mjs`
Expected: FAIL because the CLI script does not exist.

**Step 3: Implement the minimal CLI**

Create a Node-based CLI that:

- sends control requests to the local loopback server
- starts the desktop app if needed
- supports stdout JSON responses
- supports file and stdin XML input

Expose it through `package.json` scripts first; later it can be packaged as a standalone executable if needed.

**Step 4: Run test to verify it passes**

Run: `node --test tests/ai-drawio-cli.test.mjs`
Expected: PASS

**Step 5: Run the full Node test suite**

Run: `npm run test:node`
Expected: PASS

**Step 6: Commit**

```bash
git add scripts/ai-drawio-cli.mjs package.json tests/ai-drawio-cli.test.mjs
git commit -m "feat: add ai drawio companion cli"
```

### Task 8: Wire the control server handlers end to end

**Files:**
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/src/control_server.rs`
- Modify: `src-tauri/src/document_bridge.rs`
- Modify: `src-tauri/src/session_runtime.rs`
- Test: `src-tauri/src/control_server.rs`

**Step 1: Write the failing integration-style handler tests**

Add tests covering:

- `status`
- `session.open`
- `canvas.document.get`
- `canvas.document.apply`

Use stubbed runtime services where necessary.

**Step 2: Run test to verify it fails**

Run: `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml control_server -- --nocapture`
Expected: FAIL because handlers are not fully wired.

**Step 3: Implement handler routing**

Connect the control server to:

- app lifecycle helpers
- session runtime helpers
- document bridge service

Return the final response envelope for every supported command.

**Step 4: Run test to verify it passes**

Run: `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml control_server -- --nocapture`
Expected: PASS

**Step 5: Run the full verification sequence**

Run:

- `npm run build:web`
- `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `source ~/.cargo/env && cargo check --manifest-path src-tauri/Cargo.toml`

Expected:

- Next static export passes
- Rust tests pass
- compile check passes

**Step 6: Commit**

```bash
git add src-tauri/src/main.rs src-tauri/src/control_server.rs src-tauri/src/document_bridge.rs src-tauri/src/session_runtime.rs
git commit -m "feat: wire desktop document control flow"
```

### Task 9: Document the operator workflow

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-03-12-local-ai-canvas-document-bridge-design.md`

**Step 1: Write the failing documentation checklist**

Create a short checklist of missing operator guidance:

- how to open the app from the CLI
- how to read XML
- how to apply XML with `baseVersion`
- what error codes mean

**Step 2: Update the docs**

Document:

- the CLI command surface
- the document-driven workflow
- the concurrency/version model
- the known runtime limitations

**Step 3: Run the final verification sequence**

Run:

- `npm run build:web`
- `npm run test:node`
- `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `source ~/.cargo/env && cargo check --manifest-path src-tauri/Cargo.toml`

Expected: all commands pass

**Step 4: Commit**

```bash
git add README.md docs/plans/2026-03-12-local-ai-canvas-document-bridge-design.md
git commit -m "docs: describe local ai document control flow"
```
