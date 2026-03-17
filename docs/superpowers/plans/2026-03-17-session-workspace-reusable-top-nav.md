# Session Workspace Reusable Top Navigation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the session workspace top navigation into a reusable component with a permanent back button and one caller-provided content region.

**Architecture:** Add a focused internal top navigation component that owns only the card layout and back-button behavior. Keep breadcrumb composition, direct-home back handling, and the rename / updated-time / readiness content inside `session-workspace.tsx`, passed through a single `content` prop.

**Tech Stack:** Next.js, React, TypeScript, Arco Design, Node test runner

---

## Chunk 1: Test-First Navigation Extraction

### Task 1: Define reusable top navigation source expectations

**Files:**
- Create: `tests/internal-top-navigation-source.test.ts`
- Modify: `tests/session-workspace-header-nav.test.ts`
- Modify: `tests/session-workspace-status-bar.test.ts`

- [ ] **Step 1: Write the failing tests**

Add source assertions that require:

- a new reusable top navigation component file
- a permanent back button in that component
- a `content` prop in that component
- optional `onBack` override support in that component
- session workspace consuming the new component
- session workspace rendering breadcrumb plus right-side status/actions inside one provided content region
- removal of the old standalone status-row structure

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:node -- tests/internal-top-navigation-source.test.ts tests/session-workspace-header-nav.test.ts tests/session-workspace-status-bar.test.ts`

Expected: FAIL because the new component file and updated usage do not exist yet.

### Task 2: Implement the reusable component and session workspace integration

**Files:**
- Create: `app/(internal)/_components/internal-top-navigation.tsx`
- Modify: `app/(internal)/_components/session-workspace.tsx`

- [ ] **Step 3: Write minimal implementation**

Create `internal-top-navigation.tsx` with:

- `content: ReactNode`
- optional `onBack`
- optional `backLabel`
- built-in `返回` button with `IconLeft`
- default back behavior using browser history fallback
- card/layout markup preserving navigation-level styling hooks

Update `session-workspace.tsx` to:

- import the new component
- keep existing breadcrumb route creation and item renderer
- pass a direct-home `onBack` handler
- pass one composite `content` node that lays out breadcrumb on the left and rename / updated time / readiness on the right
- remove the old separate top-nav card markup and standalone status bar row

- [ ] **Step 4: Run targeted tests to verify they pass**

Run: `npm run test:node -- tests/internal-top-navigation-source.test.ts tests/session-workspace-header-nav.test.ts tests/session-workspace-status-bar.test.ts`

Expected: PASS

## Chunk 2: Regression Verification

### Task 3: Run broader session workspace source regressions

**Files:**
- Verify: `tests/session-workspace-layout.test.ts`

- [ ] **Step 5: Run workspace regression checks**

Run: `npm run test:node -- tests/session-workspace-layout.test.ts`

Expected: PASS without requiring unrelated layout rewrites.

- [ ] **Step 6: Run final relevant test batch**

Run: `npm run test:node -- tests/internal-top-navigation-source.test.ts tests/session-workspace-header-nav.test.ts tests/session-workspace-status-bar.test.ts tests/session-workspace-layout.test.ts`

Expected: PASS

## Notes

- Do not commit as part of this execution unless the user explicitly requests it.
- Keep the reusable component layout-only; do not move breadcrumb data construction out of `session-workspace.tsx`.
- Preserve existing `data-layout` hooks where they still make sense for source tests and styling.
