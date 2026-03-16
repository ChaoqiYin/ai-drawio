# Session Workspace Flex Shell Design

**Date:** 2026-03-13

## Goal

Rebuild the desktop session workspace into a strict application shell with a single page header, a single page body, and a fixed left-right split inside the body.

## Constraints

- Desktop-only layout; mobile stacking is out of scope.
- Use flexbox only for page structure; do not use CSS grid for the shell split.
- Keep the existing session data flow and draw.io bridge logic unchanged.
- Keep the route path unchanged at `/session?id=<conversation-id>`.

## Approved Structure

```text
main.workspace-shell
  header.workspace-head
  section.workspace-body
    aside.workspace-sidebar
    section.workspace-main
      div.workspace-main-toolbar
      div.workspace-main-canvas
        iframe
```

## Layout Rules

- The page root is a vertical flex container.
- The page header is fixed-height and does not grow.
- The page body fills the remaining viewport height and is a horizontal flex container.
- The left sidebar is fixed width and does not shrink.
- The right workspace fills the remaining width.
- The right workspace is a vertical flex container with a fixed toolbar and a fill-height canvas area.
- The iframe fills the canvas area completely.
- Sidebar scrolling stays inside the sidebar content area.

## Non-Goals

- No mobile optimization.
- No route changes.
- No data model changes.
- No draw.io runtime behavior changes.

## Verification

- A regression test verifies the component source contains the strict shell markers.
- Full Node tests pass.
- Frontend build passes.
