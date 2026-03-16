# Session Workspace Flex Shell Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert the session workspace page into a strict desktop flex shell with a single page header, a single page body, a fixed left sidebar, and a right-side toolbar plus canvas area.

**Architecture:** Keep the existing client component and bridge behavior intact, but reorganize the JSX hierarchy and Tailwind classes into a rigid application-shell layout. Use flex containers only for the shell and add a focused regression test that checks for the new structural markers in the component source.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, Node.js test runner

---

### Task 1: Write the failing layout regression test

**Files:**
- Create: `tests/session-workspace-layout.test.mjs`

**Step 1: Write the failing test**

Add a Node test that reads `app/(internal)/_components/session-workspace.js` and checks for:

- `data-layout="workspace-head"`
- `data-layout="workspace-body"`
- `data-layout="workspace-sidebar"`
- `data-layout="workspace-main"`
- `data-layout="workspace-main-toolbar"`
- `data-layout="workspace-main-canvas"`
- a fixed left width marker such as `w-[320px] shrink-0`

**Step 2: Run test to verify it fails**

Run: `node --test tests/session-workspace-layout.test.mjs`
Expected: FAIL because the current component does not contain the new structural markers.

### Task 2: Rebuild the session workspace JSX hierarchy

**Files:**
- Modify: `app/(internal)/_components/session-workspace.js`

**Step 1: Create the strict shell hierarchy**

Refactor the return tree so the top level becomes:

- one page `header`
- one page `section` for the body
- left sidebar
- right main area
- right toolbar
- right canvas container

**Step 2: Replace grid-based shell logic with flex layout**

Use flex classes for:

- page root vertical shell
- body horizontal split
- fixed sidebar width
- right-side vertical split
- toolbar fixed height
- canvas fill-height area

**Step 3: Remove the old nested right-panel header pattern**

Keep the draw.io info in the new right toolbar instead of a second panel header.

### Task 3: Verify targeted test and full regression checks

**Files:**
- No file changes required

**Step 1: Run the targeted test**

Run: `node --test tests/session-workspace-layout.test.mjs`
Expected: PASS

**Step 2: Run all Node tests**

Run: `npm run test:node`
Expected: PASS

**Step 3: Run the frontend build**

Run: `npm run build:web`
Expected: PASS
