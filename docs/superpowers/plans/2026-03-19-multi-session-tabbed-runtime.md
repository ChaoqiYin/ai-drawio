# Multi-Session Tabbed Runtime Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the app from one active session workspace into one main window that can host multiple concurrently open session tabs with always-live draw.io iframes, session-scoped bridge routing, and same-session document-operation mutual exclusion.

**Architecture:** Keep one main window and treat it as a multi-session shell. Each opened `sessionId` gets its own mounted host and document bridge, hidden hosts remain alive, Tauri/CLI resolve targets by `sessionId`, and the only new coordination rule is a thin same-session busy guard around document-level bridge calls.

**Tech Stack:** Next.js app router, React client components, IndexedDB conversation store, Tauri v2, Rust control server, Rust document/session runtime, Node source tests, Rust unit tests

---

## File Structure

### Frontend shell and hosts

- Modify: `app/(internal)/page.tsx`
  Turn the internal home route into the new multi-session shell entry instead of a standalone list-only page.
- Modify: `app/(internal)/_components/conversation-home.tsx`
  Convert the current home component into the session dashboard region used inside the shell, and wire it to open/focus tabs instead of route away.
- Modify: `app/(internal)/session/page.tsx`
  Keep this route as a compatibility entry that focuses or opens the requested tab rather than owning the only live workspace.
- Modify: `app/(internal)/_components/session-workspace.tsx`
  Extract single-session host behavior and remove the assumption that route visibility equals runtime ownership.
- Create: `app/(internal)/_components/session-tabs-shell.tsx`
  Own `openedSessionIds`, `activeSessionId`, tab switching, tab closing, and visible vs hidden host layout.
- Create: `app/(internal)/_components/session-workspace-host.tsx`
  Mount one always-live draw.io iframe and one session-scoped bridge surface per opened session.

### Frontend shared state and bridge

- Modify: `app/(internal)/_components/internal-shell-bridge.tsx`
  Replace the singleton bridge shape with a session-keyed registry and tab orchestration helpers.
- Create: `app/(internal)/_lib/session-runtime-registry.ts`
  Hold frontend session host registration, summary state, and session-scoped busy guards.
- Modify: `app/(internal)/_lib/conversation-model.ts`
  Add shared types for opened-session summary state if needed by the shell and bridge.
- Modify: `app/(internal)/_lib/conversation-store.ts`
  Expose any missing query helpers needed by the shell to preload tab metadata without changing persistence ownership.

### Tauri and CLI routing

- Modify: `src-tauri/src/session_runtime.rs`
  Replace active-route assumptions with session-tab ensure/open/ready checks.
- Modify: `src-tauri/src/document_bridge.rs`
  Route every document command through session-specific readiness checks and same-session busy protection.
- Modify: `src-tauri/src/control_server.rs`
  Keep control command dispatch aligned with the new session runtime semantics.
- Modify: `src-tauri/src/control_protocol.rs`
  Tighten request validation around session-scoped document commands if needed.
- Modify: `src-tauri/src/cli_schema.rs`
  Keep CLI syntax stable, but update help text where the target semantics change from “active document” to “resolved session runtime”.

### Tests and docs

- Modify: `tests/conversation-home-source.test.ts`
- Modify: `tests/internal-shell-bridge-source.test.ts`
- Modify: `tests/session-workspace-session-switch-source.test.ts`
- Create: `tests/session-tabs-shell-source.test.ts`
- Create: `tests/session-runtime-registry.test.ts`
- Modify: `README.md`
  Update product behavior and CLI targeting language after the feature is complete.

## Chunk 1: Frontend Multi-Session Shell

### Task 1: Add failing source tests for tabbed shell ownership

**Files:**
- Create: `tests/session-tabs-shell-source.test.ts`
- Modify: `tests/conversation-home-source.test.ts`
- Test: `tests/session-tabs-shell-source.test.ts`
- Test: `tests/conversation-home-source.test.ts`

- [ ] **Step 1: Write the failing shell-source tests**

Add source assertions that require:

