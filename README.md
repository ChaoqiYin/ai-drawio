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
- The DMG install flow is drag-and-drop first, then explicit in-app registration from Settings.
- Use `Install ai-drawio into PATH` from the Settings page to register `/usr/local/bin/ai-drawio`.
- When invoked from a terminal with a CLI command, the binary behaves like a helper:
  - it connects to an already running desktop instance when possible
  - otherwise it launches a detached GUI instance, waits for the local control server, then executes the command
- Shell completion artifacts are generated into `src-tauri/target/cli-completions/` during Rust/Tauri builds.
- The in-app PATH installer creates the binary link at `/usr/local/bin/ai-drawio` and installs completions into:
  - `/usr/local/share/zsh/site-functions/_ai-drawio`
  - `/usr/local/etc/bash_completion.d/ai-drawio`
  - `/usr/local/share/fish/vendor_completions.d/ai-drawio.fish`

- `ai-drawio session list`
  Lists all persisted local sessions and returns each session `id` and `title`.
- `ai-drawio session open <conversation-id>`
  Opens one persisted session by id.
- `ai-drawio session open --title <conversation-title>`
  Opens one persisted session by exact title.
- `ai-drawio canvas document.get`
  Automatically ensures there is a ready session detail page before reading the document.
- `ai-drawio canvas document.get --session <conversation-id>`
  Uses a strict explicit session override.
- `ai-drawio canvas document.apply <path>`
  Automatically ensures there is a ready session detail page before applying the document.
- `ai-drawio canvas document.apply --xml-stdin`
  Reads the document from stdin instead of a positional file path.
- `--session <conversation-id>`
  Remains available as a strict override. When provided, the CLI must open and operate on that exact persisted session id, and it fails directly if the id does not exist.

Default automatic flow:

1. If the desktop app is not open, start it.
2. If the app is not already on a ready session detail page, create a real persisted session and open it.
3. If the app is already on a ready session detail page, reuse it.
4. Perform the requested document operation.

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
