# Settings Version Display Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the current app version in the settings page top navigation without affecting the existing tray settings behavior.

**Architecture:** Add a small frontend helper that resolves the current version from the Tauri runtime when available and falls back to the package version. Wire that helper into the settings page and render the label through the existing top navigation actions slot.

**Tech Stack:** Next.js App Router, React, Tauri API, Node test runner

---

## Chunk 1: Version Helper And Header Display

### Task 1: Lock the version display behavior in source tests

**Files:**
- Modify: `tests/settings-page-source.test.ts`
- Create: `tests/app-version-source.test.ts`
- Test: `tests/settings-page-source.test.ts`
- Test: `tests/app-version-source.test.ts`

- [ ] **Step 1: Write the failing tests**

Add source assertions that require:
- a version helper import in `app/(internal)/_components/settings-page.tsx`
- top navigation `actions` rendering with `当前版本`
- a dedicated helper module that imports Tauri app version access and defines a package-version fallback

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:node -- tests/settings-page-source.test.ts tests/app-version-source.test.ts`
Expected: FAIL because the current settings page has no version label and the helper file does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `app/(internal)/_lib/app-version.ts` with a single version lookup helper and update `app/(internal)/_components/settings-page.tsx` to load and display the version in the top navigation actions area.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:node -- tests/settings-page-source.test.ts tests/app-version-source.test.ts`
Expected: PASS

- [ ] **Step 5: Run focused regression verification**

Run: `npm run test:node`
Expected: PASS for the repository source-level test suite.
