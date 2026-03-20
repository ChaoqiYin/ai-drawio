# Rust CLI Dispatch Without Tauri Plugin Design

## Goal

Remove the `tauri-plugin-cli` dependency and the `plugins.cli` bundle configuration while keeping the existing packaged `ai-drawio` command surface, JSON response behavior, DMG packaging flow, shell completion generation, and PATH installation behavior unchanged.

## Scope

In scope:

- remove `tauri-plugin-cli` from the Rust crate and Tauri config
- keep the current single packaged binary structure
- continue to parse and dispatch CLI commands in Rust before launching the GUI
- preserve the current top-level and nested command names, positional arguments, options, defaults, and output structure
- preserve macOS DMG packaging and the `/usr/local/bin/ai-drawio` install flow
- update tests and docs to validate the new no-plugin architecture

Out of scope:

- introducing a second dedicated CLI binary
- changing the packaged app name or main binary name
- changing the control protocol or session runtime behavior
- changing CLI JSON payload formats
- changing the shell completion output paths or install destinations

## Current State

The current project already contains most of the required Rust-side command infrastructure:

- `src-tauri/src/cli_schema.rs` defines the clap command tree and help text
- `src-tauri/src/packaged_cli.rs` parses arguments, maps them to internal commands, and executes them
- `src-tauri/build.rs` generates shell completions from the clap schema
- `src-tauri/src/main.rs` checks `packaged_cli::maybe_run_from_env()` before booting the GUI

The remaining plugin-specific pieces are:

- `tauri-plugin-cli` in `src-tauri/Cargo.toml`
- `.plugin(tauri_plugin_cli::init())` in `src-tauri/src/main.rs`
- the `plugins.cli` block in `src-tauri/tauri.conf.json`
- source tests that assert plugin-based CLI configuration

This means the migration is architectural cleanup rather than a complete CLI rewrite.

## Proposed Architecture

Keep the current single packaged binary model and make Rust the only source of CLI dispatch.

Startup flow:

1. The packaged binary starts.
2. `main.rs` reads process arguments.
3. `packaged_cli::maybe_run_from_env()` decides whether the invocation is a CLI command or a normal GUI launch.
4. If it is a CLI command:
   - parse arguments with clap using `cli_schema::build_cli_command()`
   - dispatch the command through the existing Rust command execution path
   - print the existing structured JSON response
   - exit with the current success or failure exit code behavior
5. If no CLI command is provided:
   - continue normal Tauri desktop startup

The Tauri runtime will no longer participate in command-line parsing. It remains responsible only for GUI runtime setup, command invocation from the frontend, tray behavior, and control server startup.

## Module Responsibilities

### `src-tauri/src/cli_schema.rs`

Keep this file as the single source of truth for:

- top-level CLI command names
- subcommand structure
- positional arguments
- named options
- defaults
- help text
- completion generation inputs

This module remains clap-only and should not depend on Tauri plugin configuration.

### `src-tauri/src/packaged_cli.rs`

Keep this file as the packaged CLI runtime and Rust command dispatcher.

Responsibilities:

- detect whether the current process invocation is a CLI execution or a GUI launch
- parse raw `std::env::args()` using the clap schema
- map parsed clap matches into internal command enums
- execute existing command logic using the current control protocol and runtime orchestration
- preserve the current structured JSON success and error output behavior

This module becomes the only runtime command-dispatch layer for packaged terminal usage.

### `src-tauri/src/main.rs`

Simplify the startup boundary:

- call `packaged_cli::maybe_run_from_env()` first
- if it returns an exit code, terminate the process immediately
- otherwise initialize the Tauri GUI application

This file should no longer register `tauri_plugin_cli::init()`.

### `src-tauri/build.rs`

Keep completion generation unchanged. It should continue to build completions directly from `cli_schema::build_cli_command()`.

This preserves parity between runtime parsing and generated shell completions.

### `src-tauri/src/cli_path_install.rs`

Keep the PATH install and status logic unchanged except for any incidental references that assume the plugin exists. The install contract remains:

- app bundle contains the `ai-drawio` executable
- the in-app installer creates or replaces `/usr/local/bin/ai-drawio`
- completion files are installed from `Contents/SharedSupport/cli-completions`

## Configuration Changes

### Cargo

Remove:

- `tauri-plugin-cli` from `src-tauri/Cargo.toml`

Keep:

- `clap`
- `clap_complete`
- `tauri`

