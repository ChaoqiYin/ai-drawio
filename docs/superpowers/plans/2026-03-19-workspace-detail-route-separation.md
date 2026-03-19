# Workspace Detail Route Separation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split home and workspace detail into separate routes, move multi-session tab management into `/session`, and relocate rename/readiness UI from the workspace header into the detail-page tab strip.

**Architecture:** Introduce a small in-memory Zustand store as the single source of truth for opened workspace metadata and the active workspace id. Home becomes a pure index route that seeds the detail store before navigation, while `/session` becomes the only owner of the top navigation, tab strip, and mounted workspace hosts. Session workspace instances remain mounted behind hidden tabs so runtime continuity is preserved.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Arco Design, Zustand, node:test source tests

---

## Chunk 1: Route Boundary And Detail Store

### Task 1: Add Zustand And Create The Detail Store

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `app/(internal)/_lib/workspace-session-store.ts`
- Create: `tests/workspace-session-store.test.ts`

- [ ] **Step 1: Add the new dependency declaration**

Update `package.json` dependencies to include:

```json
"zustand": "^5.0.8"
```

Keep the existing dependency ordering style intact.

- [ ] **Step 2: Install the dependency and update the lockfile**

Run:

```bash
npm install
```

Expected:

- `package-lock.json` records the new `zustand` dependency
- subsequent tests can resolve `zustand` without module-not-found errors

- [ ] **Step 3: Write the failing store test**

Create `tests/workspace-session-store.test.ts` with source-level state coverage for:

```ts
import test from "node:test";
import assert from "node:assert/strict";

import {
  createWorkspaceSessionStore,
  type WorkspaceSessionSummary,
} from "../app/(internal)/_lib/workspace-session-store";

const alpha: WorkspaceSessionSummary = {
  id: "alpha",
  title: "Alpha",
  updatedAt: "2026-03-19T10:00:00.000Z",
  isReady: false,
};

const beta: WorkspaceSessionSummary = {
  id: "beta",
  title: "Beta",
  updatedAt: "2026-03-19T10:05:00.000Z",
  isReady: true,
};

test("enterSessionDetail replaces opened sessions with the selected session", () => {
  const store = createWorkspaceSessionStore();

  store.getState().enterSessionDetail(alpha);

  assert.deepEqual(store.getState().openedSessions, [alpha]);
  assert.equal(store.getState().activeSessionId, "alpha");
});

test("openSession appends without duplication and activates the target session", () => {
  const store = createWorkspaceSessionStore();

  store.getState().enterSessionDetail(alpha);
  store.getState().openSession(beta);
  store.getState().openSession(alpha);

  assert.deepEqual(store.getState().openedSessions, [alpha, beta]);
  assert.equal(store.getState().activeSessionId, "alpha");
});

test("closeSession removes the target and falls back to the nearest remaining session", () => {
  const store = createWorkspaceSessionStore();

  store.getState().enterSessionDetail(alpha);
  store.getState().openSession(beta);
  store.getState().closeSession("beta");

  assert.deepEqual(store.getState().openedSessions, [alpha]);
  assert.equal(store.getState().activeSessionId, "alpha");
});

test("activateSession only updates the active session id", () => {
  const store = createWorkspaceSessionStore();

  store.getState().enterSessionDetail(alpha);
  store.getState().openSession(beta);
  store.getState().activateSession("alpha");

  assert.deepEqual(store.getState().openedSessions, [alpha, beta]);
  assert.equal(store.getState().activeSessionId, "alpha");
});

test("resetSessionDetail clears the whole detail session lifecycle", () => {
  const store = createWorkspaceSessionStore();

  store.getState().enterSessionDetail(alpha);
  store.getState().resetSessionDetail();

  assert.deepEqual(store.getState().openedSessions, []);
  assert.equal(store.getState().activeSessionId, "");
});
```

- [ ] **Step 4: Run the store test to verify it fails**

Run:

```bash
npm run test:node -- tests/workspace-session-store.test.ts
```

Expected:

- FAIL because `workspace-session-store.ts` does not exist yet
- or FAIL because required exports/actions are missing

- [ ] **Step 5: Write the minimal Zustand store**

Create `app/(internal)/_lib/workspace-session-store.ts` with:

