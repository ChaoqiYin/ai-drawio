# Tauri DevTools Auto Open Design

## Goal

Enable the built-in Tauri WebView DevTools automatically in desktop development mode so page nodes can be inspected without adding a custom in-app inspector.

## Decision

Use Tauri's native DevTools support instead of building a page-level debug overlay. The application will attempt to open DevTools for the main window during startup, but only when Rust is compiled with `debug_assertions`.

## Scope

- Modify the Tauri app setup path only.
- Do not change web page UI, routes, or query parameters.
- Do not enable DevTools in release builds.

## Behavior

- In `tauri dev`, the main webview should automatically open DevTools after startup.
- In release builds, the code path should be skipped entirely.
- If the main webview handle is unavailable, startup should continue without crashing.

## Testing

- Add a source-level Node test that checks `src-tauri/src/main.rs` for:
  - a `debug_assertions` guard
  - a main-window lookup
  - an `open_devtools` call
- Run the focused test.
- Run the existing Node test suite.
- Run the web build to confirm no regressions in the web layer.
