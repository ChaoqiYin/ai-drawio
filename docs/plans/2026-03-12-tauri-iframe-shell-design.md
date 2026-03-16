# Tauri Iframe Shell Debug Bar Design

## Summary

This document revises the original local webapp shell so the Tauri window loads a lightweight shell page instead of loading `webapp/index.html` directly.
The shell page embeds `index.html` in an iframe and renders a debug-only path bar above it.
The existing draw.io application code remains unchanged.

## Goals

- Keep `webapp/index.html` and the rest of the draw.io application unchanged.
- Show the current rendered file path in a shell-level bar above the embedded page.
- Preserve the ability for Rust to call globally reachable functions on the embedded page.
- Keep the solution local-only and without a frontend development server.

## Non-Goals

- No modifications to draw.io application logic or DOM inside `webapp/index.html`.
- No persistent file-path state.
- No multi-window or child-webview native layout in the first version.

## Chosen Approach

Keep `build.frontendDist` pointed at `../webapp`, but change the startup page to `shell.html`.
`shell.html` lives beside `index.html` inside `webapp/`, renders a debug bar, and embeds `index.html` with an iframe.

Rust injects the current rendered file path into the shell page after it loads.
Rust-to-frontend method calls and script evaluation are redirected through the shell page into the iframe's `contentWindow`.

## Architecture

### Static Asset Layout

- Keep `src-tauri/tauri.conf.json` `frontendDist` as `../webapp`.
- Set the main window URL to `shell.html`.
- Add one new shell page file under `webapp/`.

### Shell Page

The shell page is responsible for:

- rendering a top debug bar
- rendering an iframe that loads `index.html`
- exposing a small global helper object for Rust-injected calls

The helper object must provide:

- access to the iframe window
- a way to update the debug bar text
- a way to read whether the iframe exists

### Rust Injection Model

Rust computes the rendered file path from `src-tauri` relative to `../webapp/index.html`.
On shell page load, Rust evaluates a short script that updates the top debug bar text.

Rust frontend command helpers now target the iframe window instead of the shell window:

- method-path resolution starts from `iframe.contentWindow`
- direct script evaluation executes inside `iframe.contentWindow`

## Timing and Lifecycle

- The main window loads `shell.html`.
- `shell.html` creates the iframe and points it at `index.html`.
- Tauri `on_page_load` injects the rendered file path into the shell page.
- Rust command helpers assume the shell page is loaded and the iframe is same-origin.

## Error Handling

The shell helper layer must distinguish:

- iframe element missing
- iframe window missing
- target method missing inside the iframe window
- target method not callable
- execution errors thrown by the embedded page

## Testing Strategy

### Automated

- Extend Rust unit tests so generated scripts explicitly target the iframe window.
- Add a Rust unit test for the debug-path injection script builder.

### Manual Smoke Tests

- Launch the Tauri app and confirm the shell bar is visible above the embedded page.
- Confirm the bar shows the absolute path for `webapp/index.html`.
- Confirm the embedded draw.io page still renders correctly.
- Confirm Rust-triggered method calls still target the iframe content.

## Risks

### Iframe Compatibility

If draw.io relies on top-level window assumptions that break inside an iframe, this approach may need to fall back to a native multi-webview layout.

### Same-Origin Assumptions

Rust-to-page calls depend on shell and iframe content being same-origin so the shell can access `contentWindow`.

### Page Initialization Timing

Some iframe globals may exist after additional runtime initialization, so shell load completion does not guarantee method readiness.
