# Settings Tray Toggle Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent system tray toggle to the settings page that applies immediately and changes window-close behavior to hide to tray when enabled.

**Architecture:** Add a dedicated Tauri tray settings module that owns persisted tray preference, tray lifecycle, and close interception. Expose focused tray commands to the frontend through a new helper, then extend the settings page with a dedicated tray card above the existing CLI integration card.

**Tech Stack:** Next.js client components, Arco Design React, Node test runner, Tauri 2, Rust, serde JSON

---

## File Map

- Create: `app/(internal)/_lib/tauri-tray-settings.ts`
- Modify: `app/(internal)/_components/settings-page.tsx`
- Modify: `tests/settings-page-source.test.ts`
- Create: `tests/tauri-tray-settings-source.test.ts`
- Create: `src-tauri/src/tray_settings.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/Cargo.toml`

## Chunk 1: Frontend Contract And Settings Page

### Task 1: Add failing source tests for tray helper and settings page

**Files:**
- Modify: `tests/settings-page-source.test.ts`
- Create: `tests/tauri-tray-settings-source.test.ts`

- [ ] **Step 1: Write the failing tests**

Add assertions for:

- tray helper type and invoke usage
- `get_tray_settings`
- `set_tray_enabled`
- settings page tray card copy
- tray state labels
- tray toggle control
- tray helper imports and usage
- tray card rendered before CLI card

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --experimental-strip-types --test tests/settings-page-source.test.ts tests/tauri-tray-settings-source.test.ts`
Expected: FAIL because tray helper and tray card do not exist yet.

### Task 2: Implement the frontend tray helper

**Files:**
- Create: `app/(internal)/_lib/tauri-tray-settings.ts`
- Test: `tests/tauri-tray-settings-source.test.ts`

- [ ] **Step 1: Write minimal implementation**

Create a helper that:

- resolves the Tauri invoke bridge the same way as the CLI helper
- exports `TrayCloseBehavior`
- exports `TraySettingsState`
- exports `getTraySettings()`
- exports `setTrayEnabled(enabled: boolean)`

- [ ] **Step 2: Run helper test to verify it passes**

Run: `node --experimental-strip-types --test tests/tauri-tray-settings-source.test.ts`
Expected: PASS

### Task 3: Extend the settings page with a tray card

**Files:**
- Modify: `app/(internal)/_components/settings-page.tsx`
- Test: `tests/settings-page-source.test.ts`

- [ ] **Step 1: Write minimal implementation**

Update the settings page to:

- load tray settings alongside CLI status
- show a dedicated `系统托盘` card above the CLI card
- render current tray state and close behavior tags
- render a switch labeled `启用系统托盘`
- disable the switch while requests are pending
- show tray-scoped error feedback
- keep the CLI card behavior intact

- [ ] **Step 2: Run frontend source tests to verify they pass**

Run: `node --experimental-strip-types --test tests/settings-page-source.test.ts tests/tauri-tray-settings-source.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add -- tests/settings-page-source.test.ts tests/tauri-tray-settings-source.test.ts 'app/(internal)/_lib/tauri-tray-settings.ts' 'app/(internal)/_components/settings-page.tsx'
git commit -m "feat: add tray settings UI"
```

## Chunk 2: Tauri Tray Runtime And Persistence

### Task 4: Add failing Rust-side source tests

**Files:**
- Modify: `tests/settings-page-source.test.ts`
- Test: `src-tauri/src/tray_settings.rs`
- Test: `src-tauri/src/main.rs`

- [ ] **Step 1: Add source-level assertions**

Extend source tests to check:

- `main.rs` registers `get_tray_settings`
- `main.rs` registers `set_tray_enabled`
- `main.rs` loads tray settings during setup
- `main.rs` uses close-request handling for the main window

- [ ] **Step 2: Run source tests to verify they fail**

Run: `node --experimental-strip-types --test tests/settings-page-source.test.ts`
Expected: FAIL because tray commands and setup are not wired yet.

### Task 5: Implement tray settings module and wire main runtime

**Files:**
- Create: `src-tauri/src/tray_settings.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Write minimal implementation**

Implement:

- persisted `tray-settings.json` in app config dir
- default disabled preference
- tray menu with show and quit actions
- runtime state for quit bypass and tray enabled state
- `get_tray_settings`
- `set_tray_enabled`
- setup-time tray restoration
- close-request interception that hides the main window when tray is enabled

- [ ] **Step 2: Add focused Rust unit tests**

Cover:

- default disabled preference
- preference file round-trip
- close behavior mapping
- normalized state payload

- [ ] **Step 3: Run Rust and source tests to verify they pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml tray_settings`
Expected: PASS

Run: `node --experimental-strip-types --test tests/settings-page-source.test.ts tests/tauri-tray-settings-source.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -- src-tauri/Cargo.toml src-tauri/src/tray_settings.rs src-tauri/src/main.rs tests/settings-page-source.test.ts tests/tauri-tray-settings-source.test.ts
git commit -m "feat: add persistent tray runtime"
```

## Chunk 3: Final Verification

### Task 6: Run final regression checks

**Files:**
- Modify: none
- Test: `tests/settings-page-source.test.ts`
- Test: `tests/tauri-tray-settings-source.test.ts`
- Test: `src-tauri/src/tray_settings.rs`

- [ ] **Step 1: Run focused verification**

Run: `node --experimental-strip-types --test tests/settings-page-source.test.ts tests/tauri-tray-settings-source.test.ts`
Expected: PASS

Run: `cargo test --manifest-path src-tauri/Cargo.toml tray_settings`
Expected: PASS

- [ ] **Step 2: Run compile-level verification**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 3: Summarize residual risks**

Record any remaining risks around platform-specific tray behavior, especially runtime-only interactions that source tests cannot fully simulate.
