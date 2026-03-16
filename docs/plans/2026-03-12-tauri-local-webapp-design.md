# Tauri Local Webapp Design

## Summary

This document defines a minimal Tauri shell for the existing `webapp/` static site.
The shell must load the local `webapp/index.html` inside a Tauri webview without any frontend development server.
The existing `webapp/` directory must remain unchanged.

## Goals

- Load the existing `webapp/` folder as the Tauri frontend.
- Run fully offline with bundled static assets.
- Allow Rust to call globally reachable methods on the loaded page when needed.
- Keep the first implementation small and reversible.

## Non-Goals

- No modifications inside `webapp/`.
- No frontend bundler, dev server, or SPA migration.
- No attempt to call page functions that are private to closures or modules.
- No bridge layer injected into the page in the first iteration.

## Current Context

The repository currently contains the static application under `webapp/` and does not yet contain a Tauri project.
`webapp/index.html` is the natural application entry point.

## Chosen Approach

Use a standard `src-tauri/` project and configure Tauri `build.frontendDist` to point at `../webapp`.
This lets Tauri embed the static files and serve `index.html` as the default entry point.

For custom logic, Rust will keep a handle to the main webview window and evaluate JavaScript on demand.
The evaluated JavaScript will resolve a method path from `window`, verify that the target is callable, invoke it with arguments, and return a serialized success or error payload.

## Architecture

### Static Asset Loading

- Add `src-tauri/tauri.conf.json` with `build.frontendDist` set to `../webapp`.
- Do not set a frontend `devUrl`.
- Run the app with `tauri dev` and `tauri build` while always loading local static assets.

### Rust Shell

- Add a minimal Tauri application under `src-tauri/`.
- Define a single main window labeled `main`.
- Expose a small Rust helper for evaluating JavaScript in that window.
- Keep the helper isolated in its own Rust module so the window bootstrap code stays simple.

### Method Invocation Model

The first iteration uses this model:

- Input: `method_path` plus JSON-compatible arguments.
- Resolution: split `method_path` by `.` and resolve from `window`.
- Validation: fail if the path does not exist or the final value is not a function.
- Execution: call the function with the resolved owner object as `this`.
- Output: return a JSON string describing either success or failure.

This model intentionally supports only globally reachable page methods.

## Timing and Lifecycle

- The Tauri window opens and loads `webapp/index.html`.
- Rust must not call page methods before the document is loaded.
- The first iteration will use conservative timing: only execute page calls after the webview load has completed.
- If runtime timing is still too early for specific page globals, later work can add a page-ready handshake without changing `webapp/`.

## Error Handling

The JavaScript evaluation path must distinguish these cases:

- method path not found
- resolved target is not callable
- target function throws
- argument serialization or result serialization fails

Rust should surface each case as a structured error string instead of silently ignoring failures.

## Testing Strategy

### Automated

- Add Rust unit tests for the helper that builds the JavaScript payload.
- Add Rust unit tests for method path validation and escaping rules.

### Manual Smoke Tests

- Verify the Tauri window loads the local page title from `webapp/index.html`.
- Verify Rust can evaluate a trivial expression such as reading `document.title`.
- Verify a known global method can be called successfully.
- Verify failure handling for a missing method and a non-callable target.

## Risks

### Global Reachability

If the desired page method is not reachable from `window`, Tauri cannot call it directly in this phase.
That would require a later bridge layer or page instrumentation.

### Serialization Boundaries

Arguments and return values must stay JSON-compatible for reliable transport between Rust and the webview.

### Page Readiness

Some draw.io globals may exist only after deeper runtime initialization.
If load-complete is insufficient, a dedicated ready signal will be the next extension.

## References

- Tauri config `frontendDist` embeds a local directory and serves `index.html` as the default entry point.
- Tauri can use `WebviewWindow::eval` to execute JavaScript in the webview.
- Tauri can also use a built-in development server when no frontend bundler is present, but this design intentionally targets local static assets directly.
