# Disable DevTools Auto Open Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stop automatically opening Tauri DevTools during local development startup while keeping manual DevTools capability untouched.

**Architecture:** Remove the startup-only `open_devtools()` call from the Tauri setup hook and update the source-level regression test to assert that the auto-open behavior no longer exists. Keep all other startup logic unchanged.

**Tech Stack:** Rust, Tauri, Node test runner

---

### Task 1: Update the source-level regression test

**Files:**
- Modify: `tests/tauri-devtools-source.test.ts`
- Test: `tests/tauri-devtools-source.test.ts`

**Step 1: Write the failing test**

Change the test so it asserts the Tauri main file does not auto-open DevTools during startup.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/tauri-devtools-source.test.ts`
Expected: FAIL because `open_devtools()` is still present.

**Step 3: Write minimal implementation**

Remove the startup auto-open logic from `src-tauri/src/main.rs`.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/tauri-devtools-source.test.ts`
Expected: PASS

### Task 2: Run focused regression checks

**Files:**
- Modify: `src-tauri/src/main.rs`
- Test: `tests/tauri-devtools-source.test.ts`

**Step 1: Run Node regression**

Run: `npm run test:node`
Expected: PASS

**Step 2: Run Rust compile check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS
