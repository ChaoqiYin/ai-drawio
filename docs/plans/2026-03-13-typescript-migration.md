# TypeScript Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert all non-`webapp/` JavaScript source files to TypeScript, using `.tsx` for React-rendering files and `.ts` for non-component code.

**Architecture:** Migrate the App Router files and React client components to `.tsx`, move library modules, scripts, and tests to `.ts`, and update the Node execution path to use built-in type stripping. Add the minimal TypeScript configuration and type dependencies required for Next.js to build successfully.

**Tech Stack:** Next.js App Router, React, TypeScript, Node.js test runner, Tauri

---

### Task 1: Write the failing migration regression test

**Files:**
- Create: `tests/typescript-migration.test.mjs`

**Step 1: Write the failing test**

Assert that:

- `app/layout.tsx` exists
- route and component files exist as `.tsx`
- libs, scripts, and tests exist as `.ts`
- legacy `.js` and `.mjs` file names no longer exist
- `package.json` uses `node --experimental-strip-types`
- `tsconfig.json` exists

**Step 2: Run test to verify it fails**

Run: `node --test tests/typescript-migration.test.mjs`
Expected: FAIL because the project still uses `.js/.mjs` files and has no `tsconfig.json`.

### Task 2: Migrate source files to `.ts/.tsx`

**Files:**
- Modify: `app/layout.js`
- Modify: `app/(internal)/page.js`
- Modify: `app/(internal)/session/page.js`
- Modify: `app/(internal)/_components/conversation-home.js`
- Modify: `app/(internal)/_components/session-workspace.js`
- Modify: `app/(internal)/_lib/conversation-model.js`
- Modify: `app/(internal)/_lib/conversation-store.js`
- Modify: `scripts/prepare-drawio.mjs`
- Modify: `scripts/ai-drawio-cli.mjs`
- Modify: `tests/*.mjs`

**Step 1: Rename files and update imports**

Move React-rendering files to `.tsx` and move non-component files to `.ts`.

**Step 2: Add minimal TypeScript annotations**

Add only the types required to keep the codebase coherent and compilable.

### Task 3: Update toolchain for TypeScript

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tsconfig.json`

**Step 1: Add TypeScript dependencies**

Add `typescript`, `@types/node`, `@types/react`, and `@types/react-dom`.

**Step 2: Update Node execution scripts**

Use `node --experimental-strip-types` for `.ts` scripts and tests.

**Step 3: Add TypeScript project configuration**

Create the minimal Next-compatible `tsconfig.json`.

### Task 4: Verify

**Files:**
- No file changes required

**Step 1: Run the migration regression test**

Run: `node --test --experimental-strip-types tests/typescript-migration.test.ts`
Expected: PASS

**Step 2: Run all Node tests**

Run: `npm run test:node`
Expected: PASS

**Step 3: Run frontend build**

Run: `npm run build:web`
Expected: PASS
