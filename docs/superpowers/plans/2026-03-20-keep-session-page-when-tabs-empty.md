# Keep Session Page When Tabs Are Empty Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the workspace detail page open when all tabs are closed, and show an explicit empty state instead of redirecting to home.

**Architecture:** Update the session detail shell so an empty `openedSessions` list no longer triggers a route redirect. Render an empty-state panel inside the existing body container to preserve layout stability and make the no-tabs state explicit.

**Tech Stack:** Next.js, React, Arco Design, Node test runner

---

### Task 1: Lock the new behavior with a source regression test

**Files:**
- Modify: `tests/session-tabs-shell-source.test.ts`
- Test: `tests/session-tabs-shell-source.test.ts`

- [ ] **Step 1: Write the failing test**

Add assertions that the session shell source no longer contains the empty-tabs redirect effect and does contain empty-state copy for the detail page.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/session-tabs-shell-source.test.ts`
Expected: FAIL because the current shell still redirects to `/` when `openedSessions.length === 0`.

- [ ] **Step 3: Write minimal implementation**

Update the shell component to keep the route mounted and render an empty-state block when no sessions are open.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:node -- tests/session-tabs-shell-source.test.ts`
Expected: PASS

- [ ] **Step 5: Run focused regression verification**

Run: `npm run test:node -- tests/session-tabs-shell-source.test.ts tests/workspace-session-store.test.ts`
Expected: PASS

### Task 2: Add a create-session action to the detail top navigation

**Files:**
- Modify: `app/(internal)/_components/internal-top-navigation.tsx`
- Modify: `app/(internal)/_components/session-tabs-shell.tsx`
- Modify: `tests/internal-top-navigation-source.test.ts`
- Modify: `tests/session-tabs-shell-source.test.ts`
- Modify: `tests/button-icons-rounding.test.ts`

- [ ] **Step 1: Write the failing tests**

Add assertions that top navigation exposes an optional actions slot and that the session detail shell renders a right-side create-session button backed by `createConversation` and `openSession`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --experimental-strip-types --test tests/internal-top-navigation-source.test.ts tests/session-tabs-shell-source.test.ts tests/button-icons-rounding.test.ts`
Expected: FAIL because the top navigation does not yet expose actions and the detail shell has no create button.

- [ ] **Step 3: Write minimal implementation**

Expose an optional `actions` prop on the top navigation, then wire a create button in the session detail shell that creates a local conversation, opens a tab, activates it, and shows inline error/loading state.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --experimental-strip-types --test tests/internal-top-navigation-source.test.ts tests/session-tabs-shell-source.test.ts tests/button-icons-rounding.test.ts`
Expected: PASS
