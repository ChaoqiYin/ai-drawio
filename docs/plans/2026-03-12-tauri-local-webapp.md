# Tauri Local Webapp Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a minimal Tauri shell that loads `webapp/index.html` from bundled local assets and lets Rust call globally reachable page methods on demand.

**Architecture:** Add a standalone `src-tauri/` project and point Tauri `frontendDist` at `../webapp` so the existing static site is embedded without modification. Keep runtime method invocation in a dedicated Rust module that builds a safe JavaScript wrapper and executes it against the main webview window.

**Tech Stack:** Tauri v2, Rust, Cargo, local static HTML/JS assets, npm for Tauri CLI

---

### Task 1: Bootstrap the Tauri shell files

**Files:**
- Create: `package.json`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/src/main.rs`

**Step 1: Write the failing shell verification**

Create a placeholder Rust app entry that does not yet compile because the Tauri crate and config files do not exist together.

```rust
fn main() {
  ai_drawio_tauri::run();
}
```

**Step 2: Run verification to confirm the shell is incomplete**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: FAIL because the manifest and source layout are not complete yet.

**Step 3: Write the minimal shell scaffolding**

Add:

- `package.json` with a `tauri` script using `@tauri-apps/cli`
- `src-tauri/Cargo.toml` with `tauri`, `serde`, and `serde_json`
- `src-tauri/build.rs` using `tauri_build::build()`
- `src-tauri/tauri.conf.json` with `build.frontendDist` set to `../webapp`
- `src-tauri/src/main.rs` that starts the Tauri app

`src-tauri/tauri.conf.json` should include this core shape:

```json
{
  "$schema": "../node_modules/@tauri-apps/cli/config.schema.json",
  "productName": "AI Drawio",
  "version": "0.1.0",
  "identifier": "com.example.ai-drawio",
  "build": {
    "frontendDist": "../webapp"
  }
}
```

**Step 4: Run verification to confirm the shell compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS

**Step 5: Commit**

```bash
git add package.json src-tauri/Cargo.toml src-tauri/build.rs src-tauri/tauri.conf.json src-tauri/src/main.rs
git commit -m "feat: bootstrap tauri shell"
```

### Task 2: Add a test-first JavaScript invocation helper

**Files:**
- Create: `src-tauri/src/webview_api.rs`
- Modify: `src-tauri/src/main.rs`

**Step 1: Write the failing tests**

Add unit tests for a helper that builds the evaluated JavaScript payload from a method path and argument list.

```rust
#[test]
fn builds_a_call_for_a_nested_global_method() {
  let script = build_method_call_script("App.actions.openFile", &serde_json::json!(["demo.drawio"])).unwrap();
  assert!(script.contains("App.actions.openFile"));
}

#[test]
fn rejects_an_empty_method_path() {
  let error = build_method_call_script("", &serde_json::json!([])).unwrap_err();
  assert!(error.contains("method path"));
}
```

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml webview_api -- --nocapture`
Expected: FAIL because `webview_api` and `build_method_call_script` do not exist.

**Step 3: Write minimal implementation**

Implement a Rust module that:

- validates the method path
- serializes arguments with `serde_json`
- builds a JavaScript function wrapper that:
  - resolves the method path from `window`
  - checks the target exists
  - checks the target is callable
  - calls it with the owner object as `this`
  - serializes a structured result

Core shape:

```rust
pub fn build_method_call_script(method_path: &str, args: &serde_json::Value) -> Result<String, String> {
  if method_path.trim().is_empty() {
    return Err("method path cannot be empty".into());
  }

  let path = serde_json::to_string(method_path).map_err(|err| err.to_string())?;
  let args = serde_json::to_string(args).map_err(|err| err.to_string())?;

  Ok(format!("(() => {{ /* resolve from window and call */ }})({}, {})", path, args))
}
```

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml webview_api -- --nocapture`
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/src/webview_api.rs src-tauri/src/main.rs
git commit -m "feat: add webview method call helper"
```

### Task 3: Wire the helper into the main window