- a new `session-tabs-shell.tsx` component
- `openedSessionIds` state
- `activeSessionId` state
- tab open/focus helpers
- hidden-but-mounted session host rendering
- dashboard actions in `conversation-home.tsx` that open/focus a tab instead of directly routing to `/session`

- [ ] **Step 2: Run the targeted Node tests to verify they fail**

Run: `npm run test -- tests/session-tabs-shell-source.test.ts tests/conversation-home-source.test.ts`
Expected: FAIL because the shell component does not exist and the home component still hard-routes to a single-session page.

- [ ] **Step 3: Implement the main shell and dashboard integration**

Create `app/(internal)/_components/session-tabs-shell.tsx` and update `app/(internal)/page.tsx` plus `app/(internal)/_components/conversation-home.tsx` so the shell owns tab state and the dashboard opens or focuses a tab inside the main window.

Minimum implementation shape:

```tsx
const [openedSessionIds, setOpenedSessionIds] = useState<string[]>([]);
const [activeSessionId, setActiveSessionId] = useState<string>("");

function openSessionTab(sessionId: string) {
  setOpenedSessionIds((current) => (current.includes(sessionId) ? current : [...current, sessionId]));
  setActiveSessionId(sessionId);
}
```

- [ ] **Step 4: Re-run the targeted Node tests**

Run: `npm run test -- tests/session-tabs-shell-source.test.ts tests/conversation-home-source.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -- app/(internal)/page.tsx app/(internal)/_components/conversation-home.tsx app/(internal)/_components/session-tabs-shell.tsx tests/session-tabs-shell-source.test.ts tests/conversation-home-source.test.ts
git commit -m "feat: add tabbed multi-session shell"
```

### Task 2: Add failing host lifecycle tests for always-live hidden sessions

**Files:**
- Modify: `app/(internal)/_components/session-workspace.tsx`
- Create: `app/(internal)/_components/session-workspace-host.tsx`
- Modify: `tests/session-workspace-session-switch-source.test.ts`
- Test: `tests/session-workspace-session-switch-source.test.ts`

- [ ] **Step 1: Write the failing host lifecycle tests**

Update the source test so it no longer assumes one route-owned workspace. Require:

- a dedicated `SessionWorkspaceHost`
- one host per opened `sessionId`
- hidden hosts remain mounted after tab switches
- hosts are removed only when a tab is explicitly closed

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `npm run test -- tests/session-workspace-session-switch-source.test.ts`
Expected: FAIL because the current workspace still resets around one route session id.

- [ ] **Step 3: Implement the host extraction**

Move single-session iframe ownership into `app/(internal)/_components/session-workspace-host.tsx`, keep the existing draw.io bridge logic there, and let `session-tabs-shell.tsx` render one host per opened session.

Target render shape:

```tsx
{openedSessionIds.map((sessionId) => (
  <SessionWorkspaceHost
    key={sessionId}
    sessionId={sessionId}
    hidden={sessionId !== activeSessionId}
  />
))}
```

- [ ] **Step 4: Re-run the targeted test**

Run: `npm run test -- tests/session-workspace-session-switch-source.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -- app/(internal)/_components/session-workspace.tsx app/(internal)/_components/session-workspace-host.tsx app/(internal)/_components/session-tabs-shell.tsx tests/session-workspace-session-switch-source.test.ts
git commit -m "feat: keep hidden session hosts mounted"
```

## Chunk 2: Session Registry and Shell Bridge

### Task 3: Add failing tests for a session-keyed shell bridge registry

**Files:**
- Create: `app/(internal)/_lib/session-runtime-registry.ts`
- Modify: `app/(internal)/_components/internal-shell-bridge.tsx`
- Create: `tests/session-runtime-registry.test.ts`
- Modify: `tests/internal-shell-bridge-source.test.ts`
- Test: `tests/session-runtime-registry.test.ts`
- Test: `tests/internal-shell-bridge-source.test.ts`

- [ ] **Step 1: Write the failing registry tests**

Require:

