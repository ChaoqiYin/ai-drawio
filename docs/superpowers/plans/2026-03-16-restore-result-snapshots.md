# Restore Result Snapshots Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change restore behavior to recover the canvas state produced after each AI turn without deleting later history, and expose the initial welcome message as a restorable blank-canvas state.

**Architecture:** Keep using `canvasHistory` as the persisted snapshot store, but change its write timing from pre-apply to post-apply. The session workspace will restore by applying a chosen snapshot only, while timeline rendering gains a linked restore action for assistant messages such as the welcome message when a snapshot is attached to that message id.

**Tech Stack:** Next.js, React, TypeScript, IndexedDB, node:test

---

### Task 1: Lock new restore semantics with failing source tests

**Files:**
- Modify: `tests/session-workspace-document-history-source.test.ts`
- Modify: `tests/session-workspace-restore-preview-source.test.ts`
- Modify: `tests/session-workspace-canvas-history-source.test.ts`
- Modify: `tests/conversation-store-api.test.ts`

- [ ] **Step 1: Write failing source assertions for post-apply snapshots and non-destructive restore**
- [ ] **Step 2: Run `npm run test:node -- tests/session-workspace-document-history-source.test.ts tests/session-workspace-restore-preview-source.test.ts tests/session-workspace-canvas-history-source.test.ts tests/conversation-store-api.test.ts` and verify failure**
- [ ] **Step 3: Implement the minimal source changes to satisfy those assertions**
- [ ] **Step 4: Re-run the same command and verify pass**

### Task 2: Write result snapshots after AI apply and backfill the welcome snapshot

**Files:**
- Modify: `app/(internal)/_components/session-workspace.tsx`
- Modify: `app/(internal)/_lib/conversation-model.ts`
- Modify: `app/(internal)/_lib/conversation-store.ts`
- Modify: `tests/session-workspace-ai-prompt-source.test.ts`

- [ ] **Step 1: Write failing tests for welcome-message restore linkage and post-apply snapshot timing**
- [ ] **Step 2: Run focused tests and verify failure**
- [ ] **Step 3: Implement post-apply snapshot persistence plus initial blank-canvas snapshot creation**
- [ ] **Step 4: Re-run focused tests and verify pass**

### Task 3: Align timeline and restore UI with the new semantics

**Files:**
- Modify: `app/(internal)/_components/session-workspace.tsx`
- Modify: `tests/session-workspace-canvas-history-source.test.ts`
- Modify: `tests/session-workspace-restore-preview-source.test.ts`

- [ ] **Step 1: Write failing tests for `恢复到此版本` and assistant-message restore buttons**
- [ ] **Step 2: Run focused tests and verify failure**
- [ ] **Step 3: Implement the UI updates without deleting conversation history on restore**
- [ ] **Step 4: Re-run focused tests and verify pass**

### Task 4: Run final verification

**Files:**
- Test: `tests/conversation-model.test.ts`
- Test: `tests/conversation-store-api.test.ts`
- Test: `tests/session-workspace-ai-prompt-source.test.ts`
- Test: `tests/session-workspace-canvas-history-source.test.ts`
- Test: `tests/session-workspace-document-history-source.test.ts`
- Test: `tests/session-workspace-restore-preview-source.test.ts`

- [ ] **Step 1: Run `npm run test:node -- tests/conversation-model.test.ts tests/conversation-store-api.test.ts tests/session-workspace-ai-prompt-source.test.ts tests/session-workspace-canvas-history-source.test.ts tests/session-workspace-document-history-source.test.ts tests/session-workspace-restore-preview-source.test.ts`**
- [ ] **Step 2: Confirm the command exits with 0 failures before claiming completion**
