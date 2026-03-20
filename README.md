# AI Drawio Tauri Shell

This repository uses a statically exported Next.js frontend as the Tauri entry application.
The desktop app starts on a local AI conversation history page and opens draw.io inside an iframe on the session route.

## Runtime Model

- Next.js exports static assets into `out/`.
- Tauri loads the exported frontend from `out/`.
- Internal Next.js routes, components, and browser-only helpers live under `app/(internal)/`.
- `webapp/` stays unchanged and is copied into `public/drawio/` during frontend builds.
- AI conversation history is stored only in browser IndexedDB.
- draw.io is embedded from `/drawio/index.html` on the `/session?id=<conversation-id>` route.

## Start the Desktop App

1. Install a Rust toolchain with `cargo`.
2. Install Node.js dependencies with `npm install`.
3. Start the desktop shell with `npm run dev`.

## Build Pipeline

- `npm run build:web`
  Builds the static Next.js frontend and copies draw.io assets into the export output.
- `npm run dev`
  Runs `tauri dev`, which triggers the static frontend build before launching the desktop app.
- `npm run build`
  Runs `tauri build`, which also rebuilds the static frontend first.
- `npm run build -- --bundles dmg`
  Runs the Tauri macOS DMG bundler for drag-and-drop installation of `AI Drawio.app`.

## Frontend Routes

- `/`
  Lists local AI conversation history from IndexedDB.
- `/session?id=<conversation-id>`
  Loads one local conversation and embeds draw.io in an iframe.

## CLI Behavior

- The packaged macOS binary is named `ai-drawio`.
- The DMG install flow is drag-and-drop installation of `AI Drawio.app`.
- When invoked from a terminal with a CLI command, the binary behaves like a helper:
  - `ai-drawio open` can launch the desktop app directly
  - other commands connect to an already running desktop instance when possible
  - otherwise non-open commands return a structured response telling the caller to open the desktop window manually

- `ai-drawio open`
  Launches the desktop app and defaults to tray startup mode.
- `ai-drawio open --mode window`
  Launches the desktop app in window mode for this run only without persisting the tray preference.
- `ai-drawio session list`
  Lists all persisted local sessions and returns each session `id` and `title`.
- `ai-drawio session create`
  Creates a new persisted session, opens it, waits until the draw.io runtime is ready, and returns the new `sessionId`.
- `ai-drawio status`
  Inspects whether the desktop app is running.
- `ai-drawio session status <session-id>`
  Inspects whether the specified session is ready.
- `ai-drawio session open <session-id>`
  Opens one persisted session by id and waits until it is ready.
- `ai-drawio canvas document.get <session-id>`
  Reads the specified draw.io document from the specified ready session.
- `ai-drawio canvas document.svg <session-id> --output-file <path>`
  Exports per-page SVG files for the specified document into the output directory.
- `ai-drawio canvas document.preview <session-id> <output-directory>`
  Exports every page of the specified document as PNG preview files into the required output directory and returns JSON with absolute file paths.
- `ai-drawio canvas document.preview <session-id> <output-directory> --page <page-number>`
  Exports only the selected 1-based page from the specified document as a PNG preview file and returns JSON with the generated file path.
- `ai-drawio canvas document.apply <session-id> <prompt> '<mxfile>...</mxfile>'`
  Treats the first positional argument as the target session id, the second as the required request summary, and the third as inline XML content before applying the document.
- `ai-drawio canvas document.apply <session-id> <prompt> --xml-file <path>`
  Uses the target session id and request summary first, then reads the XML content from a file path before applying the document.
- `ai-drawio canvas document.apply <session-id> <prompt> --xml-stdin`
  Uses the target session id and request summary first, then reads the document from stdin instead of an inline XML argument.
- `ai-drawio canvas document.restore <session-id> '<mxfile>...</mxfile>'`
  Restores inline XML content to the specified session without adding canvas history.
- `ai-drawio canvas document.restore <session-id> --xml-file <path>`
  Reads restore XML content from a file path for the specified session.

Session targeting rules:

1. CLI operations on existing sessions must use an explicit positional `session-id`.
2. The CLI does not resolve sessions by title.
3. The CLI does not auto-select or auto-create a session for canvas commands.
4. If a command depends on the draw.io iframe runtime, the CLI first opens the requested session and waits for readiness.

## Backend Commands

The Rust shell exposes two Tauri commands:

- `call_page_method`
- `eval_page_script`

Both commands target the draw.io iframe window exposed by the Next.js session shell.

### `call_page_method`

Request shape:

```json
{
  "methodPath": "App.actions.openFile",
  "args": ["demo.drawio"]
}
```

### `eval_page_script`

Request shape:

```json
{
  "script": "window.dispatchEvent(new CustomEvent('custom-action'))"
}
```

## Known Limits

- Private functions inside closures or module scope cannot be called directly.
- The Rust bridge only works on the session route, where the iframe shell helper exists.
- Conversation history is browser-only and is not mirrored to Rust or local files.
