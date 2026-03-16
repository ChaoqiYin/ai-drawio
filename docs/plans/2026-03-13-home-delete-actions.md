# Home Delete Actions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add confirmed single-item deletion and confirmed full IndexedDB cleanup actions to the home page local drawing list.

**Architecture:** Extend the browser-only conversation store with focused deletion helpers, then wire those helpers into the existing home page list UI. Keep the current route structure and creation flow intact while adding source-level tests for the new UI affordances and Node tests for the new exported helpers.

**Tech Stack:** Next.js App Router, React, IndexedDB, Node.js test runner

---

### Task 1: Write failing tests for the new deletion surface

**Files:**
- Create: `tests/conversation-store-api.test.mjs`
- Create: `tests/conversation-home-source.test.mjs`

**Step 1: Write the failing store API test**

Assert that `app/(internal)/_lib/conversation-store.js` exports `deleteConversation` and `clearAllIndexedDbDatabases`.

**Step 2: Write the failing home page source test**

Assert that `app/(internal)/_components/conversation-home.js` includes:

- `handleDeleteConversation`
- `handleClearAllData`
- `清空全部本地数据`
- `删除`
- `window.confirm`

**Step 3: Run tests to verify they fail**

Run: `node --test tests/conversation-store-api.test.mjs tests/conversation-home-source.test.mjs`
Expected: FAIL because the exports and UI hooks do not exist yet.

### Task 2: Add store-level deletion helpers

**Files:**
- Modify: `app/(internal)/_lib/conversation-store.js`

**Step 1: Add `deleteConversation(id)`**

Delete one record from the existing object store.

**Step 2: Add `clearAllIndexedDbDatabases()`**

Enumerate all databases for the current origin and delete them one by one. Throw a clear error if enumeration support is missing.

### Task 3: Add home page delete UI and interaction flow

**Files:**
- Modify: `app/(internal)/_components/conversation-home.js`

**Step 1: Add per-item delete action**

Add a delete button to each card, stop navigation, confirm, delete, and update local state.

**Step 2: Add global clear-all action**

Add the header action, confirm, clear all IndexedDB databases, and empty the local list state.

**Step 3: Add in-progress state handling**

Disable the active button during destructive operations and reuse the existing error message area.

### Task 4: Verify

**Files:**
- No file changes required

**Step 1: Run targeted tests**

Run: `node --test tests/conversation-store-api.test.mjs tests/conversation-home-source.test.mjs`
Expected: PASS

**Step 2: Run all Node tests**

Run: `npm run test:node`
Expected: PASS

**Step 3: Run frontend build**

Run: `npm run build:web`
Expected: PASS
