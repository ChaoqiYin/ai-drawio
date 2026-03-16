# Session Workspace Rename Design

## Goal

Allow users to rename a conversation directly from the session workspace header without leaving the diagram page.

## Context

The home list already supports manual renaming through a modal dialog. The workspace header currently shows the conversation title and metadata, but it does not offer any direct rename action. Users expect title editing to be available where the conversation is actively being used.

## Approaches Considered

### 1. Header button plus modal dialog

This matches the existing home page rename pattern and reuses the same storage API. It is explicit, easy to validate, and low risk for accidental edits.

Recommendation: Use this approach.

### 2. Inline editable title in the header

This reduces clicks, but adds focus and keyboard handling complexity and makes the header state harder to reason about while the draw.io workspace is loading.

## Selected Design

Add a `重命名` button in the session workspace header beside the existing navigation and status controls. Clicking it opens a modal prefilled with the current title. Saving trims whitespace, rejects empty names, persists through `updateConversationTitle`, and updates local `conversation` state so the new title appears immediately in the header.

## Data Flow

1. User clicks `重命名` in the workspace header.
2. The page stores the active conversation id and current title in local state.
3. A modal opens with the current title.
4. On save:
   - trim the entered value
   - reject empty names
   - call `updateConversationTitle`
   - update local `conversation` state with the returned record
5. The session remains open; only the visible title and timestamp refresh.

## Error Handling

- If no conversation is loaded, hide or disable the rename entry.
- Keep the modal open on save failure and show the error inline.
- Disable repeated submits while the rename request is in flight.

## Testing Strategy

- Extend the existing session workspace source/layout test with assertions for modal-driven rename UI.
- Run the full node test suite after implementation.
