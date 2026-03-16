# Arco Adoption Design

**Date:** 2026-03-13

## Goal

Adopt Arco Design as the primary UI library for internal pages and switch the application shell to Arco dark mode.

## Scope

- Apply Arco dark mode globally for internal pages.
- Replace as much custom page UI as practical with Arco React components.
- Keep `webapp/` unchanged.
- Keep business logic unchanged.

## Approved Approach

- Import Arco global CSS in the root layout.
- Enable dark mode with `body[arco-theme='dark']`.
- Wrap the app with `ConfigProvider`.
- Rebuild the home page with Arco `Layout`, `Card`, `Typography`, `Button`, `Tag`, `Empty`, `Alert`, and `Popconfirm`.
- Rebuild the session workspace shell with Arco `Layout`, `Card`, `Typography`, `Button`, `Tag`, `Empty`, and `Alert`.
- Keep the draw.io `iframe` as a native element inside an Arco container.

## Verification

- Source tests confirm Arco CSS, dark mode, and page-level Arco component usage.
- Node tests pass.
- Frontend build passes.