- session host registration and unregister helpers
- session-scoped bridge lookup by `sessionId`
- summary status lookup by `sessionId`
- shell helpers such as `openSessionTab`, `ensureSessionTab`, and `getSessionStatus`
- `window.__AI_DRAWIO_SHELL__.sessions[sessionId]` rather than one global `documentBridge`

- [ ] **Step 2: Run the registry-related tests and verify failure**

Run: `npm run test -- tests/session-runtime-registry.test.ts tests/internal-shell-bridge-source.test.ts`
Expected: FAIL because there is no registry file and the shell bridge still exposes one singleton conversation/document bridge model.

- [ ] **Step 3: Implement the registry and bridge wiring**

Create `app/(internal)/_lib/session-runtime-registry.ts` with the thinnest possible API:

```ts
type SessionRuntimeEntry = {
  documentBridge: object;
  getState: () => { isReady: boolean; status: string };
};

registerSessionRuntime(sessionId: string, entry: SessionRuntimeEntry)
unregisterSessionRuntime(sessionId: string)
getSessionRuntime(sessionId: string)
```

Update `internal-shell-bridge.tsx` to expose a session-keyed registry surface and tab orchestration helpers.

- [ ] **Step 4: Re-run the registry-related tests**

Run: `npm run test -- tests/session-runtime-registry.test.ts tests/internal-shell-bridge-source.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -- app/(internal)/_lib/session-runtime-registry.ts app/(internal)/_components/internal-shell-bridge.tsx tests/session-runtime-registry.test.ts tests/internal-shell-bridge-source.test.ts
git commit -m "feat: expose session-scoped shell bridge registry"
```

### Task 4: Add failing tests for same-session busy protection

**Files:**
- Modify: `app/(internal)/_lib/session-runtime-registry.ts`
- Modify: `app/(internal)/_components/session-workspace-host.tsx`
- Modify: `tests/session-runtime-registry.test.ts`
- Test: `tests/session-runtime-registry.test.ts`

- [ ] **Step 1: Write the failing mutual-exclusion tests**

Require the registry or host layer to expose a thin same-session guard that:

- marks one session busy while a document operation runs
- rejects a second overlapping document operation for the same session
- does not block a different `sessionId`

- [ ] **Step 2: Run the targeted test to verify failure**

Run: `npm run test -- tests/session-runtime-registry.test.ts`
Expected: FAIL because the registry does not yet track busy state per session.

- [ ] **Step 3: Implement the thin guard**

Add the smallest possible protection API, for example:

```ts
runSessionDocumentAction(sessionId, action)
```

where overlapping actions for the same `sessionId` reject with a `SESSION_BUSY`-style error and different session ids remain independent.

- [ ] **Step 4: Re-run the targeted test**

Run: `npm run test -- tests/session-runtime-registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -- app/(internal)/_lib/session-runtime-registry.ts app/(internal)/_components/session-workspace-host.tsx tests/session-runtime-registry.test.ts
git commit -m "feat: guard overlapping document actions per session"
```

## Chunk 3: Tauri Session Routing and Document Bridge

### Task 5: Add failing Rust tests for session-tab targeting semantics

**Files:**
- Modify: `src-tauri/src/session_runtime.rs`
- Modify: `src-tauri/src/control_server.rs`
- Modify: `src-tauri/src/control_protocol.rs`
- Test: `src-tauri/src/session_runtime.rs`
- Test: `src-tauri/src/control_protocol.rs`

- [ ] **Step 1: Write the failing Rust tests**

Add test coverage that requires:

- `session.open` to target a session runtime by `sessionId`, not a single active route
- `session.ensure` to return a ready session runtime identity
- a `require_session_ready`-style helper instead of `require_active_session`

