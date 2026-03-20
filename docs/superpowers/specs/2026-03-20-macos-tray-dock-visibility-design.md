# macOS Tray Dock Visibility Design

## Goal

Hide the macOS Dock icon only while tray mode is active. When the app leaves tray mode and restores the main window, the Dock icon must become visible again.

## Current Context

The tray runtime already persists the tray preference, creates and removes the tray icon, hides the main window when tray mode is enabled, and restores the main window from the tray menu. The Rust module `src-tauri/src/tray_settings.rs` contains two macOS-specific hooks:

- `apply_macos_tray_mode`
- `apply_macos_startup_tray_mode`

Both hooks are currently no-ops. The existing source test also explicitly asserts that the tray runtime does not call `set_dock_visibility`.

## User Decision

The user approved the narrow behavior:

- hide the Dock icon only when tray mode is active
- keep normal startup and normal window mode unchanged
- do not turn the app into an always-hidden-Dock menu bar application

## Recommended Approach

Use Tauri's built-in macOS Dock visibility API and keep activation policy unchanged.

Why this approach:

- it matches the requested behavior exactly
- it minimizes runtime risk compared with changing macOS activation policy
- it fits the existing tray runtime extension points without restructuring the app lifecycle

## Runtime Design

### Tray Mode On

When tray mode is enabled:

1. create the tray icon if needed
2. sync macOS Dock visibility to hidden
3. mark tray runtime state as enabled
4. hide the main window when the caller requests it

### Tray Mode Off

When tray mode is disabled:

1. sync macOS Dock visibility to visible
2. mark tray runtime state as disabled
3. remove the tray icon
4. show and focus the main window

### Restore From Tray

Restoring the main window from the tray menu should:

1. persist `enabled: false`
2. disable tray runtime state
3. remove the tray icon
4. restore Dock visibility
5. show and focus the existing main window

If the restore path fails after the preference changes, the implementation must roll back both the tray preference and the Dock visibility state.

### Startup

At startup, the persisted tray preference should continue to control whether the main window appears immediately. On macOS, startup must also synchronize Dock visibility with that persisted tray preference before the app reaches steady state.

## Platform Scope

Only macOS should change Dock visibility. Other platforms should keep the current no-op behavior.

## Error Handling

- Any Dock visibility failure should surface as a command or setup error instead of being swallowed silently.
- If enabling or disabling tray mode fails mid-transition, the runtime should attempt to restore the previous Dock visibility state.
- The tray runtime should continue to avoid activation-policy changes in this feature.

## Testing Strategy

Update `tests/tauri-tray-runtime-source.test.ts` to:

- assert that the tray runtime now calls `set_dock_visibility`
- assert that startup tray mode synchronization still exists
- keep asserting that activation-policy APIs are not introduced

Run focused source tests plus `cargo check --manifest-path src-tauri/Cargo.toml` after implementation.
