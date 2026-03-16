# Conversation Rename Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add manual conversation renaming from the home list with IndexedDB persistence and immediate UI updates.

**Architecture:** Extend the conversation store with a rename helper that updates the existing record title and `updatedAt`. Add modal-driven rename state to the home page, then update the local list with the saved record and preserve the existing navigation overlay behavior.

**Tech Stack:** Next.js App Router, React, Arco Design, IndexedDB, Node test runner

---

### Task 1: Add store-level rename support

**Files:**
- Modify: `app/(internal)/_lib/conversation-store.ts`
- Modify: `tests/conversation-store-api.test.ts`

**Step 1: Write the failing test**

Add a test that requires `updateConversationTitle` to be exported from the store module.

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/conversation-store-api.test.ts`
Expected: FAIL because the rename helper is missing.

**Step 3: Write minimal implementation**

Add `updateConversationTitle(id, title)` that:
- loads the existing conversation
- trims the incoming title
- throws on empty title
- updates `title` and `updatedAt`
- persists via `saveConversation`
- returns the updated record

**Step 4: Run test to verify it passes**

Run: `npm run test:node -- tests/conversation-store-api.test.ts`
Expected: PASS

### Task 2: Add home-list rename UI

**Files:**
- Modify: `app/(internal)/_components/conversation-home.tsx`
- Modify: `tests/conversation-home-source.test.ts`

**Step 1: Write the failing test**

Add assertions for:
- rename modal state
- rename action button
- modal rendering
- rename submit handler

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/conversation-home-source.test.ts`
Expected: FAIL because rename UI is not implemented yet.

**Step 3: Write minimal implementation**

Update the home page to:
- track the active conversation being renamed
- prefill the current title in an input modal
- validate non-empty trimmed titles
- save with `updateConversationTitle`
- update local list state with the returned record
- keep delete/navigation actions disabled while conflicting work is in progress

**Step 4: Run test to verify it passes**

Run: `npm run test:node -- tests/conversation-home-source.test.ts`
Expected: PASS

### Task 3: Verify the full change set

**Files:**
- Modify: `tests/conversation-store-api.test.ts`
- Modify: `tests/conversation-home-source.test.ts`

**Step 1: Run focused verification**

Run: `npm run test:node -- tests/conversation-store-api.test.ts tests/conversation-home-source.test.ts`
Expected: PASS

**Step 2: Run full verification**

Run: `npm run test:node`
Expected: PASS
