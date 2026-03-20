# Settings Tray Toggle Design

## Goal

Add a dedicated system tray settings area to the settings page so users can enable or disable the tray icon from the UI. The setting must:

- apply immediately
- persist across app restarts
- default to disabled on first launch
- change window close behavior when enabled so closing the main window hides it to the tray instead of quitting

## Current Context

The current settings page under `app/(internal)/_components/settings-page.tsx` only contains a single `CLI Integration` card. There is no existing app-level settings persistence module, and there is no dedicated tray runtime or tray settings command exposed to the frontend.

The desktop shell currently manages window visibility directly in `src-tauri/src/main.rs`, but there is no tray setup, tray menu handling, or persisted preference for tray behavior.

## User Decisions

The user clarified the following behavior requirements:

- The settings page should expose a tray enablement control, not a one-shot action button.
- Toggling the setting should take effect immediately.
- The preference should persist across app restarts.
- When tray is enabled, closing the main window should hide it to the tray.
- The settings page should use a dedicated tray card above the existing CLI card.
- The default value on first launch should be disabled.

## Recommended Approach

Implement a focused tray settings flow rather than introducing a general-purpose application settings framework.

Why this approach:

- the feature is tightly scoped
- tray creation and close interception belong on the Tauri side
- it keeps the frontend aligned with real runtime state instead of local optimistic state
- it minimizes surface area while leaving room for a future generalized settings layer if more app settings are added later

## Frontend Design

### Settings Page Layout

Keep the existing internal shell, top navigation, breadcrumb, and scroll container structure unchanged.

Add a new `System Tray` card above the existing `CLI Integration` card. The settings page remains a vertical card list.

The tray card includes:

- title: `系统托盘`
- description explaining that enabling tray support shows a tray icon and changes close behavior to hide the main window instead of quitting
- status rows for:
  - current tray state: `已启用` or `已关闭`
  - close button behavior: `隐藏到托盘` or `退出应用`
- a primary toggle control labeled `启用系统托盘`

The existing CLI integration card remains intact and functionally independent.

### Frontend Data Flow

Add a new helper module under `app/(internal)/_lib/tauri-tray-settings.ts`.

It should:

- define the tray settings response type
- resolve the Tauri `invoke` function the same way the CLI helper does
- expose `getTraySettings()`
- expose `setTrayEnabled(enabled: boolean)`

The settings page loads tray state on mount. When the user toggles the switch:

1. disable the control while the request is in flight
2. call the Tauri command
3. update the UI from the returned authoritative state
4. roll back the UI if the request fails
5. show a scoped error alert for tray failures without affecting the CLI section

## Backend Design

### New Tray Settings Module

Add a dedicated Rust module such as `src-tauri/src/tray_settings.rs`.

It should own:

- persisted tray preference loading and saving
- tray runtime setup and teardown
- tray menu handling
- the mapping from preference state to close behavior

### Persisted Preference

Store a lightweight JSON file in the application config directory, for example:

- file name: `tray-settings.json`

Stored shape:

```json
{
  "enabled": false
}
```

Rules:

- if the file does not exist, default to `enabled: false`
- if the file is malformed, treat it as disabled and return an error state only when needed for UI visibility
- persist only the minimal preference, not redundant derived runtime fields

### Tauri Commands

Add two commands:

- `get_tray_settings`
- `set_tray_enabled`

Suggested response shape:

```ts
type TraySettingsState = {
  enabled: boolean;
  trayVisible: boolean;
  closeBehavior: 'hide_to_tray' | 'quit';
};
```

`get_tray_settings` responsibilities:

- read persisted preference
- inspect whether tray support is currently active
- return a normalized state payload

`set_tray_enabled` responsibilities:

- accept `enabled: boolean`
- persist the new preference
- immediately create or remove the tray
- update close interception behavior
- return the resulting normalized state payload

## Tray Runtime Behavior

### App Startup

During startup:

1. load the persisted tray preference
2. if enabled, create the tray icon and menu
3. if disabled, do not create the tray

### Tray Menu

Provide at least these tray actions:

- `显示主窗口`
- `退出应用`

The show action should restore and focus the main window using the existing window helpers. The quit action must bypass hide-to-tray interception and terminate the app cleanly.

### Close Button Behavior

When tray is enabled:

- intercept the main window close request
- prevent app exit
- hide the main window instead

When tray is disabled:

- allow the close request to proceed normally

The implementation should include an explicit runtime bypass for intentional quit actions initiated from the tray menu so that they do not get converted into a hide operation.

## Error Handling

Frontend expectations:

- tray status load errors only affect the tray card
- tray toggle errors only affect the tray card
- CLI integration continues to work even if tray settings fail

Backend expectations:

- persistence failures return explicit command errors
- tray setup or teardown failures return explicit command errors
- partial failure must not leave the persisted preference and runtime behavior silently inconsistent

## Testing Strategy

### Frontend Source Tests

Update `tests/settings-page-source.test.ts` to assert:

- the settings page renders a dedicated tray card
- the tray card appears above the CLI card
- tray-specific labels and status text exist
- the tray toggle handler and helper usage exist
- the CLI integration section still exists

Add a new helper source test for `app/(internal)/_lib/tauri-tray-settings.ts` to assert:

- the helper resolves a Tauri invoke bridge
- it calls `get_tray_settings`
- it calls `set_tray_enabled`

### Rust Tests

Add focused unit tests for:

- default preference loading when the config file does not exist
- reading and writing the tray settings file
- mapping enabled state to close behavior
- normalized command response values

If the final structure makes it practical, add a source-level regression test to ensure `main.rs` registers the tray commands and hooks close-request interception.

## Implementation Notes

- Keep generated or upstream draw.io assets untouched.
- Keep all source code in English.
- Keep user-facing interactive chat communication in Simplified Chinese.
- Avoid introducing a broad app settings framework unless future requirements justify it.

## Open Follow-Up

If more desktop-behavior preferences are added later, the tray settings module can become the seed for a broader application settings layer. That expansion is intentionally out of scope for this change.
