# Internal Page Gradient Refresh Design

**Date:** 2026-03-13

## Goal

Refresh the internal Next.js pages with a more polished dark workspace look by adding restrained gradients, clearer card hierarchy, and more intentional hover states.

## Scope

- Include only internal app pages under `app/`.
- Cover the home page conversation list and the session workspace.
- Do not modify any files under `webapp/`.
- Do not change routing, state flow, draw.io bridge behavior, or IndexedDB behavior.

## Visual Direction

- Keep the existing dark glass style as the base.
- Add a subtle blue-cyan gradient system to the page background and selected surfaces.
- Increase separation between page background, panel surfaces, and interactive cards.
- Preserve a calm desktop-tool feeling instead of turning the UI into a marketing page.

## Approved Changes

### Global Surface System

- Expand the body background into a layered gradient with soft radial light sources.
- Introduce reusable utility classes for:
  - page shell background glow
  - elevated glass panels
  - gradient accent text
  - subtle bordered list cards
- Keep text contrast high enough for dark mode readability.

### Home Page

- Turn the top summary card into the main visual anchor with a mild gradient wash.
- Add a decorative background layer behind the page content without affecting layout.
- Improve conversation list card hover feedback through border, shadow, and surface tint changes.
- Restyle the navigation overlay so it matches the same glass-and-gradient language.

### Session Workspace

- Apply the same global gradient backdrop behind the workspace shell.
- Differentiate the top toolbar, sidebar, secondary toolbar, and canvas frame through shared but tiered surface treatments.
- Improve sidebar message card separation from the sidebar background.
- Add a restrained frame treatment around the draw.io canvas container while leaving the iframe content untouched.

## Constraints

- No layout restructuring beyond safe wrapper elements or class additions.
- No color treatment may reduce readability of tags, buttons, or long message text.
- Hover feedback must not shift layout.
- Motion should stay limited to opacity, border-color, and box-shadow transitions.

## Verification

- Add minimal source-level regression tests for the new shared visual hooks.
- Run focused Node tests for the touched components.
- Run the full Node test suite.
- Run the web build to verify the styling changes compile cleanly.
