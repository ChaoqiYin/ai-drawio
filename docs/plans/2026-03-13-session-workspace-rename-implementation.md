# Session Workspace Rename Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a rename action to the session workspace header so conversation titles can be edited in place.

**Architecture:** Reuse the existing `updateConversationTitle` store helper and manage modal state locally inside `session-workspace.tsx`. Update the loaded conversation record in component state after a successful rename so the header title and updated timestamp refresh immediately.

**Tech Stack:** Next.js App Router, React, Arco Design, IndexedDB, Node test runner

---

### Task 1: Add a failing workspace source test

**Files:**
- Modify: `tests/session-workspace-layout.test.ts`

**Step 1: Write the failing test**

Add assertions requiring:
- `Modal` and `Input` imports
- `handleRenameConversation` logic
- `renameDraftTitle` state
- visible `重命名` action in the header

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/session-workspace-layout.test.ts`
Expected: FAIL because the workspace rename UI does not exist yet.

### Task 2: Implement workspace rename UI

**Files:**
- Modify: `app/(internal)/_components/session-workspace.tsx`

**Step 1: Write minimal implementation**

Add to the workspace component:
- modal state for rename dialog
- rename input and inline validation
- save handler that calls `updateConversationTitle`
- local conversation state refresh after save

**Step 2: Run test to verify it passes**

Run: `npm run test:node -- tests/session-workspace-layout.test.ts`
Expected: PASS

### Task 3: Verify the full change

**Files:**
- Modify: `tests/session-workspace-layout.test.ts`

**Step 1: Run full verification**

Run: `npm run test:node`
Expected: PASS