- a `WorkspaceSessionSummary` type containing `id`, `title`, `updatedAt`, `isReady`
- a `WorkspaceSessionState` type containing `openedSessions`, `activeSessionId`, and all actions
- a reusable `createWorkspaceSessionStore()` factory for tests
- a `useWorkspaceSessionStore` hook backed by Zustand for app usage
- helper logic that prevents duplicate sessions by id
- `closeSession()` fallback behavior that activates the nearest remaining neighbor

Implement the shape explicitly, for example:

```ts
import { create, type StoreApi, type UseBoundStore } from "zustand";

export type WorkspaceSessionSummary = {
  id: string;
  isReady: boolean;
  title: string;
  updatedAt: string;
};

type WorkspaceSessionState = {
  activeSessionId: string;
  openedSessions: WorkspaceSessionSummary[];
  activateSession: (sessionId: string) => void;
  closeSession: (sessionId: string) => void;
  enterSessionDetail: (session: WorkspaceSessionSummary) => void;
  openSession: (session: WorkspaceSessionSummary) => void;
  resetSessionDetail: () => void;
  updateSessionMeta: (sessionId: string, patch: Partial<Omit<WorkspaceSessionSummary, "id">>) => void;
};

function buildWorkspaceSessionStore() {
  return create<WorkspaceSessionState>((set) => ({
    activeSessionId: "",
    openedSessions: [],
    activateSession: (sessionId) => set({ activeSessionId: sessionId }),
    enterSessionDetail: (session) =>
      set({
        activeSessionId: session.id,
        openedSessions: [session],
      }),
    openSession: (session) =>
      set((state) => {
        const exists = state.openedSessions.some((item) => item.id === session.id);
        return {
          activeSessionId: session.id,
          openedSessions: exists
            ? state.openedSessions
            : [...state.openedSessions, session],
        };
      }),
    closeSession: (sessionId) =>
      set((state) => {
        const currentIndex = state.openedSessions.findIndex((item) => item.id === sessionId);
        const nextSessions = state.openedSessions.filter((item) => item.id !== sessionId);
        const fallbackSession =
          nextSessions[currentIndex] ?? nextSessions[currentIndex - 1] ?? null;

        return {
          activeSessionId:
            state.activeSessionId === sessionId ? (fallbackSession?.id ?? "") : state.activeSessionId,
          openedSessions: nextSessions,
        };
      }),
    updateSessionMeta: (sessionId, patch) =>
      set((state) => ({
        openedSessions: state.openedSessions.map((item) =>
          item.id === sessionId ? { ...item, ...patch } : item,
        ),
      })),
    resetSessionDetail: () => ({
      activeSessionId: "",
      openedSessions: [],
    }),
  }));
}

export function createWorkspaceSessionStore(): UseBoundStore<StoreApi<WorkspaceSessionState>> {
  return buildWorkspaceSessionStore();
}

export const useWorkspaceSessionStore = buildWorkspaceSessionStore();
```

- [ ] **Step 6: Run the store test to verify it passes**

Run:

```bash
npm run test:node -- tests/workspace-session-store.test.ts
```

Expected:

- PASS for all store lifecycle tests

- [ ] **Step 7: Commit the store slice**

Run:

```bash
git add package.json package-lock.json app/(internal)/_lib/workspace-session-store.ts tests/workspace-session-store.test.ts
git commit -m "feat: add workspace detail session store"
```

### Task 2: Move Home Back To An Index Route

**Files:**
- Modify: `app/(internal)/page.tsx`
- Modify: `app/(internal)/_components/conversation-home.tsx`
- Modify: `tests/conversation-home-source.test.ts`
- Modify: `tests/session-tabs-shell-source.test.ts`

- [ ] **Step 1: Write the failing route-boundary tests**

Update the tests so they assert the new route ownership:

- `tests/session-tabs-shell-source.test.ts`
  - home page renders `ConversationHome`
  - home page does not render `SessionTabsShell`
- `tests/conversation-home-source.test.ts`
  - component no longer accepts `onOpenSessionTab`
  - component uses the workspace detail store and `router.push("/session")`
  - component still preserves delete, rename, create, and settings behavior

Concrete assertions to add:

```ts
assert.match(source, /ConversationHome/);
assert.doesNotMatch(source, /SessionTabsShell/);
assert.doesNotMatch(source, /onOpenSessionTab/);
assert.match(source, /useWorkspaceSessionStore/);
assert.match(source, /enterSessionDetail/);
assert.match(source, /router\.push\("\/session"\)/);
```

- [ ] **Step 2: Run the route-boundary tests to verify they fail**

Run:

```bash
npm run test:node -- tests/conversation-home-source.test.ts tests/session-tabs-shell-source.test.ts
```

Expected:

- FAIL because home still renders `SessionTabsShell`
- FAIL because `ConversationHome` still depends on `onOpenSessionTab`

- [ ] **Step 3: Refactor the home route**

Update `app/(internal)/page.tsx` to:

```tsx
import ConversationHome from "./_components/conversation-home";

export default function HomePage() {
  return <ConversationHome />;
}
```

- [ ] **Step 4: Refactor home navigation to seed the detail store**

In `app/(internal)/_components/conversation-home.tsx`:

- remove the `ConversationHomeProps` type and `onOpenSessionTab` prop
- import `useWorkspaceSessionStore`
- read `enterSessionDetail` from the store
- when opening an existing or newly created conversation, call:

```ts
enterSessionDetail({
  id: conversation.id,
  isReady: false,
  title: conversation.title,
  updatedAt: conversation.updatedAt,
});

router.push("/session");
```

- preserve the existing transition overlay behavior by keeping `navigationTarget`
- after create-session success, seed the store with the created conversation before navigating

Use one helper to avoid duplication:

```ts
function openConversation(conversation: ConversationRecord, options?: { force?: boolean }) {
  if (shouldSuppressNavigation()) {
    return;
  }

  if (navigationTarget && !options?.force) {
    return;
  }

  setNavigationTarget(conversation.title);
  startTransition(() => {
    enterSessionDetail({
      id: conversation.id,
      isReady: false,
      title: conversation.title,
      updatedAt: conversation.updatedAt,
    });
    router.push("/session");
  });
}
```

- [ ] **Step 5: Re-run the route-boundary tests**

Run:

```bash
npm run test:node -- tests/conversation-home-source.test.ts tests/session-tabs-shell-source.test.ts
```

Expected:

- PASS with home now isolated from the tab shell

- [ ] **Step 6: Commit the route-boundary slice**

Run:

```bash
git add app/(internal)/page.tsx app/(internal)/_components/conversation-home.tsx tests/conversation-home-source.test.ts tests/session-tabs-shell-source.test.ts
git commit -m "refactor: separate home route from workspace detail shell"
```

## Chunk 2: Detail Shell, Tab Header, And Runtime Integration

### Task 3: Make `/session` The Only Owner Of The Detail Shell

**Files:**
- Modify: `app/(internal)/session/page.tsx`
- Modify: `app/(internal)/_components/session-route-shell.tsx`
- Modify: `app/(internal)/_components/session-tabs-shell.tsx`
- Modify: `tests/session-tabs-shell-source.test.ts`
- Modify: `tests/internal-top-navigation-source.test.ts`

- [ ] **Step 1: Write the failing detail-shell tests**

Update source tests to assert:

- `/session` renders the detail shell
- `SessionTabsShell` no longer renders `ConversationHome`
- `SessionTabsShell` consumes `useWorkspaceSessionStore`
- the shell renders top navigation before tabs
- the shell back handler explicitly resets detail state and routes to `/`

Add concrete assertions such as:

```ts
assert.doesNotMatch(source, /ConversationHome/);
assert.match(source, /useWorkspaceSessionStore/);
assert.match(source, /resetSessionDetail/);
assert.match(source, /router\.push\("\/"\)/);
assert.match(source, /<InternalTopNavigation/);
assert.match(source, /<Tabs/);
```

- [ ] **Step 2: Run the detail-shell tests to verify they fail**

Run:

```bash
npm run test:node -- tests/session-tabs-shell-source.test.ts tests/internal-top-navigation-source.test.ts
```

Expected:

- FAIL because the shell still embeds `ConversationHome`
- FAIL because the shell still owns local `useState` session arrays

- [ ] **Step 3: Make `/session/page.tsx` the only route entry for the detail shell**

Update `app/(internal)/session/page.tsx` so it remains the sole route entry that imports and renders `SessionRouteShell` inside `Suspense`, for example:

```tsx
import { Suspense } from "react";

import SessionRouteShell from "../_components/session-route-shell";

export default function SessionPage() {
  return (
    <Suspense fallback={null}>
      <SessionRouteShell />
    </Suspense>
  );
}
```

Update the related source assertions so `/session/page.tsx` is explicitly verified as the route-level owner of the detail shell.

