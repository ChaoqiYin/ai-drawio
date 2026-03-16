# Conversation Rename Design

## Goal

Allow users to manually rename a local conversation from the home list without affecting the existing open-session navigation flow.

## Context

The current home page lets users create, open, and delete conversations stored in IndexedDB. Titles are now auto-generated with an incrementing suffix, which improves distinction, but users still need a manual way to rename conversations to something meaningful.

## Approaches Considered

### 1. Rename from the home list with a modal dialog

This keeps the interaction near the list where users manage conversations. A modal is a good fit because it avoids conflicts with card click navigation and creates a clear place for validation and loading states.

Recommendation: Use this approach.

### 2. Inline edit inside the card title

This would be faster in theory, but it introduces click-target conflicts with opening the session workspace and requires more state management for focus, save, cancel, and blur behavior.

### 3. Rename only in the session workspace header

This would work technically, but it adds more complexity to the workspace page and does not help users manage names before opening a conversation.

## Selected Design

Add a `重命名` action next to `删除` on each conversation card in the home list. Clicking it opens a modal with the current title prefilled. Saving trims whitespace, rejects empty titles, persists the updated record to IndexedDB, updates `updatedAt`, and refreshes the in-memory list state so the UI reflects the new title immediately.

## Data Flow

1. User clicks `重命名` for a conversation card.
2. The home page stores the active conversation id and current title in local state.
3. The modal opens with the existing title.
4. On confirm:
   - trim the new title
   - reject empty strings
   - call a store helper to update the conversation record
   - replace the updated item in local state
   - re-sort the list by `updatedAt`
5. Future navigation to the session page reads the renamed title from IndexedDB automatically.

## Validation And Error Handling

- Allow duplicate titles.
- Reject empty titles after trimming.
- Disable rename actions during page navigation overlay or while the target row is already deleting.
- Show loading state while saving the rename.
- Surface persistence errors through the existing page-level error banner and keep the modal open.

## Testing Strategy

- Add a store API test to require an exported rename helper.
- Add a home source test to require rename UI elements and modal-related state.
- Keep verification lightweight and aligned with the current test suite style.
