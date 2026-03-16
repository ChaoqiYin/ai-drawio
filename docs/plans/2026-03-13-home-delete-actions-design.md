# Home Delete Actions Design

**Date:** 2026-03-13

## Goal

Add deletion controls to the local drawing list on the home page, including per-item deletion and a destructive action that clears all IndexedDB databases for the current origin.

## Approved Behavior

- Each list item exposes a delete action.
- Single-item deletion uses a normal confirmation prompt before deleting only that record.
- The home page header exposes a "clear all local data" action.
- Global deletion uses a normal confirmation prompt before deleting every IndexedDB database under the current origin.
- After success, the list updates immediately without a full reload.
- Failures surface through the existing error area.

## Data Layer Changes

- Add `deleteConversation(id)` to remove one record from the existing `conversations` store.
- Add `clearAllIndexedDbDatabases()` to enumerate current-origin IndexedDB databases with `indexedDB.databases()` and delete each one with `indexedDB.deleteDatabase(name)`.
- If database enumeration is unavailable, fail explicitly with a user-facing error.

## UI Changes

- Add a delete button to each home page item card.
- Prevent the delete button from triggering the card navigation.
- Add a high-risk "clear all local data" button beside the create button area.
- Track in-progress deletion state for both per-item and global deletion actions.

## Verification

- Node test coverage for store helper exports and behavior.
- Source-level regression test for home page delete controls.
- Full Node tests pass.
- Frontend build passes.
