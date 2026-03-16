# Tailwind Migration Design

## Summary

This design replaces the current hand-written global CSS system with Tailwind CSS.
The final state keeps only a minimal global stylesheet entry for Tailwind and a small `@layer components` section for truly reusable UI primitives.
All page-specific layout, spacing, color, and density styling moves into component-level Tailwind class strings.

## Goals

- Replace the existing custom global CSS rule set with Tailwind CSS.
- Keep the current dark graphite visual direction and compact density.
- Move page layout styling into the React components.
- Use `@layer components` only for repeated primitives such as buttons, panels, and chips.
- Remove the old selector-based global styling system.

## Non-Goals

- No visual redesign beyond preserving the existing Tailwind-equivalent look.
- No change to data flow, Tauri bridge behavior, or draw.io iframe logic.
- No migration to a UI component library such as shadcn/ui in this iteration.

## Chosen Approach

Use Tailwind CSS with a minimal `app/globals.css` entry:

- import Tailwind
- define a few root tokens for the dark palette
- define a small set of reusable `@layer components`

The component files become the primary place where layout and styling live.
This keeps the style system explicit and local while still allowing a few shared primitives.

## Why This Approach

The current `app/globals.css` contains both theme tokens and page-specific layout rules.
That makes simple layout edits depend on a central stylesheet and preserves a legacy naming layer that Tailwind is intended to avoid.

Moving styles into the components provides:

- clearer ownership of layout and spacing
- less indirection while editing UI
- a smaller global CSS surface
- a clean foundation for future component extraction

## Tailwind Structure

### Global Entry

`app/globals.css` will contain:

- Tailwind import
- root color tokens
- body background baseline
- `@layer components` for repeated primitives only

It will no longer contain page-specific selectors such as:

- `.page-shell`
- `.hero-card`
- `.session-grid`
- `.drawio-card--workspace`

### Reusable Component Classes

The first migration keeps only a small shared set:

- `ui-panel`
- `ui-panel-strong`
- `ui-btn-primary`
- `ui-btn-secondary`
- `ui-chip`

These are repeated enough across the home and session pages to justify `@layer components`.

### Component-Owned Layout

The following remain directly in JSX class strings:

- shell width and outer padding
- home page hero composition
- session page top bar and split layout
- iframe sizing
- message list density
- empty state layout

These structures are page-specific and should stay local.

## Files

### Modify

- `package.json`
- `app/globals.css`
- `app/layout.js`
- `components/conversation-home.js`
- `components/session-workspace.js`

### Create

- `postcss.config.mjs`
- `tailwind.config.mjs`

## Risks

### Class String Size

The component JSX will become longer because page layout moves out of CSS selectors.
This is acceptable in exchange for removing the current global indirection.

### Visual Regressions

Because the current UI is dense and highly tuned, spacing regressions are possible during migration.
Verification must include both the home page and session page.

### Tailwind Content Coverage

The Tailwind content configuration must include all app and component files or classes may be purged from the production build.

## Testing Strategy

### Automated

- keep the existing Node tests
- keep Rust tests unchanged
- ensure the Next static export succeeds with the new Tailwind pipeline

### Manual

- verify the home page still loads with the same dark theme
- verify the session page still loads edge-to-edge with the large draw.io area
- verify button, chip, card, and message styles still match the current density
- verify the iframe area remains visually dominant

## Recommendation

Migrate fully to Tailwind in one pass.
Do not keep the old global selectors alongside Tailwind, because that would leave the project with a mixed and harder-to-maintain styling model.
