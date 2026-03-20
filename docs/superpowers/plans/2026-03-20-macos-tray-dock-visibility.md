# macOS Tray Dock Visibility Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the macOS Dock icon only while tray mode is active, and restore Dock visibility when the app returns to normal window mode.

**Architecture:** Reuse the existing tray runtime in `src-tauri/src/tray_settings.rs` and wire the existing macOS extension hooks to Tauri's `set_dock_visibility` API. Keep activation policy unchanged so the app remains a normal Dock-visible app outside tray mode.

**Tech Stack:** Tauri 2, Rust, Node source tests

---

## Chunk 1: Lock In The Contract

### Task 1: Update the tray runtime source test first

**Files:**
- Modify: `tests/tauri-tray-runtime-source.test.ts`

- [ ] **Step 1: Write the failing test**

Replace the old "do not touch Dock visibility" assertion with assertions that tray runtime helpers call `set_dock_visibility` while still avoiding activation-policy changes.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/tauri-tray-runtime-source.test.ts`
Expected: FAIL because the current source still keeps the macOS helpers empty and still matches the old negative assertion.

- [ ] **Step 3: Keep the test narrowly scoped**

Assert on:
- `apply_macos_tray_mode` calling `set_dock_visibility(!enabled)`
- `apply_macos_startup_tray_mode` existing
- tray restore and tray setup still wiring through the existing helpers

Keep asserting that:
- `set_activation_policy`
- `NSApplicationActivationPolicy`
- direct activation-policy switching

do not appear in the tray runtime source.

## Chunk 2: Implement The Runtime Change

### Task 2: Wire macOS Dock visibility into tray state transitions

**Files:**
- Modify: `src-tauri/src/tray_settings.rs`

- [ ] **Step 1: Implement the macOS helper**

Add a macOS-only `apply_macos_tray_mode` implementation that calls `app.set_dock_visibility(!enabled)` and returns any Tauri error as `String`.

- [ ] **Step 2: Implement startup synchronization**

Make `apply_macos_startup_tray_mode` delegate to the same Dock visibility helper so startup matches the persisted tray preference.

- [ ] **Step 3: Sync runtime transitions**

Call the Dock visibility helper inside the tray enable and disable flow so the Dock icon hides when tray mode turns on and reappears when tray mode turns off.

- [ ] **Step 4: Sync restore rollback**

Ensure the restore-from-tray path restores Dock visibility before showing the main window, and rolls Dock visibility back if showing the window fails.

## Chunk 3: Verify

### Task 3: Run focused validation

**Files:**
- Test: `tests/tauri-tray-runtime-source.test.ts`
- Test: `tests/tauri-tray-settings-source.test.ts`
- Test: `tests/settings-page-source.test.ts`

- [ ] **Step 1: Run focused source tests**

Run: `node --experimental-strip-types --test tests/tauri-tray-runtime-source.test.ts tests/tauri-tray-settings-source.test.ts tests/settings-page-source.test.ts`
Expected: PASS

- [ ] **Step 2: Run Rust compile validation**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS
