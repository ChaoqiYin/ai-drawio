# App Startup Loading Design

## Summary

Add a native startup loading experience for the desktop shell so the app does not show a blank main window before the web page renders. The loading state should end as soon as the first frontend frame mounts, without waiting for session data or the draw.io canvas to finish bootstrapping.

## Goals

- Cover the startup gap before the web content renders.
- Dismiss loading as soon as the frontend shell mounts.
- Keep the implementation small and isolated to the startup path.

## Non-Goals

- Waiting for draw.io iframe readiness.
- Waiting for conversation data hydration.
- Adding route-level loading states for later navigations.

## Approach

Use a dedicated Tauri splash window that is visible during startup while the main window stays hidden. Add a lightweight frontend client component mounted from the root layout. On its first `useEffect`, the component invokes a Tauri command to close the splash window and show the main window.

This keeps the startup responsibility split cleanly:

- Rust owns native window visibility and splash lifecycle.
- The frontend owns the signal that the first frame exists.

## Files

- Modify `src-tauri/src/main.rs` to register the startup-ready command and create the splash lifecycle.
- Modify `src-tauri/tauri.conf.json` to define the splash window.
- Add a small client component under `app/_components/` that reports first render.
- Modify `app/layout.tsx` to mount the startup-ready reporter.
- Modify `app/globals.css` to style the splash page container if needed.
- Add source tests under `tests/` for the Rust and frontend hooks.

## Error Handling

If the splash window is already closed or missing, the startup-ready command should continue without failing hard. The main window should still be shown.

## Testing

- Add a source test asserting that `main.rs` includes splash window show/close behavior and a startup-ready command.
- Add a source test asserting that the frontend root layout mounts the startup-ready reporter and invokes the Tauri command from a client component.
