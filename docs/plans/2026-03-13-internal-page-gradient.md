# Internal Page Gradient Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refresh the internal Next.js pages with restrained gradients and clearer surface hierarchy without changing behavior.

**Architecture:** The work stays inside the existing internal shell by introducing shared visual utility classes in `app/globals.css` and then applying those hooks to the home page and session workspace containers. Verification stays lightweight by adding source-level assertions for the new class markers and then running focused tests plus the existing suite.

**Tech Stack:** Next.js App Router, React 19, Tailwind utility classes, Arco Design, Node test runner

---

### Task 1: Document shared visual hooks with tests

**Files:**
- Modify: `tests/conversation-home-source.test.ts`
- Modify: `tests/session-workspace-layout.test.ts`

**Step 1: Write the failing test**

Add assertions that the home page source includes the new visual hook classes and that the session workspace source includes the shared shell and canvas treatment hooks.

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/conversation-home-source.test.ts tests/session-workspace-layout.test.ts`
Expected: FAIL because the new class markers do not exist yet.

**Step 3: Write minimal implementation**

No production implementation in this task. Only land the test expectations.

**Step 4: Run test to verify it still fails for the intended reason**

Run: `npm run test:node -- tests/conversation-home-source.test.ts tests/session-workspace-layout.test.ts`
Expected: FAIL with missing class markers rather than syntax errors.

### Task 2: Add shared gradient surface utilities

**Files:**
- Modify: `app/globals.css`

**Step 1: Write the failing test**

Rely on Task 1 source assertions that expect new shared class names to be used by page components.

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/conversation-home-source.test.ts tests/session-workspace-layout.test.ts`
Expected: FAIL because page components do not yet reference the shared visual hooks.

**Step 3: Write minimal implementation**

Add reusable CSS utility classes for:
- internal page background glow
- glass panel surface treatment
- feature panel accent treatment
- subtle list card hover behavior
- canvas frame treatment
- gradient accent text

Keep all code in English and keep the utilities scoped to internal pages.

**Step 4: Run test to verify progress**

Run: `npm run test:node -- tests/conversation-home-source.test.ts tests/session-workspace-layout.test.ts`
Expected: Still FAIL until the components adopt the classes.

### Task 3: Apply the shared visual system to the home page

**Files:**
- Modify: `app/(internal)/_components/conversation-home.tsx`
- Test: `tests/conversation-home-source.test.ts`

**Step 1: Write the failing test**

Use the new home page assertions from Task 1.

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/conversation-home-source.test.ts`
Expected: FAIL because the component does not yet use the new shell, hero, list card, and overlay class markers.

**Step 3: Write minimal implementation**

Apply the shared classes to:
- page shell wrapper
- top summary card
- conversation list cards
- navigation overlay card

Preserve all behavior, data flow, and button wiring.

**Step 4: Run test to verify it passes**

Run: `npm run test:node -- tests/conversation-home-source.test.ts`
Expected: PASS

### Task 4: Apply the shared visual system to the session workspace

**Files:**
- Modify: `app/(internal)/_components/session-workspace.tsx`
- Test: `tests/session-workspace-layout.test.ts`

**Step 1: Write the failing test**

Use the new workspace assertions from Task 1.

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/session-workspace-layout.test.ts`
Expected: FAIL because the workspace shell does not yet use the new shared visual hooks.

**Step 3: Write minimal implementation**

Apply the shared classes to:
- workspace shell background
- toolbar and sidebar panels
- sidebar message cards
- secondary toolbar panel
- canvas frame container

Leave the iframe source and draw.io bridge logic unchanged.

**Step 4: Run test to verify it passes**

Run: `npm run test:node -- tests/session-workspace-layout.test.ts`
Expected: PASS

### Task 5: Full verification

**Files:**
- Modify: none

**Step 1: Run focused tests**

Run: `npm run test:node -- tests/conversation-home-source.test.ts tests/session-workspace-layout.test.ts tests/button-icons-rounding.test.ts`
Expected: PASS

**Step 2: Run the full Node test suite**

Run: `npm run test:node`
Expected: PASS

**Step 3: Run the web build**

Run: `npm run build:web`
Expected: PASS

**Step 4: Review for non-goals**

Confirm no files under `webapp/` were modified and no behavior-only files were changed.
