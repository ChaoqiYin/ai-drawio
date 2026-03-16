# Local AI Canvas Document Bridge Design

## Summary

This design adds a companion CLI that can open the desktop application, switch to a target session, read the current draw.io document XML, and apply a full replacement XML back to the embedded canvas.
The control model is document-driven rather than shape-driven because the local AI already understands draw.io XML structure and should operate on the full document snapshot.

## Goals

- Let a local AI skill launch or activate the desktop application.
- Let the skill open a specific Next.js session route by conversation ID.
- Let the skill fetch the full draw.io XML document from the current canvas.
- Let the skill submit a full replacement XML document and trigger a redraw.
- Keep draw.io source assets under `webapp/` untouched.
- Preserve the existing Tauri -> Next.js -> iframe architecture.

## Non-Goals

- No fine-grained canvas commands such as "create rectangle" or "create edge" in the first iteration.
- No XML patch format in the first iteration.
- No server-backed storage for AI sessions or draw.io documents.
- No direct exposure of arbitrary JavaScript execution to the external CLI.

## Chosen Approach

Expose a small companion CLI named `ai-drawio` as a separate control entrypoint.
The CLI talks to the running desktop app through a loopback-only local HTTP control server managed by Tauri.
The desktop app validates the request, ensures the correct Next.js session page is active, then bridges into the draw.io iframe to either read or replace the full XML document.

The public command surface for the skill is intentionally small:

- `ai-drawio open`
- `ai-drawio status`
- `ai-drawio session open --id <sessionId>`
- `ai-drawio canvas document.get --session <sessionId>`
- `ai-drawio canvas document.apply --session <sessionId> --xml-file <path>`
- `ai-drawio canvas document.apply --session <sessionId> --xml-stdin`

## Why Document-Driven Control

The local AI already understands draw.io concepts and XML structure.
Trying to mirror every canvas action as a bespoke command would create a large and fragile command API that still leaks draw.io details.

Document-driven control keeps the integration boundary compact:

- the CLI only knows how to request document snapshots and submit replacements
- the AI is free to transform XML however it wants
- the application only needs to guarantee safe document read/apply behavior

This produces a much smaller long-term maintenance surface.

## Architecture

### External Control Layer

The companion CLI is a standalone tool from the skill's perspective.
It is responsible for:

- parsing command-line arguments
- starting or activating the desktop app
- sending structured requests to the local control endpoint
- printing structured JSON responses

The skill never calls Tauri APIs directly and never depends on draw.io runtime details.

### Local Control Server

The Tauri application owns a loopback-only HTTP server, bound to `127.0.0.1` on a deterministic or discoverable port.
The server accepts JSON requests, routes them to internal services, and returns structured JSON responses.

The server does not implement draw.io logic.
It only coordinates:

- app readiness
- session routing
- iframe readiness
- document service dispatch
- timeout and error handling

### Session Runtime Layer

The Next.js session page remains the shell around the iframe.
It already owns the iframe reference and exposes `window.__AI_DRAWIO_SHELL__.getFrameWindow()`.
This layer will be extended to expose enough shell state for the Tauri side to determine:

- which session is currently open
- whether the iframe has finished loading
- whether a document bridge is ready

### Document Service Layer

The application exposes two high-level operations:

- `getCurrentDocument()`
- `applyDocument({ xml, baseVersion })`

This service is responsible for:

- validating non-empty XML payloads
- verifying the active session
- computing and comparing document versions
- calling the draw.io adapter
- returning structured results

### Draw.io Adapter Layer

The draw.io adapter is the only layer that knows how to talk to the embedded draw.io runtime.
It uses the existing iframe bridge in `src-tauri/src/webview_api.rs` to execute tightly scoped scripts against the frame window.

The adapter needs to support two operations only:

- read the current XML from the live document
- replace the live document XML and trigger redraw

Because draw.io source code must remain unmodified, the exact runtime calls must be discovered and verified against the loaded build during implementation.

## Request and Response Contract

All control requests use one JSON envelope:

```json
{
  "requestId": "req_20260312_001",
  "command": "canvas.document.get",
  "sessionId": "sess_123",
  "payload": {},
  "timeoutMs": 15000,
  "source": {
    "type": "skill",
    "name": "local-ai-drawio-skill"
  }
}
```

All responses return:

```json
{
  "ok": true,
  "requestId": "req_20260312_001",
  "command": "canvas.document.get",
  "sessionId": "sess_123",
  "data": {},
  "error": null
}
```

