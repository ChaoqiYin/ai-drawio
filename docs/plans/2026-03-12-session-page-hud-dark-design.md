# Session Page HUD Dark Design

## Summary

This document redesigns the session detail page into a dark, technology-forward HUD layout.
The page must remove the excessive side gutters, reduce vertical ceremony, and make the draw.io workspace feel like the primary surface.

## Goals

- Remove the large left and right margins on the session detail page.
- Replace the current warm, soft glassmorphism palette with a dark gray technology palette.
- Compress the top hero into a low-height control strip.
- Make the draw.io workspace visually dominant.
- Keep the existing session data flow and iframe behavior unchanged.

## Non-Goals

- No changes to IndexedDB behavior.
- No changes to draw.io iframe integration.
- No changes to the conversation list page unless required for shared theme consistency.

## Chosen Approach

Use a HUD-style layout with dark layered panels, thin borders, restrained blue-gray highlights, and dense spacing.
The session page becomes a near edge-to-edge application workspace:

- top control strip
- fixed-width message side panel
- main draw.io work surface

## Layout

### Global Page Width

- Remove the centered narrow container feel on the session page.
- Desktop layout should use nearly full viewport width.
- Outer padding should be minimal on desktop and only restored on mobile.

### Top Strip

- Convert the large heading block into a compact status/control strip.
- Keep only essential metadata and navigation.

### Side Panel

- Use a denser message sidebar with tighter cards and clearer hierarchy.
- Favor borders and tonal separation over shadows.

### Main Surface

- Let the draw.io panel occupy the dominant share of the page.
- Minimize decorative framing around the iframe.

## Visual System

- Background: near-black graphite gradient
- Panel surfaces: layered charcoal and slate
- Borders: cool gray with subtle alpha
- Accent: restrained cyan-blue
- Typography: clean modern sans for interface labels and titles
- Motion: background and border transitions only, no scale hover

## Testing Strategy

- Verify no horizontal gutters remain on desktop session page.
- Verify mobile keeps safe padding.
- Verify the iframe area grows relative to the previous layout.
- Verify readable contrast for text and controls against dark surfaces.
