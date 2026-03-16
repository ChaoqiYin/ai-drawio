# Next.js AI Session Shell Design

## Summary

This document replaces the temporary iframe shell entry with a Next.js frontend that becomes the real Tauri startup application.
The application opens on a Next.js route that lists local AI conversation history from IndexedDB.
Selecting a conversation navigates to a dedicated route that embeds draw.io through an iframe.

## Goals

- Start the desktop application on a brand-new Next.js page instead of draw.io directly.
- Read and display local AI conversation history from IndexedDB.
- Keep draw.io embedded through an iframe on a dedicated route.
- Keep all conversation persistence in browser IndexedDB only.
- Preserve offline static asset delivery for Tauri.

## Non-Goals

- No Rust-backed persistence for conversation history.
- No draw.io source modifications.
- No Next.js development server dependency for Tauri runtime.
- No server-side API routes for the first iteration.

## Chosen Approach

Use Next.js App Router with static export output.
Before each frontend build, copy `webapp/` into `public/drawio/` so the exported app can load draw.io from `/drawio/index.html`.

The route structure will be:

- `/` for conversation history
- `/session` for the workspace page, selected by query string `?id=...`

`/session` is intentionally static so it remains compatible with Next.js static export while still choosing the active session client-side.

## Architecture

### Frontend Entry

- Tauri `frontendDist` points to Next.js exported `out/`.
- Tauri startup window loads `index.html` from the Next export.
- Tauri `beforeDevCommand` and `beforeBuildCommand` both run a static frontend build.

### Conversation Storage

Conversation history is stored only in IndexedDB.
The frontend owns all reads and writes using a small browser-side storage module.

The first iteration conversation model is:

- `id`
- `title`
- `createdAt`
- `updatedAt`
- `messages`

## Routes

### Home Route

The home route:

- reads IndexedDB on mount
- lists all saved conversations ordered by `updatedAt` descending
- offers a minimal button to create a new local conversation if none exists
- links into `/session?id=<conversation-id>`

### Session Route

The session route:

- reads the `id` query parameter client-side
- loads the selected conversation from IndexedDB
- renders conversation metadata and messages in the shell UI
- embeds draw.io using `iframe src="/drawio/index.html"`

## Draw.io Embedding

draw.io remains untouched and is served as static assets copied from `webapp/`.
The Next.js session page provides the surrounding shell UI and owns any future iframe communication bridge.

## Tauri Bridge

Existing Rust helpers for `call_page_method` and `eval_page_script` continue to target the iframe window through a shell helper object exposed by the Next.js session page.
The helper must exist only on the session page and return the draw.io iframe `contentWindow`.

## Testing Strategy

### Automated

- Add Node tests for pure conversation utility functions.
- Keep Rust tests for iframe-targeted JavaScript builders.

### Manual Smoke Tests

- Launch the app and confirm the home route appears first.
- Create a local conversation and confirm it is stored and listed.
- Open a conversation and confirm the session page renders.
- Confirm draw.io loads inside the iframe.
- Confirm Rust iframe-targeting tests still pass.

## Risks

### Static Export Constraints

Dynamic route parameters are avoided because IndexedDB data is only available client-side and static export cannot prebuild per-conversation pages.

### Asset Copy Cost

Copying `webapp/` into `public/drawio/` on every frontend build increases build time, but it keeps runtime packaging simple and reliable.

### Iframe Assumptions

Any future direct integration with draw.io depends on same-origin iframe access and globally reachable objects within draw.io.
