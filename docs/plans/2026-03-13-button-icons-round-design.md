# Button Icons And Round Shape Design

## Goal

Add a small amount of visual guidance to key action buttons and make buttons consistently rounded across the internal pages.

## Decision

Use Arco's built-in icon package for a restrained set of key actions only. Apply a global rounded button shape through the shared Arco `ConfigProvider` so the visual change stays consistent without per-button styling drift.

## Scope

- Global button shape: rounded for internal pages.
- Key buttons with icons:
  - Home: create local session, clear all local data, delete record
  - Session: back to history
- Do not add icons to every button or status chip.

## Behavior

- Buttons should keep existing actions and sizes.
- Icons should be small leading icons, not icon-only buttons.
- Destructive actions keep danger styling; only iconography and shape change.

## Testing

- Add a source-level test that checks:
  - shared Arco config sets `Button.shape` to `round`
  - key action buttons import and use Arco icons
- Run focused tests.
- Run full Node tests.
- Run web build verification.
