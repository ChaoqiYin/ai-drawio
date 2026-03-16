# Conversation Sync Design

## Goal

Keep conversation list data in sync inside the same application runtime after a conversation is created, renamed, or deleted from another page.

## Context

The home page and the session workspace now both support conversation title updates. Without an application-level synchronization mechanism, the home list can stay stale until it is reloaded or manually revisited. The requirement is limited to the same app instance in the same browser tab.

## Approaches Considered

### 1. Store-level change subscription

Add a lightweight event channel to the conversation store and emit change notifications after successful writes. Pages that care about freshness can subscribe and re-fetch the latest list.

Recommendation: Use this approach.

### 2. Re-fetch only on page focus or remount

This is simpler, but it does not satisfy the requirement that the home list update immediately while still mounted.

### 3. Move conversations into a global React state container

This would work, but it is too heavy for the current app size and would force broader refactors.

## Selected Design

Add a store-level subscription API for conversation mutations. The store emits a change event after successful create, rename, delete, and clear operations. The home page subscribes on mount and re-runs `listConversations()` whenever an event arrives. This keeps sort order, timestamps, and titles consistent without manual partial patching in every caller.

## Event Scope

- Same tab, same application runtime only
- No cross-tab synchronization
- No persistence of events themselves

## Data Flow

1. A write operation succeeds in `conversation-store.ts`.
2. The store emits a lightweight change event.
3. `conversation-home.tsx` receives the event through its subscription.
4. The page calls `listConversations()` again and replaces local list state with the latest sorted data.

## Error Handling

- If reloading after an event fails, keep the current list visible and surface the error through the existing page-level error banner.
- The subscription API should be safe to call in non-browser environments and return a no-op unsubscribe function there.

## Testing Strategy

- Extend the store API test to require the subscription export.
- Extend the home source test to require the subscription usage and event-driven reload path.
- Run the full node test suite after implementation.
