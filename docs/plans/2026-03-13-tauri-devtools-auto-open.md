# Tauri DevTools Auto Open Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Open the built-in Tauri DevTools automatically for the desktop main window in development builds only.

**Architecture:** Keep the change inside `src-tauri/src/main.rs` by extending the existing `setup` callback. Guard the behavior with `cfg!(debug_assertions)` so release builds remain unaffected. Verify the behavior with a source test that checks for the guard and DevTools call.

**Tech Stack:** Tauri 2, Rust, Node test runner, Next.js

---

### Task 1: Lock the expected startup behavior with a failing test

**Files:**
- Create: `tests/tauri-devtools-source.test.ts`
- Test: `tests/tauri-devtools-source.test.ts`

**Step 1: Write the failing test**

Write a source test that reads `src-tauri/src/main.rs` and asserts it contains:
- `cfg!(debug_assertions)`
- `get_webview_window("main")`
- `open_devtools()`

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/tauri-devtools-source.test.ts`
Expected: FAIL because the startup hook does not open DevTools yet.

**Step 3: Write minimal implementation**

No implementation in this task.

**Step 4: Run test to verify it still fails for the right reason**

Run the same command and confirm the missing source markers are the cause.

### Task 2: Add the development-only DevTools startup hook

**Files:**
- Modify: `src-tauri/src/main.rs`
- Test: `tests/tauri-devtools-source.test.ts`

**Step 1: Write the minimal implementation**

Inside the existing `setup` closure:
- keep the control server startup unchanged
- check `cfg!(debug_assertions)`
- look up the `main` webview window
- call `open_devtools()` when the handle exists

**Step 2: Run the focused test**

Run: `node --experimental-strip-types --test tests/tauri-devtools-source.test.ts`
Expected: PASS

**Step 3: Run broader verification**

Run: `npm run test:node`
Expected: PASS

**Step 4: Run web build verification**

Run: `npm run build:web`
Expected: PASS
