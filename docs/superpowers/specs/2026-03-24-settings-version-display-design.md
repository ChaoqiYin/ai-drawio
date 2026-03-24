# Settings Version Display Design

## Goal

Add the current application version to the settings page so users can see which build is running without leaving the page.

## Current Context

The settings route is rendered by `app/(internal)/settings/page.tsx`, which delegates to `app/(internal)/_components/settings-page.tsx`.

The page currently has:

- the existing internal shell
- a top navigation card with a back button and breadcrumb
- a vertical card list containing the tray settings card

There is no version display in the settings UI today. The repository already contains version metadata in:

- `src-tauri/tauri.conf.json`
- `package.json`

## User Decision

The user chose to place the version string in the top navigation area, aligned to the right side of the header content instead of inside a settings card.

## Recommended Approach

Show a small secondary text label in the settings page top navigation actions area with the format `当前版本 vX.Y.Z`.

Resolve the version from the runtime environment when available, and provide a stable web fallback so the page still renders useful information outside the Tauri shell.

## Frontend Design

### Layout

Keep the existing settings page shell, breadcrumb, and tray card unchanged.

Use the `actions` slot already supported by `InternalTopNavigation` to render the version label on the right side of the top navigation row. This keeps the version scoped as page-level metadata instead of mixing it into a settings section.

### Data Flow

Add a small helper under `app/(internal)/_lib/` to provide a single `getCurrentAppVersion()` entry point.

The helper should:

- try to use the Tauri app version API when running in the desktop shell
- gracefully handle non-Tauri execution
- fall back to a build-time version string derived from the repository package version

The settings page should load the version on mount, store it in local state, and render the label only when a non-empty value is available.

## Runtime Behavior

### Tauri Environment

When the page is running inside the packaged desktop shell, the displayed version should come from the Tauri runtime app metadata so the UI reflects the actual application build.

### Web or Test Environment

When Tauri APIs are unavailable, the version label should fall back to the repository package version. This keeps local web development and source-level tests deterministic.

## Error Handling

- Failure to read the runtime version must not block the settings page
- if runtime lookup fails, use the fallback version instead of surfacing an error banner
- if neither source yields a usable version, omit the version label entirely

## Testing Strategy

Update `tests/settings-page-source.test.ts` to assert:

- the settings page imports the version helper
- the top navigation uses the `actions` slot for the version label
- the rendered copy contains `当前版本`

Add a focused helper source test to assert the new version helper:

- imports the Tauri app API
- exposes the fallback package version
- returns runtime version first and fallback behavior second

## Implementation Notes

- keep all generated files untouched
- keep the new helper narrowly scoped to version lookup only
- preserve the current settings page layout and tray behavior