- [ ] **Step 4: Simplify the session route shell**

Update `app/(internal)/_components/session-route-shell.tsx` so it no longer depends on query parameters and simply renders the detail shell:

```tsx
'use client';

import SessionTabsShell from './session-tabs-shell';

export default function SessionRouteShell() {
  return <SessionTabsShell />;
}
```

- [ ] **Step 5: Refactor the detail shell around the Zustand store**

In `app/(internal)/_components/session-tabs-shell.tsx`:

- remove local `useState` ownership for `openedSessionIds`, `activeSessionId`, `sessionTitles`
- import `useRouter`, `useWorkspaceSessionStore`, `InternalBreadcrumb`, `InternalTopNavigation`
- derive `openedSessions` and `activeSessionId` from the store
- wire `openSessionTab`, `ensureSessionTab`, and close handlers to store actions
- keep `setSessionShellControls()` integration, but make `openSessionTab(sessionId, title?)` update the store by id/title metadata instead of component-local state
- if `openedSessions` becomes empty, redirect to `/`
- back button handler must call `resetSessionDetail()` and `router.push("/")`

The shell layout should look like:

```tsx
<Layout className={shellClassName}>
  <Content className="relative z-[1]">
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <InternalTopNavigation
        onBack={handleBackToHome}
        content={<InternalBreadcrumb dataLayout="workspace-breadcrumb" routes={breadcrumbRoutes} />}
      />
      <Tabs activeTab={activeSessionId} onChange={activateSession} type="rounded">
        {openedSessions.map((session) => (
          <Tabs.TabPane key={session.id} title={renderSessionTabTitle(session)} />
        ))}
      </Tabs>
      <div className="relative min-h-0 flex flex-1 flex-col gap-4">
        {openedSessions.map((session) => (
          <SessionWorkspaceHost
            key={session.id}
            hidden={session.id !== activeSessionId}
            sessionId={session.id}
          />
        ))}
      </div>
    </Space>
  </Content>
</Layout>
```

- [ ] **Step 6: Re-run the detail-shell tests**

Run:

```bash
npm run test:node -- tests/session-tabs-shell-source.test.ts tests/internal-top-navigation-source.test.ts
```

Expected:

- PASS with `/session` owning the only detail shell

- [ ] **Step 7: Commit the detail-shell slice**

Run:

```bash
git add app/(internal)/session/page.tsx app/(internal)/_components/session-route-shell.tsx app/(internal)/_components/session-tabs-shell.tsx tests/session-tabs-shell-source.test.ts tests/internal-top-navigation-source.test.ts
git commit -m "refactor: move workspace tabs into session detail route"
```

### Task 4: Move Rename And Readiness Into The Active Tab Header

**Files:**
- Modify: `app/(internal)/_components/session-tabs-shell.tsx`
- Modify: `app/(internal)/_components/session-workspace.tsx`
- Modify: `app/(internal)/_lib/session-runtime-registry.ts`
- Modify: `tests/session-workspace-session-switch-source.test.ts`
- Create: `tests/workspace-detail-tab-header-source.test.ts`

- [ ] **Step 1: Write the failing tab-header tests**

Create `tests/workspace-detail-tab-header-source.test.ts` and update `tests/session-workspace-session-switch-source.test.ts` to verify:

- active tab header includes title, readiness label, rename entry, close action
- inactive tabs do not include the full rename UI
- `session-workspace.tsx` no longer renders rename and readiness in the top navigation region
- workspace hosts remain mounted and only hidden when inactive

Concrete assertions to include:

```ts
assert.match(shellSource, /renderSessionTabTitle/);
assert.match(shellSource, /session\.isReady \? 'draw\.io 已就绪' : '正在加载 draw\.io'/);
assert.match(shellSource, /重命名/);
assert.match(shellSource, /IconClose/);
assert.doesNotMatch(workspaceSource, /更新时间/);
assert.doesNotMatch(workspaceSource, /draw\.io 已就绪/);
assert.doesNotMatch(workspaceSource, /IconEdit/);
```

- [ ] **Step 2: Run the tab-header tests to verify they fail**

Run:

```bash
npm run test:node -- tests/session-workspace-session-switch-source.test.ts tests/workspace-detail-tab-header-source.test.ts
```

Expected:

- FAIL because header actions still live in `session-workspace.tsx`

- [ ] **Step 3: Refactor the detail shell tab titles**

In `app/(internal)/_components/session-tabs-shell.tsx`:

