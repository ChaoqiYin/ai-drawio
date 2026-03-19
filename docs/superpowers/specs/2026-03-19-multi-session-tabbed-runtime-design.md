# Multi-Session Tabbed Runtime Design

**Date:** 2026-03-19

**Goal:** Refactor the product from a single-session editing shell into a single main window that can host multiple concurrently open sessions as tabs, while keeping each individual draw.io session synchronous at the document-operation boundary.

## Context

The current product shape assumes one active session detail workspace at a time:

- the frontend session workspace is routed around one `sessionId`
- the shell bridge exposes one global document bridge
- the Tauri session runtime resolves a single active session route
- CLI document commands effectively target one ready session at a time

That model was sufficient when the app only needed one editable session, but the new requirement is different:

- the main window must support multiple open sessions at once
- each session must remain continuously active in the background
- draw.io autosave should continue to rely on the iframe's native runtime behavior
- different sessions may run work in parallel
- the same session must not allow conflicting document-level operations at the same time

The user explicitly rejected the independent-window direction for now and approved a tabbed main-window architecture instead.

## Product Decisions

### Main Window Shape

The product will remain a single main window.

That window becomes a multi-session control shell with:

- a session list or entry surface
- a tab strip for all currently open sessions
- one visible active session workspace at a time
- status summaries for opened and unopened sessions

The main window still contains the editing experience. There is no separate child-window editor in this design.

### Background Session Behavior

Every opened tab owns a continuously mounted session runtime.

This means:

- switching away from a tab does not destroy that tab's draw.io iframe
- background tabs continue running their own iframe-local autosave behavior
- background tabs remain available for AI-driven document operations and exports

The product should treat tab visibility and runtime liveness as separate concepts.

### Concurrency Model

The program should not introduce a heavy task scheduler or AI workflow orchestrator.

Instead, the approved boundary is intentionally minimal:

- different sessions may execute document operations in parallel
- the same session may not execute two document-level iframe mutations or exports concurrently

This is a thin session-scoped mutual exclusion rule, not a queueing system.

The system should not decide business priority, reorder work, or batch commands. It only prevents same-session collisions.

### Autosave Ownership

Autosave remains an iframe/runtime concern.

The product must preserve iframe lifetime for opened sessions so draw.io's built-in autosave behavior can keep working naturally. The application should not attempt to replace that capability with a second product-level autosave implementation.

## Architecture

### Unit 1: Main Window Session Shell

Location: frontend internal app shell

Responsibility:

- own the set of opened session tabs
- track the currently visible active tab
- create and close tab hosts
- surface session-level summary state to the user
- provide entry points for opening or focusing a session

The shell must stop assuming that "active tab" and "only live session runtime" are the same thing.

### Unit 2: Session Workspace Host

Location: one host instance per opened `sessionId`

Responsibility:

- mount the session-specific conversation UI
- mount and own one draw.io iframe instance
- expose one session-scoped bridge surface
- keep the iframe alive while the tab remains open
- report readiness and summary status back to the main shell

Every opened tab corresponds to one independently mounted host instance.

### Unit 3: Session-Scoped Bridge Registry

Location: shell bridge surface exposed to Tauri and other automation entry points

Responsibility:

- register live session hosts by `sessionId`
- expose session-scoped document bridges
- expose session readiness and summary state by `sessionId`
- support open/focus/ensure operations for session tabs

The bridge surface must move from a global singleton model to a session-keyed registry model.

### Unit 4: Desktop and CLI Routing Layer

Location: Tauri session runtime and document bridge

Responsibility:

- resolve or open the target session tab
- ensure the target session runtime is ready
- route document commands to the correct session host by `sessionId`
- stop depending on whichever session happens to be visible in the UI

## Main Window Model

The shell should maintain a minimal state model:

- `openedSessionIds`
- `activeSessionId`
- per-session summary metadata needed for display

Recommended per-session summary metadata:

- `title`
- `updatedAt`
- `status`
- `isReady`
- `isOpen`

The shell does not need to own the internal document or autosave state for each iframe. That remains inside the session host.

## Tab and Iframe Mounting Strategy

### Host Lifetime

When a session is opened into a tab:

1. create a `SessionWorkspaceHost(sessionId)`
2. mount its draw.io iframe
3. register its bridge under the shell's session registry
4. keep that host mounted until the user closes the tab

### Tab Switching

When the user switches tabs:

- change only which host is visible
- do not destroy the previously active host
- do not reinitialize the hidden host
- do not interrupt hidden-host autosave behavior

This is the critical product behavior that preserves background session activity.

### Lazy Creation

Sessions should be created lazily:

- unopened sessions should not mount hidden iframes
- the first open action creates the host
- repeated open actions should focus the existing tab instead of creating a duplicate host

## Shell Bridge Contract

