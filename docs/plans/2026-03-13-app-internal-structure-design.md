# App Internal Structure Design

**Date:** 2026-03-13

## Goal

Move all internal Next.js application code under the `app/` tree while keeping the static `webapp/` directory in its current top-level location.

## Constraints

- Keep the public routes unchanged as `/` and `/session?id=<conversation-id>`.
- Keep `webapp/` unchanged at the repository root.
- Keep draw.io asset preparation copying from `webapp/` into `public/drawio/`.
- Do not change the Tauri or CLI route contract.

## Recommended Structure

```text
app/
  globals.css
  layout.js
  (internal)/
    page.js
    session/
      page.js
    _components/
      conversation-home.js
      session-workspace.js
    _lib/
      conversation-model.js
      conversation-store.js
```

## Rationale

Using an App Router route group keeps internal pages grouped together without changing the URL structure. Moving shared frontend code into `app/(internal)/_components` and `app/(internal)/_lib` keeps internal dependencies co-located with the routes that own them, while preserving a clear separation from the static `webapp/` bundle.

## Required Changes

- Move route files from `app/` into `app/(internal)/`.
- Move frontend-only helpers from `lib/` into `app/(internal)/_lib/`.
- Move internal UI components from `components/` into `app/(internal)/_components/`.
- Update test imports to the new helper location.
- Update repository documentation to reflect the new structure.

## Verification

- Node tests still pass after import updates.
- Frontend build still succeeds.
- Route paths remain `/` and `/session`.