### Tauri Config

Remove the entire `plugins.cli` block from `src-tauri/tauri.conf.json`.

Keep:

- `mainBinaryName`
- existing bundle resource settings
- existing bundled completion file mappings
- existing macOS DMG target configuration

The binary name and bundle layout must remain unchanged so the PATH installer still points at the same executable location inside the packaged app.

## Behavioral Compatibility Requirements

The migration must not change any of the following:

- `ai-drawio open`
- `ai-drawio open --mode window`
- `ai-drawio status`
- `ai-drawio conversation create`
- `ai-drawio session create`
- `ai-drawio session list`
- `ai-drawio session open <session-id>`
- `ai-drawio canvas document.get <session-id> [--output-file <path>]`
- `ai-drawio canvas document.svg <session-id> [--output-file <path>]`
- `ai-drawio canvas document.preview <session-id> <output-directory> [--page <page-number>]`
- `ai-drawio canvas document.apply <session-id> <prompt> ...`
- `ai-drawio canvas document.restore <session-id> ...`

Also preserve:

- JSON response field shapes
- success and failure exit code behavior
- current behavior when the desktop app is not running
- current behavior for `open` as the command that can launch the app directly
- current help and completion behavior derived from clap

## Error Handling

The new architecture must keep these failure classes stable:

- clap usage and validation failures still surface as structured CLI errors
- control socket connection failures still return the current structured non-open command failure response
- file and stdin argument validation in apply and restore flows remain unchanged
- GUI startup is unaffected when no CLI command is provided

A key migration guardrail is to avoid falling back to unstructured plugin-specific or OS-specific error output.

## Testing Strategy

### Rust tests

Add or keep focused tests for:

- `packaged_cli::maybe_run_from_env()` returning `None` for normal GUI launches
- parsed command mapping for all existing command families
- exit code behavior for success and failure cases
- clap validation behavior for required arguments and mutually exclusive XML input modes

### Node source tests

Replace plugin-assertion tests with no-plugin architecture assertions.

Required source-level checks:

- `src-tauri/Cargo.toml` no longer contains `tauri-plugin-cli`
- `src-tauri/tauri.conf.json` no longer contains `plugins.cli`
- `src-tauri/src/main.rs` still checks `packaged_cli::maybe_run_from_env()` before GUI startup
- `src-tauri/src/main.rs` no longer calls `tauri_plugin_cli::init()`
- `src-tauri/build.rs` still generates completions from `cli_schema`
- README examples still describe the same command surface

### Packaging regressions

Keep source-level checks that ensure:

- the packaged macOS binary remains named `ai-drawio`
- completion assets are still bundled under `SharedSupport/cli-completions`
- the PATH install flow still targets `/usr/local/bin/ai-drawio`

## Implementation Outline

1. Remove plugin registration from `main.rs`.
2. Remove `tauri-plugin-cli` from `Cargo.toml`.
3. Remove `plugins.cli` from `tauri.conf.json`.
4. Keep `cli_schema.rs` as the clap source of truth.
5. Adjust `packaged_cli.rs` only where needed to remove any remaining plugin assumptions while preserving behavior.
6. Rewrite source tests to assert the no-plugin architecture.
7. Verify help generation, completions, Node tests, and Rust compile behavior.

## Risks

### Risk: accidental command surface drift

If plugin config is removed without locking behavior to clap and tests, commands can silently diverge from README examples or existing automation expectations.

Mitigation:

- treat `cli_schema.rs` as the only command definition source
- add source tests that validate no-plugin behavior and retained command examples

### Risk: GUI startup regression

If CLI detection becomes too eager, normal app launches could exit early instead of starting the desktop shell.

Mitigation:

- keep explicit `None` semantics for the no-argument path
- add tests for empty-argument behavior

### Risk: PATH installation regression

If the main binary path or bundle layout changes during cleanup, the installer can create a broken `/usr/local/bin/ai-drawio` link.

Mitigation:

- keep `mainBinaryName` unchanged
- do not change bundled completion paths
- preserve the installer contract and source-level assertions

## Recommendation

Implement the migration as a minimal architectural cleanup:

- keep the current single packaged binary
- keep clap as the command schema source
- keep `packaged_cli.rs` as the runtime dispatcher
- remove Tauri CLI plugin registration and config entirely

This approach matches the approved requirement: move command dispatch fully into Rust without changing the external CLI interface or the existing packaging and installation flow.
