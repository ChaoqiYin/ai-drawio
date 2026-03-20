# Settings Tray Button Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the settings page tray status switch with an icon-and-text button that immediately sends the app to tray when clicked.

**Architecture:** Keep the existing Tauri tray command path unchanged and only update the settings page control. Preserve the current tray status polling and runtime refresh logic so the page still reflects tray state and errors.

**Tech Stack:** Next.js App Router, React, Arco Design, Node test runner

---

## Chunk 1: Source-Tested UI Control Swap

### Task 1: Lock the new control in source tests

**Files:**
- Modify: `tests/settings-page-source.test.ts`
- Test: `tests/settings-page-source.test.ts`

- [ ] **Step 1: Write the failing test**

Update the existing settings page source assertions so they require:
- `Button` instead of `Switch`
- `IconToBottom` import and `icon={<IconToBottom />}`
- a handler that directly calls `setTrayEnabled(true)`
- button text `进入托盘`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/settings-page-source.test.ts`
Expected: FAIL because the current source still renders a switch.

- [ ] **Step 3: Write minimal implementation**

Update `app/(internal)/_components/settings-page.tsx` to replace the tray switch with an Arco button that uses the tray-enable command path and existing loading/error state.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:node -- tests/settings-page-source.test.ts`
Expected: PASS

- [ ] **Step 5: Run focused regression verification**

Run: `npm run test:node`
Expected: PASS for the relevant source-level test suite.
