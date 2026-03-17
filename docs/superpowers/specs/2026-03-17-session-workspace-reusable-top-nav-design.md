# Session Workspace Reusable Top Navigation Design

**Date:** 2026-03-17

**Goal:** Extract the session detail top navigation into a reusable layout component with a built-in back button and a single caller-provided content region, then move the session rename action, updated time, and readiness status into that content region from the session workspace page.

## Context

The session workspace header currently renders two separate top rows inside `session-workspace.tsx`:

- a top navigation card with a back button and breadcrumb
- a second status row with rename, updated time, and draw.io readiness

That structure works for the current page, but it mixes reusable navigation framing with page-specific content. The user requested that:

- the top navigation be extracted into a standalone reusable layout component
- the area to the right of the back button be treated as a slot-like caller-provided region
- the session page render rename, updated time, and status inside that provided region
- the back button remain a permanent capability of the reusable component
- the back behavior default to "go back" but allow page-level overrides, such as returning directly to the home page for the session detail view

## Product Decision

Create a reusable internal top navigation layout component with this contract:

- it always renders a back button
- it accepts an optional custom back handler
- it falls back to browser/app back navigation when no custom back handler is provided
- it accepts one caller-provided `content` region for everything to the right of the back button

The reusable component will not understand breadcrumb data structures, action groups, or status tags. Those remain page responsibilities.

## User Experience

### Reusable Navigation Behavior

Every consumer of the reusable top navigation gets:

- a consistent top navigation card surface
- a permanent back button on the left
- a flexible content area on the right

The component does not impose whether the content area contains:

- breadcrumbs
- action buttons
- status tags
- filters
- titles

That decision belongs to the consuming page.

### Session Workspace Header

The session workspace page will provide one composite content region that internally arranges:

- breadcrumb on the left side of the content region
- rename, updated time, and draw.io readiness on the right side of the content region

The page still decides the breadcrumb click behavior and still owns the direct-to-home back action.

## Architecture

### Unit 1: Reusable Top Navigation Layout

Location: new component under `app/(internal)/_components/`

Responsibility:

- render the top card surface and spacing
- render the permanent back button
- execute custom back logic when provided
- otherwise execute the default back behavior
- render the caller-provided content region to the right of the back button

This unit is intentionally layout-only. It must not import or depend on session-specific state.

### Unit 2: Session Workspace Content Composition

Location: `app/(internal)/_components/session-workspace.tsx`

Responsibility:

- keep the existing breadcrumb route construction
- keep the existing breadcrumb item click behavior
- provide the direct-to-home back handler
- build the right-side content region passed into the reusable navigation component

This preserves session-specific behavior inside the session workspace while moving framing concerns out of the page file.

## Component Contract

The reusable component should stay minimal.

Required props:

- `content: ReactNode`

Optional props:

- `onBack?: () => void`
- `backLabel?: string`

Behavior rules:

- the back button is always visible
- `backLabel` defaults to `返回`
- if `onBack` exists, clicking the button calls it
- if `onBack` is absent, the component performs the standard back behavior

The component does not expose dedicated breadcrumb props or dedicated right-slot props. A single `content` prop is the approved interface.

## Layout Decision

The reusable component should render as:

1. outer navigation card container
2. left-aligned permanent back button
3. flexible content container filling the remaining width

Inside the session workspace, the provided `content` region should render its own internal two-sided layout so the page can keep:

- breadcrumb left
- rename / updated time / readiness right

This keeps the reusable component generic while preserving the current page affordances.

## Data Flow

### Default Reusable Flow

1. The page renders the reusable navigation component.
2. The page passes a `content` node.
3. The component renders the back button.
4. The component renders the provided content region.
5. Clicking back either runs `onBack` or the default back behavior.

### Session Workspace Flow

1. The session workspace computes breadcrumb routes.
2. The session workspace creates the breadcrumb element with its existing item renderer.
3. The session workspace creates the status/action group with rename, updated time, and readiness.
4. The session workspace combines both pieces into one layout node passed as `content`.
5. The reusable component renders that composite node to the right of the back button.

## Error Handling

The reusable navigation component does not introduce new data-fetch or async behavior.

The main behavioral requirement is safe back handling:

- a provided `onBack` must be invoked directly
- the default back behavior must remain usable when no override is supplied

Session workspace error handling for rename and draw.io readiness remains unchanged because those behaviors are only being moved in layout, not redesigned.

## Testing Strategy

### Source Tests for the New Reusable Component

Add a source-oriented test that verifies:

- the new component exists
- it renders a permanent back button
- it accepts a `content` prop
- it supports optional custom back behavior
- it includes the expected layout marker(s) used by existing tests or styling hooks

### Updated Session Workspace Source Tests

Adjust the existing session workspace header/status tests so they verify:

- the session workspace consumes the new reusable component
- breadcrumb rendering remains in the session workspace content region
- rename, updated time, and readiness are rendered inside the provided content region
- the old separate standalone status row is removed

### Regression Coverage

Keep the assertions that matter for user-visible behavior:

- back navigation remains available
- breadcrumb remains present
- rename action remains present
- updated time remains present
- draw.io readiness remains present

The tests should evolve away from assuming the old two-row header structure.

## Implementation Notes

- Preserve existing `data-layout` hooks where they continue to make sense.
- Avoid pushing session-specific naming into the reusable component.
- Keep the first version scoped to the internal app only; no need to generalize beyond the current internal component directory.
- Prefer the smallest possible extraction that clarifies responsibilities without redesigning unrelated header or page-shell code.
