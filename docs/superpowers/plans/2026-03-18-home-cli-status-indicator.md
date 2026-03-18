# Home CLI Status Indicator Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a desktop-style CLI status lamp to the home page and move settings into a dedicated icon-only toolbar button while reusing the settings page status semantics exactly.

**Architecture:** Extract the CLI status label/color mapping into a shared helper under the internal frontend library, then consume it from both the settings page and the home page. Refactor the home page header into a toolbar row plus action content so the UI reads like a desktop window instead of a web action strip.

**Tech Stack:** Next.js App Router, React, Arco Design, Node `node:test` source assertions

---

## Chunk 1: Shared CLI Status Presentation

### Task 1: Add the shared status helper

**Files:**
- Create: `app/(internal)/_lib/cli-install-status-presentation.ts`
- Test: `tests/cli-install-status-source.test.ts`

- [ ] **Step 1: Write the failing test**
Add assertions that a dedicated helper exports `getCliInstallStatusLabel` and `getCliInstallStatusColor`.

- [ ] **Step 2: Run test to verify it fails**
Run: `node --experimental-strip-types --test tests/cli-install-status-source.test.ts`
Expected: FAIL because the helper file does not exist yet.

- [ ] **Step 3: Write minimal implementation**
Create a small shared helper that maps the existing CLI install status union to label and Arco tag color.

- [ ] **Step 4: Run test to verify it passes**
Run: `node --experimental-strip-types --test tests/cli-install-status-source.test.ts`
Expected: PASS.

## Chunk 2: Home Header Refactor

### Task 2: Cover the home toolbar structure

**Files:**
- Modify: `tests/conversation-home-source.test.ts`
- Modify: `tests/settings-page-source.test.ts`
- Test: `tests/cli-install-status-source.test.ts`

- [ ] **Step 1: Write the failing test**
Add assertions that the home page imports the shared status helper, loads CLI install status, renders a toolbar row with a status lamp, and uses an icon-only settings button.

- [ ] **Step 2: Run test to verify it fails**
Run: `node --experimental-strip-types --test tests/conversation-home-source.test.ts tests/settings-page-source.test.ts tests/cli-install-status-source.test.ts`
Expected: FAIL because the source still uses inline settings-page helpers and a text settings button.

- [ ] **Step 3: Write minimal implementation**
Refactor the home page header and update the settings page to import the shared helper.

- [ ] **Step 4: Run test to verify it passes**
Run: `node --experimental-strip-types --test tests/conversation-home-source.test.ts tests/settings-page-source.test.ts tests/cli-install-status-source.test.ts`
Expected: PASS.

## Chunk 3: Verification

### Task 3: Run the relevant full verification

**Files:**
- Modify: `app/(internal)/_components/conversation-home.tsx`
- Modify: `app/(internal)/_components/settings-page.tsx`
- Modify: `app/(internal)/_lib/cli-install-status-presentation.ts`

- [ ] **Step 1: Run the targeted source tests**
Run: `node --experimental-strip-types --test tests/conversation-home-source.test.ts tests/settings-page-source.test.ts tests/cli-install-status-source.test.ts`
Expected: PASS.

- [ ] **Step 2: Run the repository node test suite**
Run: `npm run test:node`
Expected: PASS with zero failures.
