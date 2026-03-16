# CLI Auto Session Ensure Design

## Goal

Make CLI document operations automatically acquire a usable session detail page before reading or mutating draw.io data.

## Problem

The current CLI flow requires multiple explicit steps:

1. Create a conversation.
2. Open that session route.
3. Wait for the session shell and draw.io bridge to become ready.
4. Read or apply the document.

This split flow is fragile. In practice, `conversation.create` can succeed while `session.open` still times out during route transition, which leaves later document commands targeting no active session.

## Confirmed User Requirements

- If the desktop app is not open:
  - Open the desktop app.
  - Immediately create a real session detail page and open it.
  - Read the current detail-page information.
  - Perform the requested operation.
- If the desktop app is open but not on a session detail page:
  - Immediately create a real session detail page and open it.
  - Read the current detail-page information.
  - Perform the requested operation.
- If the desktop app is already on a session detail page:
  - Read the current detail-page information.
  - Perform the requested operation.
- No temporary session id fallback is allowed.
- `--session` may remain, but only as an explicit strict target.

## Recommended Approach

Introduce a new control command named `session.ensure` and make it the default entry path for document operations.

This command returns a session that is already usable for document I/O. The desktop-side control layer owns the route and readiness state machine instead of the CLI trying to orchestrate several loosely coupled commands.

## Command Semantics

### `session.ensure`

`session.ensure` guarantees that the desktop app ends on a ready session detail page.

Behavior:

- Focus or start the desktop app if necessary.
- Read the current shell state.
- If the current route is a ready session detail page, reuse it.
- Otherwise create a real persisted conversation.
- Navigate to its session route.
- Wait until the route, session id, and draw.io bridge are all ready.
- Return the active session metadata and shell state.

### `session.open --id <id>`

`session.open` remains available, but its semantics become strict:

- It must open exactly the requested session id.
- It must fail if that id does not exist in local storage.
- It must not silently create a different session.
- It must wait until the requested session route is ready before returning.

## CLI Behavior

### Automatic mode

When `--session` is omitted:

- `canvas document.get` first calls `session.ensure`
- `canvas document.apply` first calls `session.ensure`

This matches the desired default workflow and removes the need for a separate create/open sequence in normal use.

### Explicit mode

When `--session <id>` is provided:

- The CLI first calls `session.open` for that exact id.
- The command fails if the id is missing.
- The document operation proceeds only after that exact session is ready.

This preserves deterministic automation for scripts and debugging.

## Frontend Bridge Responsibilities

Expose desktop-shell helpers that can be called from Rust control code:

- create a real persisted conversation
- inspect the current route and active session state
- check whether a requested session id exists

The existing session page bridge continues to own draw.io document access. The new shared shell bridge covers app-level session orchestration even when the app is currently on the home page.

## Error Handling

- Automatic mode never invents temporary ids.
- Explicit mode never swaps to a different session silently.
- Missing requested session id returns a direct error.
- Session readiness timeout remains a first-class error with route details.
- Detail pages without matching stored ids still redirect back to home and surface a user-visible error there.

## Testing Strategy

- CLI parser tests for optional `--session`.
- Rust control tests for `session.ensure` validation.
- Source tests for the shell bridge exposing session orchestration helpers.
- End-to-end local verification:
  - app closed -> automatic document get/apply succeeds
  - app on home page -> automatic document get/apply succeeds
  - app on session page -> automatic document get/apply reuses the current session
  - explicit `--session` with missing id fails

## Expected Outcome

The common CLI experience collapses to a single command per operation, while explicit session targeting remains available for exact automation.
