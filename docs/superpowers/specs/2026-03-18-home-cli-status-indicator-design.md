# Home CLI Status Indicator Design

**Date:** 2026-03-18

**Goal:** Add a desktop-style CLI integration status indicator to the home page and move the settings entry into a dedicated icon button placed in a toolbar-like area.

## Context

The home page currently exposes settings as a normal text button inside the primary action row. That makes the top area behave like a web page action list instead of a traditional desktop application window.

The settings page already defines the authoritative CLI integration status model:

- `not_installed`
- `installed`
- `installed_other_build`
- `mismatched`
- `error`

The user explicitly requested that the home page status indicator use the exact same status meanings and corresponding colors as the settings page.

## Product Decision

The home page header becomes a two-layer desktop-style panel:

1. a compact toolbar row
2. a primary action area below it

The toolbar row contains:

- left: CLI status lamp plus status label
- right: dedicated settings icon button

The primary action area keeps:

- the page title
- the create conversation primary button
- the clear-local-data destructive button

The text `Settings` button is removed from the action row.

## Shared Status Logic

Status text and color mapping must move into a shared frontend helper so the home page and settings page cannot drift.

Required mappings:

- `installed` → green → `已安装`
- `installed_other_build` → orange → `已安装到其他构建`
- `mismatched` → orange → `安装目标异常`
- `error` → red → `状态异常`
- `not_installed` → gray → `未安装`

## Home Page Behavior

On home page load:

1. request CLI install status from the same Tauri helper used by settings
2. display a small round lamp using the shared color mapping
3. show the shared status label next to the lamp
4. preserve navigation behavior for the settings entry through `router.push("/settings")`

If the status request throws, the home page should fall back to the shared `error` state so the toolbar still communicates that the integration status could not be confirmed.

## Testing

Add source-level tests that verify:

- shared status mapping exists in a dedicated helper
- settings page imports and uses the shared helper
- home page imports the status helper and CLI status loader
- home page renders a toolbar-like top row with a status lamp and icon-only settings button
