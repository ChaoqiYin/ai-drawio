# Conversation Titles And Navigation Loading Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make local conversations easier to distinguish with incrementing titles and show a full-screen loading overlay when opening a session workspace.

**Architecture:** Keep conversation persistence in IndexedDB and generate the next default title from the current conversation list before creation. Keep navigation feedback inside the home page component so the overlay appears immediately when the user clicks create or opens an existing conversation.

**Tech Stack:** Next.js App Router, React, Arco Design, Node test runner, IndexedDB browser storage

---

### Task 1: Add incrementing local conversation titles

**Files:**
- Modify: `app/(internal)/_lib/conversation-model.ts`
- Modify: `app/(internal)/_lib/conversation-store.ts`
- Modify: `tests/conversation-model.test.ts`

**Step 1: Write the failing test**

Add tests for:
- extracting the next title index from existing conversation titles
- creating the next title as `本地 AI 会话 N`

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/conversation-model.test.ts`
Expected: FAIL because the title helper does not exist yet.

**Step 3: Write minimal implementation**

Add a helper in `conversation-model.ts` that:
- accepts a conversation title list
- finds titles matching the `本地 AI 会话 <number>` pattern
- returns the next number using `max + 1`

Update `createConversation` in `conversation-store.ts` to:
- load the current conversation list
- build the next title with the helper
- create and save the conversation with that generated title

**Step 4: Run test to verify it passes**

Run: `npm run test:node -- tests/conversation-model.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/(internal)/_lib/conversation-model.ts app/(internal)/_lib/conversation-store.ts tests/conversation-model.test.ts
git commit -m "feat: add incrementing local conversation titles"
```

### Task 2: Add full-screen loading overlay for session navigation

**Files:**
- Modify: `app/(internal)/_components/conversation-home.tsx`
- Add or Modify: `tests/conversation-home.test.ts`

**Step 1: Write the failing test**

Add tests for:
- showing a loading overlay when the create action starts navigation
- showing the same overlay when an existing conversation card is clicked
- keeping delete and clear actions unaffected

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/conversation-home.test.ts`
Expected: FAIL because the overlay state and UI are not implemented yet.

**Step 3: Write minimal implementation**

In `conversation-home.tsx`:
- add local state for `navigationTarget`
- set it before `router.push` on create and list item click
- render a full-screen overlay with clear loading copy while navigation is pending
- disable repeated navigation clicks while the overlay is visible

**Step 4: Run test to verify it passes**

Run: `npm run test:node -- tests/conversation-home.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/(internal)/_components/conversation-home.tsx tests/conversation-home.test.ts
git commit -m "feat: add navigation loading overlay"
```

### Task 3: Verify the combined behavior

**Files:**
- Modify: `tests/conversation-model.test.ts`
- Modify: `tests/conversation-home.test.ts`
- Modify: `tests/session-workspace-storage.test.ts`

**Step 1: Run focused verification**

Run: `npm run test:node -- tests/conversation-model.test.ts tests/conversation-home.test.ts tests/session-workspace-storage.test.ts`
Expected: PASS

**Step 2: Run broader regression verification**

Run: `npm run test:node`
Expected: PASS

**Step 3: Commit**

```bash
git add docs/plans/2026-03-13-conversation-titles-and-navigation-loading.md
git commit -m "docs: add implementation plan for conversation titles and loading"
```
