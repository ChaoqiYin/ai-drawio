# Session Workspace Spacing Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Relax the spacing of the `/session` workspace page without changing its structure or behavior.

**Architecture:** The change stays inside the existing session page component by introducing a few explicit spacing hooks and adjusting the shell, panel, and body spacing values already present in the desktop flex layout. Verification remains source-level and build-level so behavior regressions stay out of scope.

**Tech Stack:** Next.js App Router, React 19, Tailwind utility classes, Arco Design, Node test runner

---

### Task 1: Add source-level spacing assertions

**Files:**
- Modify: `tests/session-workspace-layout.test.ts`

**Step 1: Write the failing test**

Add assertions that the session workspace source includes new spacing hook classes for the relaxed shell, body, sidebar flow, and main content flow.

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/session-workspace-layout.test.ts`
Expected: FAIL because the new spacing hooks do not exist yet.

**Step 3: Write minimal implementation**

No production implementation in this task. Only add the test expectations.

**Step 4: Run test to verify it still fails for the intended reason**

Run: `npm run test:node -- tests/session-workspace-layout.test.ts`
Expected: FAIL with missing spacing hook markers.

### Task 2: Apply spacing hooks to the session workspace

**Files:**
- Modify: `app/(internal)/_components/session-workspace.tsx`
- Modify: `app/globals.css`
- Test: `tests/session-workspace-layout.test.ts`

**Step 1: Run test to verify the current failure**

Run: `npm run test:node -- tests/session-workspace-layout.test.ts`
Expected: FAIL because the component has not adopted the new spacing hooks.

**Step 2: Write minimal implementation**

Adjust spacing only for:
- outer shell padding
- header-to-body separation
- sidebar panel body rhythm
- sidebar content flow
- main content flow
- canvas frame breathing room

Use explicit class markers so the source-level test can verify the spacing change without coupling to exact numeric values everywhere.

**Step 3: Run test to verify it passes**

Run: `npm run test:node -- tests/session-workspace-layout.test.ts`
Expected: PASS

### Task 3: Full verification

**Files:**
- Modify: none

**Step 1: Run the full Node test suite**

Run: `npm run test:node`
Expected: PASS

**Step 2: Run the web build**

Run: `npm run build:web`
Expected: PASS

**Step 3: Review scope**

Confirm only the internal session workspace spacing changed and `webapp/` remains untouched.
