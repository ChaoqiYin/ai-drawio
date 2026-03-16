# Arco Adoption Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the internal application pages so they primarily use Arco Design components and run in Arco dark mode.

**Architecture:** Use the root App Router layout to load Arco CSS and enable dark mode for the document body, then rebuild the home and workspace pages with Arco layout and content components while preserving existing business logic and iframe behavior.

**Tech Stack:** Next.js App Router, React, TypeScript, Arco Design React

---

### Task 1: Write failing Arco adoption tests

**Files:**
- Create: `tests/arco-adoption.test.ts`
- Modify: `tests/conversation-home-source.test.ts`
- Modify: `tests/session-workspace-layout.test.ts`

**Step 1: Add dark mode and component-source assertions**

Assert that:

- root layout imports Arco CSS and enables dark mode
- home page imports Arco components and no longer relies on `window.confirm`
- workspace page imports Arco components while keeping the strict shell markers

**Step 2: Run tests to verify they fail**

Run: `node --experimental-strip-types --test tests/arco-adoption.test.ts tests/conversation-home-source.test.ts tests/session-workspace-layout.test.ts`
Expected: FAIL

### Task 2: Enable Arco dark mode globally

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

**Step 1: Add Arco CSS and provider**

Import Arco CSS, wrap the app with `ConfigProvider`, and set the body dark-mode attribute.

**Step 2: Remove obsolete page theme helpers**

Trim custom globals so page visuals can be driven by Arco dark tokens.

### Task 3: Rebuild the home and workspace pages with Arco

**Files:**
- Modify: `app/(internal)/_components/conversation-home.tsx`
- Modify: `app/(internal)/_components/session-workspace.tsx`

**Step 1: Rebuild the home page**

Use Arco cards, typography, buttons, tags, alerts, empty states, and popconfirm actions.

**Step 2: Rebuild the workspace page**

Use Arco layout, cards, typography, tags, alerts, and empty states while keeping the native iframe.

### Task 4: Verify

**Files:**
- No file changes required

**Step 1: Run targeted Arco tests**

Run: `node --experimental-strip-types --test tests/arco-adoption.test.ts tests/conversation-home-source.test.ts tests/session-workspace-layout.test.ts`
Expected: PASS

**Step 2: Run all Node tests**

Run: `npm run test:node`
Expected: PASS

**Step 3: Run frontend build**

Run: `npm run build:web`
Expected: PASS
