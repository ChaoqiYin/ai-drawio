# Conversation Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Synchronize the home conversation list inside the same app instance after conversation data changes elsewhere.

**Architecture:** Add a store-level subscription helper that emits lightweight change events after successful IndexedDB mutations. Update the home page to subscribe on mount and refresh the list via `listConversations()` when a mutation event arrives.

**Tech Stack:** Next.js App Router, React, IndexedDB, browser events, Node test runner

---

### Task 1: Add a failing store API test

**Files:**
- Modify: `tests/conversation-store-api.test.ts`

**Step 1: Write the failing test**

Add an assertion for a `subscribeConversationChanges` export.

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/conversation-store-api.test.ts`
Expected: FAIL because the subscription helper does not exist yet.

### Task 2: Implement store-level change events

**Files:**
- Modify: `app/(internal)/_lib/conversation-store.ts`

**Step 1: Write minimal implementation**

Add:
- a stable browser event name
- `subscribeConversationChanges(listener)` that returns an unsubscribe function
- event emission after successful create, rename, delete, and clear operations

**Step 2: Run test to verify it passes**

Run: `npm run test:node -- tests/conversation-store-api.test.ts`
Expected: PASS

### Task 3: Add a failing home source test

**Files:**
- Modify: `tests/conversation-home-source.test.ts`

**Step 1: Write the failing test**

Add assertions requiring:
- `subscribeConversationChanges`
- a shared list reload function
- event subscription inside an effect

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/conversation-home-source.test.ts`
Expected: FAIL because the page is not subscribed yet.

### Task 4: Implement home-page synchronization

**Files:**
- Modify: `app/(internal)/_components/conversation-home.tsx`

**Step 1: Write minimal implementation**

Refactor the home page to:
- centralize list loading in one helper
- subscribe to store changes on mount
- re-fetch the list when an event arrives
- keep the existing loading and error behavior

**Step 2: Run test to verify it passes**

Run: `npm run test:node -- tests/conversation-home-source.test.ts`
Expected: PASS

### Task 5: Verify the full change

**Files:**
- Modify: `tests/conversation-store-api.test.ts`
- Modify: `tests/conversation-home-source.test.ts`

**Step 1: Run full verification**

Run: `npm run test:node`
Expected: PASS
