# CLI Session ID Enforcement Design

## Summary

The packaged `ai-drawio` CLI must require explicit session IDs for session-targeted operations.
Canvas commands may only operate on a caller-specified session ID and may not auto-select, auto-create, or resolve by title.

## Goals

- Require a positional `session-id` for all CLI commands that target an existing session.
- Add a dedicated `session create` command that creates a new session, waits until it is open and ready, and returns the new ID.
- Keep readiness checks only for operations that depend on the draw.io iframe runtime.
- Preserve internal control protocol capabilities that are still useful outside the packaged CLI.

## Non-Goals

- Removing internal `session.ensure` support from the control protocol.
- Removing title-based resolution from non-CLI internal consumers.
- Refactoring the broader control server architecture.

## CLI Contract

### Session commands

- `ai-drawio session list`
  Returns persisted session metadata only.
- `ai-drawio session create`
  Creates a new session, opens it, waits until it is ready, and returns the new `sessionId`.
- `ai-drawio session open <session-id>`
  Opens an existing session by ID and waits until it is ready.

The CLI must not accept `--title` for `session open`.

### Canvas commands

All canvas commands must require a positional `session-id` argument:

- `ai-drawio canvas document.get <session-id> [--output-file <path>]`
- `ai-drawio canvas document.svg <session-id> [--output-file <dir>]`
- `ai-drawio canvas document.preview <session-id> <output-directory> [--page <page-number>]`
- `ai-drawio canvas document.apply <session-id> <prompt> [<xml> | --xml-file <path> | --xml-stdin] [--base-version <version>] [--output-file <path>]`
- `ai-drawio canvas document.restore <session-id> [<xml> | --xml-file <path> | --xml-stdin] [--base-version <version>]`

The CLI must not accept:

- omitted session selection
- `--session`
- `--session-title`
- any automatic fallback to `session.ensure`

## Readiness Rules

Commands that depend on the draw.io iframe runtime must only run after the target session has been opened and confirmed ready:

- `session open <session-id>`
- all `canvas.document.*` commands
- `session create` because it returns a newly created ready-to-use session

Commands that only inspect stored metadata do not need iframe readiness:

- `session list`

## Execution Flow

### Session create

1. Send `conversation.create`.
2. Extract the returned `sessionId`.
3. Send `session.open` with that `sessionId`.
4. Return the ready-state response as `session.create`.

### Canvas commands

1. Send `session.open` with the caller-specified `sessionId`.
2. If `session.open` fails, return that error immediately.
3. Build and send the corresponding canvas control request with the same `sessionId`.
4. Continue to rely on document-layer `require_session_ready` as the final runtime guard.

## Files To Update

- `src-tauri/src/cli_schema.rs`
- `src-tauri/src/packaged_cli.rs`
- `README.md`
- `tests/packaged-tauri-cli-source.test.ts`

## Test Strategy

- Rust parser tests for required positional `session-id` arguments.
- Rust execution/request-building tests for `session create` and the removal of `session.ensure` fallback.
- Source-level documentation tests for the new command shapes in schema and README.
