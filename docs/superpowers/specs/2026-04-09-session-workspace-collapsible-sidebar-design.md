# Session Workspace Collapsible Sidebar Design

**Date:** 2026-04-09

**Goal:** Add an explicit collapse and expand control for the conversation-history sidebar on the workspace detail page so users can temporarily maximize the draw.io canvas area without leaving the current session.

## Context

The workspace detail page currently renders a fixed-width left sidebar and a flexible canvas area:

- the sidebar is always visible
- the sidebar width is fixed at `320px`
- the main canvas area only receives the remaining width

That works for history browsing, but it wastes horizontal space when the user wants to focus on the canvas. The requested change is not a draggable resizer and does not require a new UI library. The approved direction is a simple collapse and expand interaction.

## Product Decision

The sidebar will support two visual states inside the current page session:

- expanded: keep the existing `320px` conversation-history panel
- collapsed: replace the full panel with a narrow left rail that exposes an explicit expand control

This state is local UI state only:

- no persistence across reloads
- no synchronization with URL or global store
- no drag resizing

## User Experience

### Expanded State

The existing sidebar remains the default view.

Approved behavior:

- the conversation history card keeps its current content
- the card title area gains a collapse button on the right side
- clicking the button hides the full sidebar content and switches to collapsed state

### Collapsed State

The left side should not disappear completely. A narrow rail remains so the user always has a predictable way to reopen the history panel.

Approved behavior:

- the rail stays anchored on the left side of the workspace body
- the rail contains a single expand button
- the main canvas area grows to consume the freed width
- clicking the expand button restores the original sidebar

## Layout Model

### Expanded Layout

Keep the current two-column flex layout:

- left sidebar: fixed width `320px`
- right main workspace: `flex-1`

### Collapsed Layout

Keep the same outer flex shell, but swap the left column width:

- left rail: narrow fixed width suitable for one icon button
- right main workspace: `flex-1`

The collapsed rail should keep existing `min-h-0` and overflow-safe constraints so the page remains stable inside the detail shell.

## Component Architecture

### Unit 1: Sidebar Visibility State

Location: `app/(internal)/_components/session-workspace.tsx`

Responsibility:

- own a boolean `isSidebarCollapsed`
- toggle between expanded and collapsed UI branches

This state should stay local to the workspace component because it affects only presentation.

### Unit 2: Expanded Sidebar Header Action

Location: `app/(internal)/_components/session-workspace.tsx`

Responsibility:

- render the existing `会话记录` card title
- add a collapse button in the title action area
- keep the current history list and empty/error states unchanged

### Unit 3: Collapsed Sidebar Rail

Location: `app/(internal)/_components/session-workspace.tsx`

Responsibility:

- render a narrow left rail when the sidebar is collapsed
- expose one expand button
- preserve the existing layout markers needed by source-level tests

## Data Flow

1. Workspace detail page renders with `isSidebarCollapsed = false`.
2. User clicks the collapse button in the sidebar header.
3. Component switches to collapsed rail markup.
4. Main workspace naturally expands because the left column width shrinks.
5. User clicks the expand button in the rail.
6. Component restores the full sidebar card.

## Error Handling

This feature is presentation-only and has no new async behavior.

Rules:

- collapsing the sidebar must not affect conversation loading
- collapsing the sidebar must not affect draw.io iframe lifecycle
- restore-preview modal behavior stays unchanged

## Testing Strategy

Add or update source-level tests to lock down:

- a dedicated local collapse state in `session-workspace.tsx`
- a collapse button in the expanded sidebar branch
- an expand button in the collapsed rail branch
- the existing workspace body, sidebar, and main layout markers still being present
- removal of the hard-coded always-expanded sidebar wrapper assertion

No new runtime integration test is required for this change because the existing test suite in this repository already relies heavily on source-level layout assertions for this component.
