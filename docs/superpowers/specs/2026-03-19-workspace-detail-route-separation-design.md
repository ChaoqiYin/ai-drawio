# Workspace Detail Route Separation Design

**Date:** 2026-03-19

**Goal:** Separate the workspace detail experience from the home page so the home page becomes a pure session index, while `/session` becomes a dedicated multi-workspace detail container with tabs directly under the top navigation.

## Context

The current frontend structure mixes two different product responsibilities into the same page shell:

- the home page acts as the session index and entry surface
- the same page also mounts the multi-session workspace shell and active draw.io workspaces

That structure causes three product mismatches with the new requirements:

- the workspace detail experience is not a standalone page
- switching between opened workspaces happens inside the home page instead of the detail page
- the tab strip is visually coupled to the home content instead of living directly under the detail top navigation

The approved product direction is:

- home and workspace detail must be separate pages
- `/session` is a dedicated detail container page, not a route for a single session id
- the detail page can contain multiple opened workspaces at once
- returning to home must close the detail page tab set
- re-entering `/session` from home should initialize only the clicked workspace

## Product Decisions

### Route Model

The route model will be:

- `/` for the home page
- `/session` for the workspace detail container page

The detail route must not include a session id query parameter. A single detail page instance can contain multiple opened workspaces, so the route itself does not represent one specific workspace.

### Page Responsibilities

The home page is an index page only. It keeps:

- session list
- create session action
- delete and rename actions from the list
- settings entry
- CLI integration status

The workspace detail page owns:

- back navigation
- breadcrumb
- the opened workspace tab strip
- the active workspace content area

### Detail-Page Tab Lifecycle

The opened workspace tab set exists only while the user remains inside the detail page flow.

Approved behavior:

- entering `/session` from home opens exactly the clicked workspace as the initial tab
- opening more workspaces while already inside `/session` appends them to the same detail-page tab set
- closing a tab removes only that workspace
- returning to home destroys the entire detail-page tab set
- entering `/session` again from home starts a new tab lifecycle with only the newly clicked workspace
- no persistence is required across page refreshes

## State Model

### Global Detail Store

Use a lightweight in-memory Zustand store for detail-page session state.

The store should own:

- `openedSessions`: array of opened workspace metadata
- `activeSessionId`: id of the currently visible workspace

`openedSessions` items should stay minimal and should not duplicate activation state. Recommended fields:

- `id`
- `title`
- `updatedAt`
- `isReady`

Do not store `isActive` inside each item because that would duplicate `activeSessionId`.

### Store Actions

The store should expose actions that match the page lifecycle:

- `enterSessionDetail(session)`
  - replace `openedSessions` with the single target session
  - set `activeSessionId` to that session id
- `openSession(session)`
  - append the session if it is not already open
  - switch `activeSessionId` to the target session
- `activateSession(sessionId)`
  - update only `activeSessionId`
- `closeSession(sessionId)`
  - remove the session from `openedSessions`
  - if the closed session was active, move activation to a neighbor or clear it
- `updateSessionMeta(sessionId, patch)`
  - refresh title, updated time, readiness, or other lightweight tab metadata
- `resetSessionDetail()`
  - clear `openedSessions`
  - clear `activeSessionId`

## Detail Page Layout

### Vertical Structure

The workspace detail page should render in this order:

1. top navigation row
2. workspace tab row
3. active workspace content area

This ordering is mandatory. The tab row belongs directly under the top navigation, not inside the home page and not buried inside the workspace body.

### Top Navigation

The top navigation row should contain only:

- back button
- breadcrumb

The detail page should continue using the reusable top navigation component, but the content passed into it should now be much smaller than the current session workspace header content.

The top navigation must not contain:

- rename action
- readiness tag
- updated-time tag

Those move into the tab presentation layer.

The detail-page back action should not rely on generic browser-history fallback. It should explicitly:

- reset detail-page session state
- navigate to `/`

### Tab Header Content

The tab row is the new owner of rename and readiness visibility.

Approved rule:

- active tab shows the full tab header
- inactive tabs show a compact version

The active tab should render:

- title
- readiness status label
- rename entry
- close action

Inactive tabs should render:

- title
- compact readiness indicator
- close action

The rename action should remain explicit and discoverable. Reuse the existing rename dialog flow rather than switching to hidden interactions such as double-click rename.

## Component Architecture

### Unit 1: Home Page Shell

Location: `app/(internal)/page.tsx` and home-related components

Responsibility:

- render only the session index experience
- never mount detail-page workspace tabs or workspace hosts
- initialize detail-page state before navigating to `/session`

