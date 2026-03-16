# App Internal Structure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move all internal Next.js pages and their supporting frontend code under `app/` while keeping the static `webapp/` directory unchanged.

**Architecture:** Use an App Router route group at `app/(internal)` so the filesystem groups internal pages without changing public URLs. Move frontend-only helpers and UI modules into `_lib` and `_components` folders inside that route group, then update tests and docs to match.

**Tech Stack:** Next.js App Router, React, Node.js tests, Tauri

---

### Task 1: Write a failing import-path regression test

**Files:**
- Modify: `tests/conversation-model.test.mjs`

**Step 1: Write the failing test**

Update the import path so the test reads helpers from `app/(internal)/_lib/conversation-model.js`.

**Step 2: Run test to verify it fails**

Run: `node --test tests/conversation-model.test.mjs`
Expected: FAIL with module resolution error because the file has not been moved yet.

### Task 2: Move internal frontend modules under `app/(internal)`

**Files:**
- Modify: `app/page.js`
- Modify: `app/session/page.js`
- Create: `app/(internal)/page.js`
- Create: `app/(internal)/session/page.js`
- Create: `app/(internal)/_components/conversation-home.js`
- Create: `app/(internal)/_components/session-workspace.js`
- Create: `app/(internal)/_lib/conversation-model.js`
- Create: `app/(internal)/_lib/conversation-store.js`

**Step 1: Move route files into the route group**

Place the page entry files under `app/(internal)` and keep route URLs unchanged.

**Step 2: Move shared frontend helpers and components**

Move the current top-level `components/` and `lib/` modules into the route group and update relative imports.

**Step 3: Remove obsolete top-level module copies**

Delete the old `components/` and `lib/` files after all imports point to the new structure.

### Task 3: Restore green tests and update docs

**Files:**
- Modify: `README.md`
- Modify: `tests/conversation-model.test.mjs`

**Step 1: Run targeted test to verify it passes**

Run: `node --test tests/conversation-model.test.mjs`
Expected: PASS

**Step 2: Update documentation**

Document that internal Next.js code now lives under `app/(internal)` while `webapp/` remains top-level static content.

### Task 4: Run full verification

**Files:**
- No file changes required

**Step 1: Run all Node tests**

Run: `npm run test:node`
Expected: PASS

**Step 2: Run frontend build**

Run: `npm run build:web`
Expected: PASS
