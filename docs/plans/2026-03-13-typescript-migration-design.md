# TypeScript Migration Design

**Date:** 2026-03-13

## Goal

Migrate all non-`webapp/` JavaScript source files to TypeScript, using `.tsx` for React components and `.ts` for non-component modules, scripts, and tests.

## Constraints

- Keep `webapp/` unchanged.
- Keep `src-tauri/` Rust code unchanged.
- Preserve the existing runtime behavior.
- Keep `app/layout` and migrate it to `layout.tsx`; do not remove it because the App Router root layout is required.
- Use Node's built-in type stripping for local scripts and tests.

## Approved File Rules

- React component files use `.tsx`
- Next route files that render JSX use `.tsx`
- Non-component modules use `.ts`
- Scripts use `.ts`
- Tests use `.ts`

## Required Runtime Changes

- Add `tsconfig.json`
- Add TypeScript and React/Node type packages
- Update package scripts to execute `.ts` files through `node --experimental-strip-types`

## Verification

- Migration regression test confirms required `.ts/.tsx` files exist and legacy `.js/.mjs` files are gone
- Node tests pass through the TypeScript execution path
- Frontend build passes with Next.js TypeScript support