### Unit 2: Detail Page Shell

Location: `/session` route and its shell component

Responsibility:

- render the top navigation with back and breadcrumb only
- render the tab strip directly below the top navigation
- read `openedSessions` and `activeSessionId` from the Zustand store
- host the opened workspace instances

### Unit 3: Workspace Tab Presentation

Location: the tab strip component inside the detail page shell

Responsibility:

- present opened sessions from the store
- switch active workspace
- surface rename and readiness in the tab header
- close tabs

This unit should not own the truth of which sessions are open. It consumes and updates the store.

### Unit 4: Workspace Host Instances

Location: one host per opened session id

Responsibility:

- keep each opened session workspace mounted until its tab is closed
- hide inactive hosts instead of unmounting them
- preserve iframe runtime and autosave continuity for background tabs
- report lightweight session metadata back to the detail store when needed

### Unit 5: Session Workspace Content

Location: the existing session workspace component

Responsibility:

- keep single-workspace timeline and canvas content behavior
- stop owning rename/status actions in the page header
- focus on the actual workspace body and workspace-local dialogs

## Navigation Flow

### Entering Detail From Home

1. The user clicks a session on the home page.
2. The home page resolves the session metadata needed by the detail store.
3. The home page calls `enterSessionDetail(session)`.
4. The app navigates to `/session`.
5. The detail page renders with exactly one opened tab for that session.

### Opening Additional Workspaces From Detail

1. A detail-page action requests another workspace.
2. The app calls `openSession(session)`.
3. The store appends the session if needed.
4. The store sets `activeSessionId` to that session.
5. The detail page shows the requested workspace without changing the route.

For this spec, the source of that request should reuse existing session-open entry points and runtime integration paths. Designing a new in-detail session picker is out of scope.

### Returning Home

1. The user triggers back navigation to home.
2. The app calls `resetSessionDetail()`.
3. The app navigates to `/`.
4. All detail-page tabs are gone.

## Integration Notes

### Home Component Changes

The current home component opens session tabs locally. That behavior must change.

Instead:

- home actions prepare detail store state
- home navigates to `/session`
- home no longer renders any workspace shell or workspace host

### Detail Shell Changes

The current tab shell mixes home content and detail content in one component. That shell must be simplified into a pure detail-page container.

It should:

- stop rendering `ConversationHome`
- render only detail-page navigation, tab strip, and workspace hosts

### Workspace Header Changes

The current session workspace top area contains breadcrumb, rename, updated time, and readiness. After this refactor:

- breadcrumb stays in the detail top navigation
- rename and readiness move into the active tab header
- updated time may remain as tab metadata when useful, but it should not stay in the top navigation row

## Error Handling

### Empty Detail State

If `/session` is reached without any opened sessions in the store, the detail shell should fail safely.

Recommended behavior:

- immediately redirect back to `/`
- optionally surface a lightweight message if the existing route-state pattern already supports it cleanly

The detail page should not try to invent a new empty-workspace mode.

### Closed Active Tab

When the active tab is closed:

- activate the nearest remaining tab if one exists
- otherwise clear `activeSessionId`
- if no tabs remain, return the user to `/`

### Stale Session Metadata

If a session title or readiness state changes after opening:

- update the tab metadata through the Zustand store
- do not recreate the tab or remount the workspace host just to refresh header data

## Testing Strategy

### Source Tests

Update and add source-oriented tests to verify:

- the home page renders only the session index and no longer mounts the tab shell
- `/session` is the only route that renders the detail tab shell
- the detail shell places the tab strip directly below the top navigation
- the top navigation content for the detail page contains only back and breadcrumb concerns
- the active tab header contains rename and status UI
- inactive tabs use the compact header variant

### State Tests

Add store-focused tests to verify:

- entering detail replaces the opened-session array with exactly one session
- opening another session appends without duplication and activates it
- switching tabs updates only `activeSessionId`
- closing the active tab activates the correct fallback session
- resetting detail state clears the whole detail-page tab lifecycle

### Regression Coverage

Preserve the existing behaviors that matter for multi-session runtime correctness:

- opened workspace hosts remain mounted while tabs are hidden
- switching tabs does not destroy iframe runtimes
- session-specific runtime registry behavior remains session-keyed

## Scope Boundaries

This spec intentionally does not redesign:

- draw.io iframe bridge behavior
- IndexedDB data model
- session runtime registry semantics beyond detail-shell integration points
- rename dialog internals
- visual restyling of the workspace page

The work is limited to routing, shell boundaries, state ownership, tab presentation, and the relocation of header actions/status into the tab layer.
