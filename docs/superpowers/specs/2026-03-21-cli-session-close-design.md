# CLI Session Close Design

## Summary

The packaged `ai-drawio` CLI must support `session close <session-id>` to close one already-opened session tab from the workspace detail page.
The new command must mirror the existing tab close button behavior instead of inventing a separate runtime state path.

## Goals

- Add `ai-drawio session close <session-id>` as a first-class CLI command.
- Route the command through the existing control server and shell bridge.
- Reuse the same workspace-session store close path that the detail-page tab close button already uses.
- Return a clear error when the target session exists in storage but is not currently opened in the detail shell.

## Non-Goals

- Auto-opening a session before closing it.
- Closing persisted session data from local storage.
- Changing the existing fallback session selection behavior after a tab is closed.
- Redirecting the UI away from `/session` when the last tab is closed.

## CLI Contract

### Session command

- `ai-drawio session close <session-id>`
  Closes the specified session only if it is currently opened in the detail-page tab set.

### Success result

The command should return a successful structured response with:

- `sessionId`: the closed session id
- `status`: `"closed"`

### Error result

- `SESSION_NOT_FOUND`
  The persisted session id does not exist in local storage.
- `SESSION_NOT_OPEN`
  The persisted session exists, but the detail shell does not currently have that session opened as a tab.

## Execution Flow

1. The CLI parser accepts `session close <session-id>`.
2. The packaged CLI builds a `session.close` control request with that exact `sessionId`.
3. The control server validates and dispatches the request.
4. The runtime confirms the persisted session exists.
5. The runtime asks the frontend shell bridge to close the session.
6. The frontend shell bridge checks whether the session is currently opened in the workspace-session store.
7. If opened, the bridge reuses the existing store `closeSession(sessionId)` behavior.
8. If not opened, the bridge throws `SESSION_NOT_OPEN`.

## Frontend Integration

The shell bridge already exposes `conversationStore.openSession(id, options)`.
It should also expose `conversationStore.closeSession(id)`.

`closeSession(id)` must:

- inspect `useWorkspaceSessionStore.getState().openedSessions`
- throw a structured error if the session is not opened
- call `useWorkspaceSessionStore.getState().closeSession(id)` when it is opened
- avoid changing routes directly

This keeps CLI close behavior aligned with clicking the session tab close button in the detail shell.

## Files To Update

- `src-tauri/src/cli_schema.rs`
- `src-tauri/src/packaged_cli.rs`
- `src-tauri/src/control_protocol.rs`
- `src-tauri/src/control_server.rs`
- `src-tauri/src/session_runtime.rs`
- `app/(internal)/_components/internal-shell-bridge.tsx`
- `README.md`
- `tests/packaged-tauri-cli-source.test.ts`
- `tests/internal-shell-bridge-source.test.ts`

## Test Strategy

- Rust parser tests for `session close <session-id>`.
- Rust request-building tests for `session.close`.
- Rust control-protocol validation tests for `session.close`.
- Node source assertion tests that the shell bridge exposes `closeSession` and checks the opened-session set before reusing the store close path.
- README/source assertion updates for the new CLI command.