- implement `renderSessionTabTitle(session)` with an active/inactive split
- active tab title should render:
  - `session.title`
  - readiness `Tag`
  - rename button
  - close button
- inactive tab title should render:
  - `session.title`
  - compact status dot or mini `Tag`
  - close button
- rename button should open the existing rename dialog state for the active tab only
- on rename save, call `updateConversationTitle(session.id, nextTitle)` and then `updateSessionMeta(session.id, { title: updatedConversation.title, updatedAt: updatedConversation.updatedAt })`

Keep the rename dialog in the shell so the tab header owns the entry point.

- [ ] **Step 4: Strip the old top-header actions from the workspace component**

In `app/(internal)/_components/session-workspace.tsx`:

- remove `IconEdit` import
- remove rename button from the top navigation content
- remove updated-time and readiness `Tag`s from the top navigation content
- keep breadcrumb composition out of the workspace header entirely if the detail shell now owns it
- keep the timeline, iframe, restore dialog, and other workspace-local behaviors unchanged
- stop depending on `useSearchParams` fallback for `sessionId`; the shell should pass `sessionId` directly

The resulting workspace surface should start at the body layout, not recreate a page-level top-nav row.

- [ ] **Step 5: Keep runtime metadata flowing back to the store**

In `app/(internal)/_lib/session-runtime-registry.ts` and the shell integration:

- preserve `setSessionShellControls()` for Tauri/runtime callers
- ensure `openSessionTab(sessionId, title?)` can still open or focus a session from runtime integrations
- when runtime or workspace code learns better metadata, use the store updater so tabs reflect:
  - renamed titles
  - readiness changes
  - updated timestamps when appropriate

If runtime-only code cannot access the store directly, keep the registry narrow and push metadata updates through shell-owned callbacks rather than reintroducing local component state.

- [ ] **Step 6: Re-run the tab-header tests**

Run:

```bash
npm run test:node -- tests/session-workspace-session-switch-source.test.ts tests/workspace-detail-tab-header-source.test.ts
```

Expected:

- PASS with rename/readiness moved into the tab layer

- [ ] **Step 7: Commit the tab-header slice**

Run:

```bash
git add app/(internal)/_components/session-tabs-shell.tsx app/(internal)/_components/session-workspace.tsx app/(internal)/_lib/session-runtime-registry.ts tests/session-workspace-session-switch-source.test.ts tests/workspace-detail-tab-header-source.test.ts
git commit -m "refactor: move workspace status and rename into session tabs"
```

### Task 5: Run Focused Regression Verification

**Files:**
- Test: `tests/workspace-session-store.test.ts`
- Test: `tests/conversation-home-source.test.ts`
- Test: `tests/session-tabs-shell-source.test.ts`
- Test: `tests/internal-top-navigation-source.test.ts`
- Test: `tests/session-workspace-session-switch-source.test.ts`
- Test: `tests/workspace-detail-tab-header-source.test.ts`

- [ ] **Step 1: Run the full focused source-test set**

Run:

```bash
npm run test:node -- \
  tests/workspace-session-store.test.ts \
  tests/conversation-home-source.test.ts \
  tests/session-tabs-shell-source.test.ts \
  tests/internal-top-navigation-source.test.ts \
  tests/session-workspace-session-switch-source.test.ts \
  tests/workspace-detail-tab-header-source.test.ts
```

Expected:

- PASS across all targeted routing, shell, store, and header-source tests

- [ ] **Step 2: Run a broader regression sweep around runtime registry**

Run:

```bash
npm run test:node -- tests/session-runtime-registry.test.ts tests/internal-shell-bridge-source.test.ts
```

Expected:

- PASS, confirming the refactor did not break session-keyed runtime integration surfaces

- [ ] **Step 3: Review git status before final commit**

Run:

```bash
git status --short
```

Expected:

- only intended implementation files are modified
- unrelated changes, such as `src-tauri/icons/icon.icns`, remain untouched unless explicitly requested

- [ ] **Step 4: Commit the verification checkpoint**

Run:

```bash
git add tests/workspace-session-store.test.ts tests/conversation-home-source.test.ts tests/session-tabs-shell-source.test.ts tests/internal-top-navigation-source.test.ts tests/session-workspace-session-switch-source.test.ts tests/workspace-detail-tab-header-source.test.ts
git commit -m "test: cover workspace detail route separation"
```
