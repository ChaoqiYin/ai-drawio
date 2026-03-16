# Internal Class Scope Cleanup Design

**Date:** 2026-03-16

## Goal

Reduce one-off `internal-*` classes by moving single-use spacing and layout hooks back into Tailwind utility classes while keeping reusable or complex visual classes in `app/globals.css`.

## Scope

- Audit `internal-*` classes used by the internal app pages.
- Update the session workspace first, because it contains the one-off spacing hooks.
- Keep `webapp/` untouched.
- Do not change behavior, routing, or draw.io integration.

## Decision

### Keep In `app/globals.css`

Keep classes that meet at least one of these criteria:

- Used by more than one component
- Depend on pseudo-elements or hover states
- Define reusable panel/surface styling
- Would become noisy or fragile as inline arbitrary utilities

Examples:

- `internal-app-shell`
- `internal-panel`
- `internal-page-list-card`
- `internal-gradient-text`
- `internal-workspace-canvas-frame`
- `internal-message-card`

### Move Back Into Component `className`

Move classes that are only single-use layout or spacing helpers:

- `internal-workspace-spacious`
- `internal-workspace-page-shell`
- `internal-workspace-header-gap`
- `internal-workspace-sidebar-flow`
- `internal-workspace-main-flow`

These should become direct Tailwind classes on the corresponding JSX nodes.

## Testing Direction

- Remove tests that lock single-use globals into place.
- Add source-level assertions for the inline utility classes that replace them.
- Keep regression coverage for the reusable visual hooks that remain global.
