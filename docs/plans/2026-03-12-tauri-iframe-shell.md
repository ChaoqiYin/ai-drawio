# Tauri Iframe Shell Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Load draw.io through a shell page with a top debug path bar while preserving Rust-to-page calls through the embedded iframe.

**Architecture:** Keep Tauri serving `webapp/` as local assets, but switch the startup URL to `shell.html`. The shell page renders the path bar and iframe, while Rust injects the rendered file path and redirects command-driven JavaScript into `iframe.contentWindow`.

**Tech Stack:** Tauri v2, Rust, Cargo, static HTML/CSS/JS, iframe same-origin DOM access

---

### Task 1: Switch the startup page to a shell entry

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Create: `webapp/shell.html`

**Step 1: Write the failing test**

Add a Rust or config-focused assertion that expects the app to reference `shell.html` instead of the default `index.html`.

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
Expected: FAIL because the current startup flow still assumes direct loading of `index.html`.

**Step 3: Write minimal implementation**

- Set `app.windows[0].url` to `shell.html`
- Create a shell page that renders a debug bar and an iframe pointing to `index.html`

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/tauri.conf.json webapp/shell.html
git commit -m "feat: add iframe shell entry page"
```

### Task 2: Redirect Rust calls to the iframe window

**Files:**
- Modify: `src-tauri/src/webview_api.rs`

**Step 1: Write the failing test**

Add unit tests asserting generated scripts resolve from the iframe content window instead of the shell window.

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
Expected: FAIL because generated scripts still target `window`.

**Step 3: Write minimal implementation**

- Add a shell helper lookup in generated scripts
- Resolve and call methods from `iframe.contentWindow`
- Wrap direct script execution so it runs inside the iframe window

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/src/webview_api.rs
git commit -m "feat: target iframe content window"
```

### Task 3: Inject the rendered file path into the shell bar

**Files:**
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/src/webview_api.rs`

**Step 1: Write the failing test**

Add a unit test for the Rust helper that builds the render-path injection script.

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
Expected: FAIL because no shell-path script builder exists.

**Step 3: Write minimal implementation**

- Compute the absolute path for `../webapp/index.html`
- Use `Builder::on_page_load` to inject it into the shell page
- Update the shell page through a stable global helper function

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/src/main.rs src-tauri/src/webview_api.rs
git commit -m "feat: inject render path into shell bar"
```

### Task 4: Verify runtime behavior and document the shell flow

**Files:**
- Modify: `README.md`

**Step 1: Write the failing verification checklist**

Document the expected visible outcomes:

- top debug path bar
- draw.io rendered below inside the iframe
- Rust commands still target the embedded page

**Step 2: Run runtime verification**

Run: `npm run dev`
Expected: shell page opens and embeds draw.io locally.

**Step 3: Write minimal documentation**

Update the README to explain:

- startup page is now `shell.html`
- the path bar is debug-only
- Rust command helpers target the iframe content

**Step 4: Run verification to confirm it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS

**Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document iframe shell debug bar"
```
