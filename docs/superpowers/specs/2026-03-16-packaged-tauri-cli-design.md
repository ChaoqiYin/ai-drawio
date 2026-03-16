# Packaged Tauri Binary CLI Design

**Date:** 2026-03-16

**Goal:** Replace the current Node-based `ai-drawio` wrapper with a packaged macOS Tauri binary CLI that preserves the existing command semantics, exposes the same JSON protocol for AI terminal usage, and ships with installable shell completion files as part of the macOS installer output.

## Context

The repository currently exposes a development-facing CLI through `package.json -> bin -> scripts/ai-drawio-cli.ts`.

That script already defines the command contract used by local automation and AI terminal workflows:

- launch or inspect the desktop app
- create conversations
- list and open sessions
- fetch and apply draw.io documents through the local control server

However, the current entrypoint is a Node script, not the packaged Tauri application binary. That creates two deployment gaps:

1. installed desktop builds do not expose a short terminal command by default
2. the packaged binary does not yet own the CLI contract

The requested outcome is a macOS-installed application that AI terminals can call directly with a short command such as `ai-drawio`, without depending on the Node script wrapper.

## Official Documentation Constraints

The design is intentionally aligned with Tauri's documented capabilities:

- The Tauri CLI plugin provides command parsing via `clap` and is configured through `tauri.conf.json`.
- The CLI plugin supports positional arguments, named arguments, flags, and nested subcommands.
- The `mainBinaryName` config key only renames the main executable file during build and bundle steps.
- The shell plugin is for spawning child processes and does not provide command completion or PATH registration.
- On macOS, the built application bundle contains the executable inside the `.app` bundle structure.
- Tauri documents DMG distribution as drag-to-Applications installation, while signed PKG generation is shown through `productbuild`.

These constraints lead to one important architectural conclusion:

- `tauri-plugin-cli` can define the packaged binary CLI surface
- it cannot, by itself, guarantee that the installed app registers a short command in `PATH`

Because the requirement is "installed app, then short command immediately available", the distribution path must include a macOS installer step that creates the terminal command entrypoint.

## Product Decision

The packaged macOS application binary becomes the canonical CLI implementation.

The current TypeScript CLI is treated as the compatibility reference during migration, not the final runtime entrypoint.

The installed short command remains:

- `ai-drawio`

The implementation preserves existing behavior unless explicitly redesigned later. In particular:

- `canvas document.get` keeps its current semantics
- `canvas document.apply` keeps its current semantics
- JSON output shape remains stable for AI terminal consumers

## CLI Surface

### Root Commands

The packaged binary must expose the following command paths:

- `open`
- `status`
- `conversation create`
- `session list`
- `session open`
- `canvas document.get`
- `canvas document.apply`

### Session Open

Supported forms:

- `ai-drawio session open <session-id>`
- `ai-drawio session open --title <session-title>`

Rules:

- `<session-id>` is the default required input form
- `--title` remains the special lookup form
- the two forms are mutually exclusive

### Canvas Document Get

Supported forms:

- `ai-drawio canvas document.get`
- `ai-drawio canvas document.get --session <session-id>`
- `ai-drawio canvas document.get --session-title <session-title>`
- `ai-drawio canvas document.get --output-file <path>`

Rules:

- existing behavior stays unchanged
- `--session` and `--session-title` remain optional targeting overrides
- `--output-file` remains optional

### Canvas Document Apply

Supported forms:

- `ai-drawio canvas document.apply <xml-file>`
- `ai-drawio canvas document.apply <xml-file> --session <session-id>`
- `ai-drawio canvas document.apply <xml-file> --session-title <session-title>`
- `ai-drawio canvas document.apply <xml-file> --base-version <version>`
- `ai-drawio canvas document.apply <xml-file> --prompt <text>`
- `ai-drawio canvas document.apply <xml-file> --output-file <path>`
- `ai-drawio canvas document.apply --xml-stdin`
- `ai-drawio canvas document.apply --xml-stdin --session <session-id>`
- `ai-drawio canvas document.apply --xml-stdin --session-title <session-title>`
- `ai-drawio canvas document.apply --xml-stdin --base-version <version>`
- `ai-drawio canvas document.apply --xml-stdin --prompt <text>`
- `ai-drawio canvas document.apply --xml-stdin --output-file <path>`

Rules:

- `<xml-file>` is the default required input form
- `--xml-stdin` remains the alternate special input mode
- `<xml-file>` and `--xml-stdin` are mutually exclusive
- `--session` and `--session-title` remain optional and mutually exclusive
- `--base-version`, `--prompt`, and `--output-file` remain optional

## Compatibility Contract

### Behavioral Compatibility

The new packaged binary CLI must preserve the current operational model:

- talk to the existing local control server
- keep the same app launch behavior
- keep the same session-resolution behavior
- keep the same document read and write flow

This migration changes the runtime host of the CLI, not the meaning of the commands.

### JSON Compatibility

