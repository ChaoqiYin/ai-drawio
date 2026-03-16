# Session Canvas History IndexedDB Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist AI-triggered pre-edit canvas snapshots into IndexedDB-backed history and expose restore actions in the session sidebar.

**Architecture:** Normalize local persistence into separate `conversations`, `messages`, and `canvasHistory` object stores with IndexedDB indexes for direct lookup by conversation and related message. Keep page-level callers mostly stable by adding query helpers that hydrate the session workspace sidebar from indexed records instead of array filtering.

**Tech Stack:** Next.js App Router, React, TypeScript, IndexedDB, Node test runner

---

## Chunk 1: Data Model And Store Refactor

### Task 1: Add normalized record types and timeline helpers

**Files:**
- Modify: `app/(internal)/_lib/conversation-model.ts`
- Test: `tests/conversation-model.test.ts`

- [ ] **Step 1: Write failing model tests for canvas history records and timeline merging**

- [ ] **Step 2: Run `npm run test:node -- tests/conversation-model.test.ts` and confirm the new assertions fail**

- [ ] **Step 3: Add normalized record types, helper constructors, and timeline merge helpers**

- [ ] **Step 4: Re-run `npm run test:node -- tests/conversation-model.test.ts` and confirm it passes**

### Task 2: Refactor IndexedDB storage into multiple stores

**Files:**
- Modify: `app/(internal)/_lib/conversation-store.ts`
- Test: `tests/conversation-store-api.test.ts`

- [ ] **Step 1: Write failing API-surface tests for normalized storage helpers**

- [ ] **Step 2: Run `npm run test:node -- tests/conversation-store-api.test.ts` and confirm it fails**

- [ ] **Step 3: Implement multi-store IndexedDB schema, indexed queries, migration-aware reads, and canvas snapshot helpers**

- [ ] **Step 4: Re-run `npm run test:node -- tests/conversation-store-api.test.ts` and confirm it passes**

## Chunk 2: Session Sidebar History And Restore Flow

### Task 3: Add sidebar timeline rendering and restore controls

**Files:**
- Modify: `app/(internal)/_components/session-workspace.tsx`
- Test: `tests/session-workspace-canvas-history-source.test.ts`

- [ ] **Step 1: Write failing source assertions for restore buttons and canvas history labels**

- [ ] **Step 2: Run `npm run test:node -- tests/session-workspace-canvas-history-source.test.ts` and confirm it fails**

- [ ] **Step 3: Render a mixed timeline in the sidebar and wire restore actions through the document bridge**

- [ ] **Step 4: Re-run `npm run test:node -- tests/session-workspace-canvas-history-source.test.ts` and confirm it passes**

### Task 4: Save pre-edit snapshots before AI document applies

**Files:**
- Modify: `app/(internal)/_components/session-workspace.tsx`
- Test: `tests/session-workspace-document-history-source.test.ts`

- [ ] **Step 1: Write failing source assertions for snapshot persistence before document apply**

- [ ] **Step 2: Run `npm run test:node -- tests/session-workspace-document-history-source.test.ts` and confirm it fails**

- [ ] **Step 3: Persist pre-apply snapshots with optional message linkage and reload sidebar state**

- [ ] **Step 4: Re-run `npm run test:node -- tests/session-workspace-document-history-source.test.ts` and confirm it passes**

## Chunk 3: Verification

### Task 5: Run full verification

**Files:**
- Test: `tests/*.ts`

- [ ] **Step 1: Run `npm run test:node`**

- [ ] **Step 2: Review failures and fix only regressions introduced by this change**

- [ ] **Step 3: Re-run `npm run test:node` and confirm a clean pass**
