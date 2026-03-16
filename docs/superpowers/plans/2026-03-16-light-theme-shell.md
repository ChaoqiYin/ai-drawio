# Light Theme Shell Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the outer Next.js shell UI from a dark theme to a light theme with transparent page background and white cards, while keeping the embedded draw.io editor unchanged.

**Architecture:** Update shared shell tokens in `app/globals.css`, then replace remaining dark-only utility classes in the home page and session workspace so all shell surfaces inherit the light palette consistently. Add a regression test that inspects the shell source files for the required light-theme markers.

**Tech Stack:** Next.js App Router, React, Tailwind CSS v4 utilities, Node.js built-in test runner

---

## Chunk 1: Guardrails

### Task 1: Add a failing regression test for the light shell theme

**Files:**
- Create: `tests/light-theme-shell.test.ts`
- Modify: `app/globals.css`
- Modify: `app/(internal)/_components/conversation-home.tsx`
- Modify: `app/(internal)/_components/session-workspace.tsx`

- [ ] **Step 1: Write the failing test**

Create a source-level regression test that asserts:
- `app/globals.css` sets `body` background to `transparent`
- `app/globals.css` defines white shell surface tokens
- `app/(internal)/_components/session-workspace.tsx` does not keep the sidebar on `theme="dark"`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/light-theme-shell.test.ts`
Expected: FAIL because the current shell still uses dark tokens and dark sidebar theme.

## Chunk 2: Shared Light Theme Tokens

### Task 2: Replace shared dark shell tokens with light ones

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Implement light theme variables**

Replace dark shell token values with:
- transparent page background
- white card surfaces
- light gray borders
- softer light-theme shadows
- darker text gradient suitable for light backgrounds

- [ ] **Step 2: Run regression test**

Run: `npm run test:node -- tests/light-theme-shell.test.ts`
Expected: still FAIL until page-level dark classes are removed.

## Chunk 3: Page-Level Light Surfaces

### Task 3: Update home and workspace shell components

**Files:**
- Modify: `app/(internal)/_components/conversation-home.tsx`
- Modify: `app/(internal)/_components/session-workspace.tsx`

- [ ] **Step 1: Remove remaining dark-only utility classes**

Adjust overlay backgrounds, accent surfaces, canvas shell backgrounds, preview container backgrounds, and sidebar theme usage so shell surfaces match the shared light design.

- [ ] **Step 2: Run focused regression test**

Run: `npm run test:node -- tests/light-theme-shell.test.ts`
Expected: PASS

- [ ] **Step 3: Run broader verification**

Run: `npm run test:node`
Expected: PASS