Success and failure output must remain machine-friendly JSON.

Required compatibility goals:

- success returns structured JSON objects
- failure returns structured JSON objects
- existing field names should remain stable where possible
- exit code semantics remain aligned with `ok: true/false`

This is critical because AI terminals and automation scripts depend on predictable structured output rather than human-oriented prose.

## Architecture

### Unit 1: Tauri CLI Definition

Locations:

- `src-tauri/tauri.conf.json`
- Rust bootstrap in `src-tauri/src/main.rs`

Responsibility:

- register `tauri-plugin-cli`
- define the command tree and argument schema
- keep the command shape aligned with the approved interface above

### Unit 2: CLI Match Parsing Layer

Location:

- new Rust module under `src-tauri/src/`

Responsibility:

- translate `tauri-plugin-cli` match data into the existing internal command model
- enforce mutual exclusion and required-input rules
- normalize positional and named arguments into one stable internal representation

This layer replaces the parsing responsibilities currently handled by `scripts/ai-drawio-cli.ts`.

### Unit 3: CLI Execution Bridge

Location:

- new Rust module under `src-tauri/src/`

Responsibility:

- execute approved CLI commands against the current control server / session runtime flow
- preserve the current JSON response contract
- support file reads, stdin reads, and output file writes where required

### Unit 4: macOS Installer Registration

Locations:

- bundle/installer assets to be added under `src-tauri/` or build-support scripts

Responsibility:

- package the `.app`
- register the short command `ai-drawio` into a PATH-visible location during install
- install generated shell completion files

This unit is separate from the CLI parser itself because PATH registration is an installer concern, not a runtime CLI concern.

## Distribution Decision

### Why DMG Alone Is Insufficient

DMG installation is a drag-to-Applications workflow. That is appropriate for GUI distribution, but it does not inherently create a short command in `PATH`.

That means DMG alone does not satisfy:

- install the app
- immediately call `ai-drawio` from an AI terminal

### Recommended macOS Distribution

Use a PKG-based install flow for the CLI-enabled desktop distribution.

Installer responsibilities:

1. install the `.app`
2. create `/usr/local/bin/ai-drawio` pointing to the packaged binary inside the installed app bundle
3. install shell completion files

The app bundle remains the actual application payload. The installer is the mechanism that makes the terminal command immediately available.

## Completion Files

Shell completion files are part of the installer output, not an afterthought.

The build pipeline must generate completion files for the packaged command and stage them for installer inclusion.

Initial scope:

- `zsh`
- `bash`
- `fish`

Completion generation should reflect the approved command tree, especially:

- positional `session-id` on `session open`
- positional `xml-file` on `canvas document.apply`
- optional named arguments for title/session targeting and advanced apply metadata

## Error Handling

### Parse Errors

CLI parse and validation failures must return structured JSON errors instead of free-form console help text as the primary contract surface.

This includes:

- missing required positional input
- invalid mutually exclusive argument combinations
- unsupported command shapes

### Runtime Errors

Runtime failures must also stay structured:

- missing running app when a command requires it and launch fails
- unresolved session or title lookup failures
- file read and stdin read failures
- output file write failures
- control server request failures

## Migration Strategy

### Stage 1: Feature Parity in Rust

Implement the packaged binary CLI in Rust while keeping the TypeScript wrapper available as a compatibility reference during development.

### Stage 2: Verification Against Existing Tests

Port or adapt the current CLI parser and behavior tests so the Rust CLI proves parity with the existing interface.

### Stage 3: Installer Integration

Add macOS installer packaging that registers the short command and installs completion files.

### Stage 4: Deprecation Review

After parity is proven and installer registration works, decide whether the TypeScript wrapper remains as a development-only helper or is removed.

## Testing Strategy

### Parser Tests

Add focused tests for:

- `session open <session-id>`
- `session open --title <session-title>`
- `canvas document.apply <xml-file>`
- `canvas document.apply --xml-stdin`
- mutual exclusion handling
- optional targeting and metadata arguments

### Runtime Contract Tests

Add tests for:

- JSON success output shape
- JSON error output shape
- current `canvas document.get` behavior parity
- current `canvas document.apply` behavior parity

### Installer Verification

Add verification steps for:

- installed app bundle location
- created `/usr/local/bin/ai-drawio` link or launcher
- generated completion files included in installer payload
- post-install terminal invocation succeeds on macOS

## Open Risks

### CLI Plugin Output Control

`tauri-plugin-cli` naturally provides clap-style parsing and help output. The implementation must ensure the app still returns structured JSON in automation-facing error paths.

### PATH Registration Permissions

Installing a short command into `/usr/local/bin` is an installer concern and may require elevated install permissions. The installer flow must own that responsibility explicitly.

### Behavior Drift

The biggest migration risk is not command parsing. It is accidentally changing the semantics of the current Node CLI during the Rust transition.

The safest approach is to treat the existing TypeScript CLI behavior as the compatibility oracle until parity is verified.
