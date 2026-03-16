# Session Toolbar Compaction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove non-essential explanatory copy from the session page header and workspace toolbar so the canvas area gains more usable space.

**Architecture:** Keep the strict desktop flex shell intact and only compact the top header and right-side toolbar content. Add a small regression test that verifies the long explanatory strings are absent and the toolbar uses tighter vertical padding.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, Node.js test runner

---

### Task 1: Write the failing compaction regression test

**Files:**
- Modify: `tests/session-workspace-layout.test.mjs`

**Step 1: Write the failing test**

Add assertions that the component source does not contain the long explanatory copy and does contain a tighter toolbar padding marker.

**Step 2: Run test to verify it fails**

Run: `node --test tests/session-workspace-layout.test.mjs`
Expected: FAIL because the current source still contains the explanatory copy and loose toolbar spacing.

### Task 2: Compact the header and toolbar

**Files:**
- Modify: `app/(internal)/_components/session-workspace.js`

**Step 1: Remove non-essential copy**

Delete the long descriptive paragraph from the page header and remove the two descriptive lines from the right toolbar.

**Step 2: Tighten toolbar spacing**

Reduce the toolbar vertical padding so the canvas gains more height without changing the overall shell structure.

### Task 3: Verify

**Files:**
- No file changes required

**Step 1: Run targeted test**

Run: `node --test tests/session-workspace-layout.test.mjs`
Expected: PASS

**Step 2: Run all Node tests**

Run: `npm run test:node`
Expected: PASS

**Step 3: Run frontend build**

Run: `npm run build:web`
Expected: PASS
