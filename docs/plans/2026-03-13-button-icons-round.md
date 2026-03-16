# Button Icons And Round Shape Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add icons to key action buttons and make internal-page buttons rounded with a shared Arco configuration.

**Architecture:** Keep the button shape change centralized in `app/arco-config-provider.tsx` using Arco component config. Add a narrow set of leading icons directly in the two internal React components so the change remains intentional and low-noise.

**Tech Stack:** Next.js, React, TypeScript, Arco Design

---

### Task 1: Lock the visual contract with a failing source test

**Files:**
- Create: `tests/button-icons-rounding.test.ts`
- Test: `tests/button-icons-rounding.test.ts`

**Step 1: Write the failing test**

Read the shared Arco provider and the two internal components. Assert that:
- the shared provider sets `Button: { size: "small", shape: "round" }`
- `conversation-home.tsx` imports Arco icons and uses icons on create, clear-all, and delete buttons
- `session-workspace.tsx` imports an Arco icon and uses it on the back button

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/button-icons-rounding.test.ts`
Expected: FAIL because buttons are not globally rounded and key buttons do not yet have icons.

### Task 2: Implement the minimal UI updates

**Files:**
- Modify: `app/arco-config-provider.tsx`
- Modify: `app/(internal)/_components/conversation-home.tsx`
- Modify: `app/(internal)/_components/session-workspace.tsx`
- Test: `tests/button-icons-rounding.test.ts`

**Step 1: Write minimal implementation**

- set Arco button `shape` to `round`
- use appropriate leading icons for:
  - create local session
  - clear all local data
  - delete record
  - back to history

**Step 2: Run focused test**

Run: `node --experimental-strip-types --test tests/button-icons-rounding.test.ts`
Expected: PASS

**Step 3: Run broader verification**

Run: `npm run test:node`
Expected: PASS

**Step 4: Run build verification**

Run: `npm run build:web`
Expected: PASS
