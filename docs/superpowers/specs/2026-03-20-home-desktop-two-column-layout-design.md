# Home Desktop Two Column Layout Design

**Date:** 2026-03-20

**Goal:** Rework the internal home page into a desktop-first two-column flex layout where the left panel holds title and primary actions, the right panel holds search, pagination, and the conversation list, and only the list area scrolls when content exceeds the available height.

## Context

The current home page is arranged as two stacked cards. Search currently lives in the upper card, while the lower card contains the conversation list and pagination. That structure makes the list controls feel separated from the list itself and does not match the desired desktop application layout.

The user clarified the intended behavior:

- the page should use flex layout throughout
- the page should occupy the available height
- the search bar should sit directly above the list area
- pagination should sit above the list, not below it
- only the list region should scroll
- the overall page should use a left-right layout instead of a top-bottom layout
- mobile considerations are explicitly out of scope for this change

## Product Decision

The home page becomes a desktop-first two-column shell:

- left: a fixed-width control panel
- right: a flexible content panel

The left panel remains visually compact and stable while the right panel becomes the primary working area for finding and opening a saved conversation.

The page does not introduce new behavior, data fetching, or navigation rules. This is a layout refactor only.

## Layout Structure

### Outer Shell

The page root remains a full-height flex column so it can fill the available app window height. The main content area becomes a horizontal flex container with `min-h-0` so nested children can shrink correctly.

Required structure:

1. root shell: full height, flex column
2. content row: `flex-1 min-h-0 flex`
3. left panel: fixed width, no scrolling
4. right panel: `flex-1 min-w-0 min-h-0`

### Left Panel

The left panel uses a fixed width of `340px` and does not grow or shrink with the remaining content width.

This panel contains:

- conversation count tag
- page title
- primary create conversation button
- destructive clear-all-data button
- page-level error alert

This panel is informational and action-oriented. It should not contain search or pagination controls.

### Right Panel

The right panel is a card with an internal vertical flex layout:

1. search bar
2. pagination
3. scrollable conversation list area

This preserves a single reading and interaction flow:

1. narrow the result set
2. choose a page
3. select a conversation

### Scroll Boundary

Only the conversation list area scrolls.

To make this reliable, the right panel must include the usual flex constraints:

- right panel wrapper: `flex-1 min-w-0 min-h-0`
- right panel card content: vertical flex with `min-h-0`
- list viewport wrapper: `flex-1 min-h-0 overflow-y-auto`

The search row and pagination row keep natural height and remain visible while the list scrolls beneath them.

## Behavior

The following existing behaviors remain unchanged:

- loading the conversation summary page
- title search logic
- pagination state and total count display
- creating a conversation
- deleting a conversation
- renaming a conversation
- opening a conversation and navigating to `/session`
- opening settings from the floating button
- the loading overlay during navigation
- the rename modal behavior

This change must not alter any store contract, routing flow, or data model.

## Empty and Error States

If there are no matching items and loading is complete, the empty state remains in the right panel content area.

If an error occurs while loading or mutating conversations, the error alert remains in the left panel so the status is visible regardless of the current scroll position in the list.

## Visual and Structural Constraints

- Keep the existing card-based visual language.
- Preserve current button actions and labels.
- Preserve the floating settings button.
- Keep the implementation within `conversation-home.tsx` unless a small helper extraction becomes necessary.
- Do not add responsive mobile behavior in this change.
- Do not introduce layout systems other than flex for the page shell and inner panel structure.

## Testing

Add or update source-level regression tests to verify:

- the home page source expresses a horizontal two-column flex layout
- the left panel uses a fixed-width class or equivalent fixed-width styling
- the search input renders in the right panel section above pagination and list markup
- pagination renders above the list viewport
- the list viewport is the only area marked as scrollable
- the previous top-stacked layout assumptions are removed from the source expectations

Implementation validation should also run the existing home page source tests to ensure no current behavior contract is unintentionally removed.