The current shell bridge shape is effectively global.

The new bridge shape should become session-scoped. Conceptually:

- `window.__AI_DRAWIO_SHELL__.sessions[sessionId].documentBridge`
- `window.__AI_DRAWIO_SHELL__.sessions[sessionId].getState()`

The shell should also expose top-level helpers for tab orchestration, for example:

- `openSessionTab(sessionId)`
- `ensureSessionTab(sessionId?)`
- `listOpenSessions()`
- `getSessionStatus(sessionId)`

The exact naming may adapt to local conventions, but the structural rule must hold:

- document operations are addressed by `sessionId`
- session readiness is addressed by `sessionId`
- tab orchestration is addressed by `sessionId`

## Session Runtime and Tauri Routing

### Session Open

`session.open` should change meaning from:

- navigate the app to `/session?id=...`

to:

- open or focus the tab host for the requested `sessionId`
- wait until that tab host is ready

### Session Ensure

`session.ensure` should:

- create a new persisted session when no explicit target is provided and no reusable target exists
- ensure that the corresponding tab host exists
- wait until the session host bridge is ready

It should return the ensured session runtime identity, not merely a route transition result.

### Ready Checks

The current single-active-session concept should be replaced.

Instead of `require_active_session`, the runtime should move to a session-specific readiness check such as:

- `require_session_ready(sessionId)`

That check should verify:

- the requested session host exists
- the requested session host bridge is ready
- the requested session host iframe is available

It must not depend on whether the requested tab is currently visible.

## Document Operation Boundary

The approved safety boundary is intentionally narrow.

For a given `sessionId`, these document-level operations must be treated as mutually exclusive:

- document read operations that require a stable bridge interaction
- document apply
- document restore
- SVG export
- preview export

Different sessions remain fully parallel.

If a second conflicting document operation arrives for the same session while another one is in progress, the system should fail fast with a session-busy error rather than queueing hidden work.

## Lifecycle States

Each opened session host should move through explicit lifecycle states:

### Not Open

The session exists in storage but has no tab host and no iframe.

### Opening

The tab host has been created, but the iframe bridge is not ready yet.

### Ready

The host is mounted and available for document commands.

### Busy

A document-level bridge operation is running for that session.

This is a lightweight protection state, not a workflow scheduler.

### Error

The session host or iframe bridge encountered a failure, but the tab remains present so the user or CLI can retry, refresh, or close it.

### Closed

The tab has been closed and the host has been destroyed and unregistered.

## Error Handling

The system should surface a small, explicit set of session-oriented errors.

Recommended error categories:

- `SESSION_NOT_OPEN`
- `SESSION_NOT_READY`
- `SESSION_BUSY`
- `FRAME_NOT_READY`
- `CANVAS_ACTION_FAILED`
- `SESSION_INSTANCE_LOST`

The main window should map these into simple user-facing status summaries such as:

- idle
- processing
- exporting
- error

Detailed error objects should remain available to Tauri and CLI callers.

## Route Compatibility

The existing `/session?id=...` route should be retained as a compatibility entry point.

However, its product meaning changes:

- it should open the main window shell if needed
- it should focus or create the corresponding session tab
- it should no longer be treated as a standalone single-session ownership model

This preserves compatibility with existing links, tests, and command flows while allowing the product architecture to evolve underneath.

## Testing Strategy

### Frontend State Coverage

Add or update tests that verify:

- multiple session tabs can be opened at once
- switching the active tab does not destroy background hosts
- closing a tab removes only the targeted host
- repeated open requests focus an existing tab instead of duplicating it

### Source and Component Coverage

Add source-oriented assertions that verify:

- the shell exposes a session registry rather than one global singleton bridge
- each opened `sessionId` mounts its own host
- inactive hosts remain mounted
- session hosts unregister cleanly on close

### Desktop Routing Coverage

Update Tauri tests so they verify:

- `session.open` resolves a tab host by `sessionId`
- `session.ensure` returns a ready session runtime
- ready checks are session-specific rather than active-route-specific

### Concurrency Boundary Coverage

Add tests that verify:

- two different sessions can process document commands in parallel
- the same session rejects a second overlapping document operation
- one session failure does not corrupt another session host

### Regression Coverage

Preserve the existing document-operation coverage where it still applies:

- current XML retrieval
- apply and restore behavior
- SVG export
- preview export

Those tests should be adapted to session-scoped routing rather than removed.

## Implementation Notes

- Keep the first iteration focused on tabbed multi-session support inside one main window.
- Do not introduce child windows in this phase.
- Do not redesign draw.io autosave internals.
- Do not build a generalized workflow queue or AI scheduler.
- Do not depend on visibility state when routing document commands.
- Prefer the smallest bridge API expansion that cleanly converts global single-session assumptions into session-keyed behavior.