- [ ] **Step 2: Run the targeted Rust tests and verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml session_runtime control_protocol -- --nocapture`
Expected: FAIL because the runtime still models one active route-owned session and one active-session guard.

- [ ] **Step 3: Implement session-scoped runtime checks**

Refactor `src-tauri/src/session_runtime.rs` to:

- resolve tab hosts by `sessionId`
- wait for readiness by `sessionId`
- stop depending on visible route ownership for command routing

Update `control_server.rs` and `control_protocol.rs` only as needed to align with the new semantics.

- [ ] **Step 4: Re-run the targeted Rust tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml session_runtime control_protocol -- --nocapture`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -- src-tauri/src/session_runtime.rs src-tauri/src/control_server.rs src-tauri/src/control_protocol.rs
git commit -m "feat: route session commands by tab runtime"
```

### Task 6: Add failing Rust tests for session-scoped document routing and busy errors

**Files:**
- Modify: `src-tauri/src/document_bridge.rs`
- Modify: `src-tauri/src/session_runtime.rs`
- Test: `src-tauri/src/document_bridge.rs`

- [ ] **Step 1: Write the failing document-bridge tests**

Require:

- document commands to resolve the target session runtime by `sessionId`
- same-session overlaps to fail with a `SESSION_BUSY`-style error
- different-session operations to remain independent

- [ ] **Step 2: Run the targeted Rust tests and verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml document_bridge -- --nocapture`
Expected: FAIL because the bridge currently assumes a single active session and has no session-scoped busy guard.

- [ ] **Step 3: Implement session-scoped routing and busy failures**

Refactor `src-tauri/src/document_bridge.rs` so each document operation:

1. ensures the target session runtime is ready
2. acquires the same-session guard
3. invokes the target session's bridge methods
4. releases the guard on completion

- [ ] **Step 4: Re-run the targeted Rust tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml document_bridge -- --nocapture`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -- src-tauri/src/document_bridge.rs src-tauri/src/session_runtime.rs
git commit -m "feat: scope document bridge operations per session"
```

## Chunk 4: Compatibility Surface, CLI Text, and Regression Verification

### Task 7: Add failing source tests for compatibility routing and CLI wording

**Files:**
- Modify: `app/(internal)/session/page.tsx`
- Modify: `src-tauri/src/cli_schema.rs`
- Modify: `README.md`
- Modify: `tests/ai-drawio-cli-source.test.ts`
- Create: `tests/session-route-compat-source.test.ts`
- Test: `tests/ai-drawio-cli-source.test.ts`
- Test: `tests/session-route-compat-source.test.ts`

- [ ] **Step 1: Write the failing compatibility tests**

Require:

- `/session?id=...` to behave as a shell compatibility entry rather than a standalone owner of the only workspace
- CLI help text to describe a resolved session runtime instead of the generic active document wording
- README wording to mention multi-session tab behavior

- [ ] **Step 2: Run the targeted Node tests and verify failure**

Run: `npm run test -- tests/ai-drawio-cli-source.test.ts tests/session-route-compat-source.test.ts`
Expected: FAIL because the compatibility route and CLI wording still reflect the single-session model.

- [ ] **Step 3: Implement the compatibility surface**

Update `app/(internal)/session/page.tsx`, `src-tauri/src/cli_schema.rs`, and `README.md` so they align with the new tabbed multi-session runtime while keeping the old route and CLI entry points usable.

- [ ] **Step 4: Re-run the targeted Node tests**

Run: `npm run test -- tests/ai-drawio-cli-source.test.ts tests/session-route-compat-source.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -- app/(internal)/session/page.tsx src-tauri/src/cli_schema.rs README.md tests/ai-drawio-cli-source.test.ts tests/session-route-compat-source.test.ts
git commit -m "docs: align compatibility route and cli wording"
```

### Task 8: Run full regression verification

**Files:**
- Verify: `tests/`
- Verify: `src-tauri/src/`

- [ ] **Step 1: Run the full Node test suite**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 2: Run the full Rust test suite**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: PASS.

- [ ] **Step 3: Run a production frontend build**

Run: `npm run build`
Expected: PASS and emit the static export output without introducing route/runtime build errors.

- [ ] **Step 4: Commit the verified feature**

```bash
git add -- app/(internal) app/(internal)/_lib src-tauri/src tests README.md docs/superpowers/specs/2026-03-19-multi-session-tabbed-runtime-design.md docs/superpowers/plans/2026-03-19-multi-session-tabbed-runtime.md
git commit -m "feat: add multi-session tabbed runtime"
```
