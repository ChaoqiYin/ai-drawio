# Internal Class Scope Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move single-use internal layout/spacing classes out of `app/globals.css` and into component `className` utilities while preserving reusable visual classes globally.

**Architecture:** The change is a scoped refactor: first update tests so they expect inline utility classes instead of one-off global hooks, then simplify `app/globals.css` by deleting the unused layout classes, and finally move the corresponding spacing/layout values into `session-workspace.tsx`. Reusable visual classes and pseudo-element-driven classes remain in the shared stylesheet.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS v4 utilities, Arco Design, Node test runner

---

### Task 1: Update regression tests for inline spacing utilities

**Files:**
- Modify: `tests/session-workspace-layout.test.ts`
- Modify: `tests/arco-adoption.test.ts`

**Step 1: Write the failing test**

Replace the one-off global class assertions with source assertions for the inline utility classes that will replace them.

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/session-workspace-layout.test.ts tests/arco-adoption.test.ts`
Expected: FAIL because the component still uses the old global class hooks.

**Step 3: Write minimal implementation**

Only commit the test updates in this step.

**Step 4: Run test to verify the failure is for missing inline utilities**

Run: `npm run test:node -- tests/session-workspace-layout.test.ts tests/arco-adoption.test.ts`
Expected: FAIL with missing utility class matches.

### Task 2: Move one-off session spacing classes into JSX

**Files:**
- Modify: `app/(internal)/_components/session-workspace.tsx`
- Modify: `app/globals.css`
- Test: `tests/session-workspace-layout.test.ts`
- Test: `tests/arco-adoption.test.ts`

**Step 1: Run test to verify the current failure**

Run: `npm run test:node -- tests/session-workspace-layout.test.ts tests/arco-adoption.test.ts`
Expected: FAIL because the JSX has not adopted the inline spacing utilities yet.

**Step 2: Write minimal implementation**

Move the single-use spacing/layout hooks into `className`:

- page shell padding
- header bottom spacing
- sidebar content flow gaps
- main content flow gaps

Delete the now-unused global classes from `app/globals.css`.

**Step 3: Run test to verify it passes**

Run: `npm run test:node -- tests/session-workspace-layout.test.ts tests/arco-adoption.test.ts`
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

**Step 3: Review CSS scope**

Confirm the removed one-off spacing hooks no longer exist in `app/globals.css` and the reusable visual hooks remain.