**Files:**
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/src/webview_api.rs`

**Step 1: Write the failing test**

Add a unit test for the Rust-side API that validates window label lookup and forwards the generated script.

```rust
#[test]
fn script_builder_output_contains_structured_result_fields() {
  let script = build_method_call_script("myGlobalFn", &serde_json::json!([1, 2])).unwrap();
  assert!(script.contains("\"ok\""));
  assert!(script.contains("\"error\""));
}
```

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml script_builder_output_contains_structured_result_fields -- --nocapture`
Expected: FAIL because the generated script does not yet encode structured success and error data.

**Step 3: Write minimal implementation**

Update the helper so its generated JavaScript always returns a structured JSON string such as:

```json
{"ok":true,"value":...}
```

or:

```json
{"ok":false,"error":"target method not found"}
```

Then wire a Rust function that:

- fetches the `main` webview window
- calls `WebviewWindow::eval`
- returns a Rust `Result`

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml script_builder_output_contains_structured_result_fields -- --nocapture`
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/src/main.rs src-tauri/src/webview_api.rs
git commit -m "feat: wire webview eval helper"
```

### Task 4: Add a minimal app command surface for on-demand calls

**Files:**
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/src/webview_api.rs`

**Step 1: Write the failing test**

Add unit tests for the request model used by the command.

```rust
#[test]
fn request_requires_a_non_empty_method_path() {
  let request = CallRequest {
    method_path: String::new(),
    args: serde_json::json!([])
  };
  assert!(request.validate().is_err());
}
```

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml request_requires_a_non_empty_method_path -- --nocapture`
Expected: FAIL because `CallRequest` and validation do not exist.

**Step 3: Write minimal implementation**

Add a command-facing request type:

```rust
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CallRequest {
  pub method_path: String,
  pub args: serde_json::Value
}
```

Expose a Tauri command that validates the request and invokes the helper against the `main` window.

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml request_requires_a_non_empty_method_path -- --nocapture`
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/src/main.rs src-tauri/src/webview_api.rs
git commit -m "feat: add command interface for page method calls"
```

### Task 5: Verify local static loading and smoke-test page evaluation

**Files:**
- Modify: `src-tauri/src/main.rs`
- Optional: `README.md`

**Step 1: Write the failing smoke expectation**

Document a manual smoke test checklist before changing runtime behavior:

```text
1. Launch Tauri against local static assets.
2. Confirm the app opens `webapp/index.html`.
3. Confirm page title can be read from Rust-triggered JavaScript.
4. Confirm one known missing method reports a structured error.
```

**Step 2: Run smoke verification to confirm it is not complete yet**

Run: `npm run tauri dev`
Expected: FAIL or be incomplete before the runtime hook and environment setup are finished.

**Step 3: Write minimal runtime verification support**

Add a temporary setup hook or debug-only path that evaluates a trivial expression against the webview after the main window is available, for example reading `document.title` and logging success or failure.

**Step 4: Run smoke verification to confirm it works**

Run: `npm install`
Run: `npm run tauri dev`
Expected:

- The desktop window opens the local draw.io page.
- Static resources are served from bundled `webapp/` content.
- The temporary smoke call logs a successful page evaluation.

**Step 5: Commit**

```bash
git add package-lock.json package.json src-tauri
git commit -m "feat: verify tauri local static loading"
```

### Task 6: Clean up and document known limits

**Files:**
- Modify: `README.md`
- Optional: `docs/plans/2026-03-12-tauri-local-webapp-design.md`

**Step 1: Write the failing documentation check**

List the minimum missing operator knowledge:

```text
- how to start the app
- that `webapp/` must stay static
- that only globally reachable page methods can be called
- that return values should remain JSON-compatible
```

**Step 2: Run documentation verification**

Run: `rg -n "globally reachable|frontendDist|npm run tauri dev" README.md docs/plans`
Expected: FAIL until the docs are updated.

**Step 3: Write minimal documentation**

Add concise documentation covering:

- how the Tauri shell loads `webapp/`
- how to start the desktop app
- the limits of calling page methods from Rust

**Step 4: Run documentation verification to confirm it passes**

Run: `rg -n "globally reachable|frontendDist|npm run tauri dev" README.md docs/plans`
Expected: PASS

**Step 5: Commit**

```bash
git add README.md docs/plans/2026-03-12-tauri-local-webapp-design.md
git commit -m "docs: document tauri local webapp constraints"
```