Failures return a structured `error` object with `code`, `message`, and optional `details`.

## Document Versioning

The first iteration uses content hashing for optimistic concurrency control:

- `version = sha256(xml)`
- `canvas.document.get` always returns the current version
- `canvas.document.apply` accepts `baseVersion`
- if `baseVersion` is provided and does not match the current document version, the request fails

This protects against stale AI snapshots overwriting a manually edited canvas.

## Error Model

The first iteration should standardize on these codes:

- `APP_NOT_RUNNING`
- `APP_NOT_READY`
- `SESSION_NOT_FOUND`
- `SESSION_NOT_OPEN`
- `FRAME_NOT_READY`
- `DOCUMENT_NOT_AVAILABLE`
- `DOCUMENT_INVALID`
- `DOCUMENT_VERSION_MISMATCH`
- `COMMAND_TIMEOUT`
- `UNSUPPORTED_COMMAND`
- `INTERNAL_ERROR`

## Implementation Phases

### Phase 1: Runtime Discovery

Before shipping document APIs, verify which draw.io globals or editor objects can reliably:

- export the current document XML
- import a replacement XML document
- redraw the current canvas

This discovery phase must happen against the embedded iframe build served by `/drawio/index.html`.
The output should be a narrow, tested adapter contract rather than ad hoc scripts spread across the codebase.

### Phase 2: App State and Session Introspection

Add explicit shell state helpers so the desktop layer can verify:

- current route
- current `sessionId`
- iframe ready state
- document bridge ready state

This avoids blind command execution against the wrong page or wrong session.

### Phase 3: Local Control Server

Add a small HTTP server inside the Tauri runtime.
It should accept the command envelope, route to handlers, and return structured JSON.

This gives the CLI a stable target without coupling the skill to Tauri internals.

### Phase 4: Document Service

Implement `canvas.document.get` and `canvas.document.apply`.
This layer computes versions, validates session alignment, and delegates XML reads and writes to the draw.io adapter.

### Phase 5: Companion CLI

Implement the standalone `ai-drawio` command wrapper.
It should support file input, stdin input, structured JSON output, and application bootstrap behavior.

## File Placement

The current repository shape suggests the following landing zones:

- `src-tauri/src/main.rs`
  Register the control server lifecycle and any new Tauri commands.
- `src-tauri/src/webview_api.rs`
  Reuse and extend the iframe execution bridge.
- `src-tauri/src/control_server.rs`
  New local HTTP control server and request router.
- `src-tauri/src/control_protocol.rs`
  New typed request and response models.
- `src-tauri/src/document_bridge.rs`
  New document-level service and version checks.
- `src-tauri/src/drawio_adapter.rs`
  New runtime-specific XML get/apply adapter.
- `components/session-workspace.js`
  Extend shell state exposure for current session and iframe readiness.
- `lib/conversation-store.js`
  Reuse session identifiers as the routing target; no persistence changes required in the first iteration.
- `scripts/ai-drawio-cli.mjs`
  Initial companion CLI implementation inside the repo.
- `tests/`
  Node-side contract tests for the CLI and payload handling.

## Testing Strategy

### Automated

- Rust unit tests for request validation, version mismatch handling, and adapter script builders.
- Node tests for CLI argument parsing and JSON payload generation.

### Manual Smoke Tests

- Start the desktop app from the CLI.
- Open a known session from the CLI.
- Read the current XML from the canvas.
- Re-apply the same XML and verify the canvas stays stable.
- Apply a modified XML document and verify the redraw.
- Confirm stale `baseVersion` requests are rejected.

## Risks

### Draw.io Runtime Discovery

The largest technical risk is identifying stable runtime calls for exporting and importing XML without modifying draw.io source.
This is why a dedicated discovery phase is part of the design rather than an implementation afterthought.

### Loopback Server Lifecycle

The app must expose a predictable way for the CLI to locate the active control port.
If the port strategy is not nailed down early, the CLI experience becomes unreliable.

### Large XML Payloads

Full document round-trips can become large.
The first iteration should still support them, but the transport layer should enforce timeout and request-size protections even if batch-step limits are intentionally omitted.

## Recommendation

Build the first iteration exactly around full-document get/apply operations.
Do not introduce XML patching or fine-grained drawing commands until the document-driven workflow is proven stable with the local AI skill.
