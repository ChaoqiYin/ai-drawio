# CLI Conversation Create And Session Guard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a CLI command that creates a persisted conversation record and block session detail access when the referenced stored conversation does not exist.

**Architecture:** Keep persistence ownership in the browser storage layer by exposing a reusable conversation creation helper from the shared store module and using it from both the home page and a new browser-aware CLI command path. Add a small route guard flow that writes a one-time home-page error message before redirecting invalid session detail visits back to `/`.

**Tech Stack:** TypeScript, Next.js App Router, React, IndexedDB, Node test runner

---

### Task 1: Save the approved design constraints

**Files:**
- Create: `docs/plans/2026-03-13-cli-conversation-create-and-session-guard.md`

**Step 1: Record the constraints**

Write down the non-negotiable requirements:

- CLI must expose an explicit persisted conversation creation command.
- CLI must not rely on temporary session ids.
- Session detail route must reject missing `id` and unknown stored ids.
- Invalid session detail visits must surface an error on the home page after redirect.

**Step 2: Keep the scope minimal**

Do not add new storage backends, server APIs, or temporary identifiers.

### Task 2: Add failing tests for CLI parsing and redirect state helpers

**Files:**
- Modify: `tests/ai-drawio-cli.test.ts`
- Create: `tests/conversation-route-state.test.ts`
- Test: `tests/ai-drawio-cli.test.ts`
- Test: `tests/conversation-route-state.test.ts`

**Step 1: Write the failing CLI parsing test**

Add a test that expects `parseCliArgs(["conversation", "create"])` to return a dedicated create command with no session id.

**Step 2: Run the CLI test to verify it fails**

Run: `npm run test:node -- tests/ai-drawio-cli.test.ts`
Expected: FAIL because the parser does not yet support `conversation create`.

**Step 3: Write the failing route-state helper tests**

Add tests for one-time home error storage helpers:

- save and read a redirect error
- clear the redirect error after read
- no-op safely when `window` is unavailable

**Step 4: Run the helper test to verify it fails**

Run: `npm run test:node -- tests/conversation-route-state.test.ts`
Expected: FAIL because the helper module does not exist yet.

### Task 3: Add failing source tests for guarded session navigation

**Files:**
- Create: `tests/session-route-guard-source.test.ts`
- Modify: `tests/conversation-home-source.test.ts`
- Test: `tests/session-route-guard-source.test.ts`
- Test: `tests/conversation-home-source.test.ts`

**Step 1: Write the failing session guard source test**

Assert the session workspace source:

- imports `useRouter`
- redirects with `router.replace('/')`
- persists a redirect error before redirect
- stops access when the selected stored conversation is missing

**Step 2: Write the failing home source test extension**

Assert the home page source reads a redirect error helper on load.

**Step 3: Run the source tests to verify they fail**

Run: `npm run test:node -- tests/session-route-guard-source.test.ts tests/conversation-home-source.test.ts`
Expected: FAIL because the redirect helper is not yet wired.

### Task 4: Implement the minimal CLI and route-state helpers

**Files:**
- Modify: `scripts/ai-drawio-cli.ts`
- Create: `app/(internal)/_lib/conversation-route-state.ts`

**Step 1: Add the CLI parser branch**

Support:

```ts
if (root === "conversation") {
  const action = args.shift();
  if (action !== "create") {
    fail("conversation 仅支持 create");
  }
}
```

Return a dedicated command such as `conversation.create` without any temporary session id.

**Step 2: Add one-time redirect error helpers**

Create a small browser-only helper around `window.sessionStorage` with functions for:

- writing the home redirect error
- reading and clearing the home redirect error

**Step 3: Re-run targeted tests**

Run: `npm run test:node -- tests/ai-drawio-cli.test.ts tests/conversation-route-state.test.ts`
Expected: PASS

### Task 5: Implement the guarded session flow and home error recovery

**Files:**
- Modify: `app/(internal)/_components/session-workspace.tsx`
- Modify: `app/(internal)/_components/conversation-home.tsx`
- Modify: `app/(internal)/_lib/conversation-store.ts`

**Step 1: Reuse a shared persisted conversation creator**

Expose a helper that creates and stores a conversation record so both the home page and CLI-facing code paths use the same persisted logic.

**Step 2: Guard the session page**

In the session workspace:

- import `useRouter`
- when `id` is missing, save a home redirect error and `replace('/')`
- when `getConversationById(id)` returns nothing, save a home redirect error and `replace('/')`
- avoid continuing bootstrap work for invalid visits

**Step 3: Recover and show the redirect error on the home page**

On home mount, read the one-time redirect error helper and surface it through the existing error banner.

**Step 4: Re-run source tests**

Run: `npm run test:node -- tests/session-route-guard-source.test.ts tests/conversation-home-source.test.ts`
Expected: PASS

### Task 6: Verify the focused regression set

**Files:**
- Test: `tests/ai-drawio-cli.test.ts`
- Test: `tests/conversation-route-state.test.ts`
- Test: `tests/conversation-home-source.test.ts`
- Test: `tests/session-route-guard-source.test.ts`
- Test: `tests/conversation-store-api.test.ts`
- Test: `tests/conversation-model.test.ts`

**Step 1: Run the focused suite**

Run: `npm run test:node -- tests/ai-drawio-cli.test.ts tests/conversation-route-state.test.ts tests/conversation-home-source.test.ts tests/session-route-guard-source.test.ts tests/conversation-store-api.test.ts tests/conversation-model.test.ts`

**Step 2: Fix any failures minimally**

Only change code that is necessary to satisfy the approved behavior.

**Step 3: Confirm no temporary session id path remains in the new CLI flow**

Review the CLI implementation and ensure the create command returns a persisted conversation id only.
