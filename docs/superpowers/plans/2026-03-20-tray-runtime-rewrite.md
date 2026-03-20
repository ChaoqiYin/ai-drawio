# Tray Runtime Rewrite Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the tray runtime so tray mode keeps the existing draw.io page instance alive, hides the Dock icon on macOS, and normal mode restores default close/minimize/Dock behavior.

**Architecture:** Keep a single main Tauri window and single draw.io page instance for the entire app lifetime. Replace the current tray runtime with a minimal state machine: tray mode creates the tray icon, hides the main window, and switches macOS to Accessory mode; normal mode removes the tray icon, shows the same window, and switches macOS back to Regular mode using direct native AppKit calls instead of layered workarounds.

**Tech Stack:** Tauri 2, Rust, macOS AppKit via `objc2-app-kit`, Node source tests

---

## Chunk 1: Lock In The Rewrite Contract

### Task 1: Rewrite the source-level tray runtime test around the new contract

**Files:**
- Modify: `tests/tauri-tray-runtime-source.test.ts`

- [ ] **Step 1: Write the failing test**

Require the Rust source to expose a minimal macOS-native tray mode API and stop asserting on the previous workaround-heavy helpers.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/tauri-tray-runtime-source.test.ts`
Expected: FAIL because the current source still contains the old helper structure.

- [ ] **Step 3: Write minimal test updates**

Assert on:
- a macOS-native `apply_macos_tray_mode` helper
- direct `NSApplication::setActivationPolicy`
- tray restore still uses `show_main_window`
- tray setup and close interception still exist

Remove assertions on:
- `sync_dock_visibility`
- `activate_macos_application`
- layered activation-policy workarounds

- [ ] **Step 4: Run test to verify it passes later**

Run after implementation: `node --experimental-strip-types --test tests/tauri-tray-runtime-source.test.ts`
Expected: PASS

## Chunk 2: Replace The Rust Tray Runtime

### Task 2: Replace the tray runtime state machine with a minimal implementation

**Files:**
- Modify: `src-tauri/src/tray_settings.rs`
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Delete the current macOS tray workaround helpers**

Remove:
- `activate_macos_application`
- `sync_dock_visibility`
- `sync_window_taskbar_visibility` use on macOS
- duplicated activation-policy recovery passes

- [ ] **Step 2: Add a direct macOS tray mode helper**

Implement a single helper that runs on the main thread and:
- uses `NSApplication::sharedApplication`
- sets `Accessory` when tray mode is enabled
- sets `Regular` when tray mode is disabled
- logs before/after mode transitions for debugging

- [ ] **Step 3: Rebuild enable/disable flow around one runtime transition**

Implement:
- enable tray: create tray, switch macOS tray mode on, set runtime state, hide main window
- disable tray: switch macOS tray mode off, remove tray, set runtime state, show main window

- [ ] **Step 4: Rebuild tray restore flow**

Implement restore from tray as:
- persist `enabled=false`
- switch runtime off
- remove tray
- switch macOS back to normal mode
- show/focus the existing main window

- [ ] **Step 5: Keep startup semantics intact**

Keep:
- tray-enabled startup should not show splash/main window
- normal startup should show splash then main window
- close interception should only hide to tray when runtime tray mode is active

## Chunk 3: Verify The Rewritten Runtime

### Task 3: Run focused regression checks

**Files:**
- Test: `tests/tauri-tray-runtime-source.test.ts`
- Test: `tests/tauri-tray-settings-source.test.ts`
- Test: `tests/settings-page-source.test.ts`

- [ ] **Step 1: Run tray source tests**

Run: `node --experimental-strip-types --test tests/settings-page-source.test.ts tests/tauri-tray-settings-source.test.ts tests/tauri-tray-runtime-source.test.ts`
Expected: PASS

- [ ] **Step 2: Run Rust compile validation**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 3: Manual verification in `npm run dev`**

Verify:
- enable tray hides Dock icon and window but keeps app alive
- tray menu restores the same running app instance
- normal mode minimize shows Dock icon normally
- normal mode close exits normally
