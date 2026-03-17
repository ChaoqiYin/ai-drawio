# DMG CLI Install To PATH Design

**Date:** 2026-03-17

**Goal:** Ship the macOS desktop app as a DMG while still allowing users to install a short terminal command, `ai-drawio`, through the application itself after drag-and-drop installation.

## Context

The current repository already has a packaged Tauri CLI binary and a PKG-oriented installer flow:

- the desktop binary is named `ai-drawio`
- shell completion files are generated during build
- a PKG `postinstall` script creates `/usr/local/bin/ai-drawio`

That flow satisfies automatic PATH registration, but it depends on PKG installation. The requested product direction is closer to Pencil:

- distribute the app as a DMG
- let users drag the app into `/Applications`
- let users explicitly install the CLI command from inside the app

This changes the installation model, not the CLI contract itself.

## Product Decision

The packaged macOS application remains the canonical CLI binary.

The distribution model changes from:

- PKG with automatic postinstall PATH registration

To:

- DMG for application distribution
- in-app explicit installation of the system-level shell command

The short command remains:

- `ai-drawio`

The installation target remains system-level:

- `/usr/local/bin/ai-drawio`

The command should point to the current installed application binary:

- `/Applications/AI Drawio.app/Contents/MacOS/ai-drawio`

## User Experience

### Entry Flow

The app adds a Settings flow instead of a macOS menu-only action.

The user journey is:

1. Launch the app from `/Applications`
2. Open the home page
3. Click a `Settings` button on the home page
4. Navigate to `/settings`
5. Use a `CLI Integration` settings card
6. Click `Install ai-drawio into PATH`
7. Approve the macOS administrator prompt
8. Open a new terminal and run `ai-drawio status`

### Settings Page

The new settings page initially contains one focused feature area:

- `CLI Integration`

The card must display:

- install status: not installed / installed / installed but mismatched
- fixed command path: `/usr/local/bin/ai-drawio`
- resolved target path when available
- primary action:
  - `Install ai-drawio into PATH`
  - `Reinstall ai-drawio into PATH` when already installed
- concise explanation that administrator privileges are required

### Feedback

The UI must provide explicit result feedback after installation attempts.

Success messaging should include:

- the command path that was installed
- whether shell completion files were also installed
- a note to reopen the terminal or run `hash -r` if the current shell still cannot find the command
- a suggested verification command: `ai-drawio status`

Failure messaging should distinguish at least:

- administrator authorization cancelled
- install script execution failed
- command link installation failed
- completion installation failed while the main command succeeded

Main command installation success must be reported separately from completion installation success.

## Architecture

### Unit 1: Settings Route And Entry UI

Locations:

- Next.js home route UI
- new `/settings` route

Responsibility:

- expose a discoverable Settings entry from the home page
- render the CLI Integration card
- request install status on page load
- trigger the install action and present structured results

### Unit 2: Tauri Commands For CLI Integration

Location:

- new Rust module under `src-tauri/src/`
- command registration in `src-tauri/src/main.rs`

Responsibility:

- expose `get_cli_install_status`
- expose `install_cli_to_path`
- map internal status and execution results into structured data for the frontend

### Unit 3: App-Bundled Install Script

Location:

- bundled as an application resource inside the `.app`

Responsibility:

- create or replace `/usr/local/bin/ai-drawio`
- point it to the current app bundle binary
- install generated shell completions
- return clear exit failures for partial or full installation problems

This unit replaces the old PKG `postinstall` behavior.

### Unit 4: Completion Asset Bundling

Locations:

- build-time completion generation
- Tauri bundle resource configuration

Responsibility:

- keep generating `zsh`, `bash`, and `fish` completion files from the packaged command model
- bundle those files into the `.app` so the in-app installer can copy them into system locations

## Runtime Command Design

### `get_cli_install_status`

This command returns structured state for the settings page.

Required output fields:

- whether `/usr/local/bin/ai-drawio` exists
- whether it is a symlink
- resolved symlink target when readable
- whether the target matches the current app bundle binary
- whether bundled completion assets are present

Recommended status categories:

- `not_installed`
- `installed`
- `mismatched`
- `error`

### `install_cli_to_path`

This command performs the system-level installation flow.

Required behavior:

1. locate the current app bundle binary path
2. locate the bundled install script path
3. execute the script with macOS administrator authorization
4. collect exit status and stderr/stdout
5. return structured result data for the settings page

Required result fields:

- `ok`
- `commandInstalled`
- `completionInstalled`
- `commandPath`
- `targetPath`
- `message`
- `errorCode` when failed

## Privilege And Execution Model

The app does not write directly to `/usr/local/bin` from the unprivileged frontend.

Instead:

- the frontend invokes a Tauri command
- Rust locates the bundled install script
- Rust uses a macOS administrator-elevation flow to execute the script
- the script performs the system writes

The recommended first implementation uses AppleScript elevation:

- `osascript`
- `do shell script ... with administrator privileges`

This is acceptable for the current scope because it matches the explicit user action model and avoids introducing a privileged helper service.

## Install Script Responsibilities

The bundled install script must:

1. verify that the app binary exists
2. create `/usr/local/bin` if necessary
3. create or replace `/usr/local/bin/ai-drawio`
4. install completion files when they are bundled
5. use system-level completion destinations:
   - `/usr/local/share/zsh/site-functions/_ai-drawio`
   - `/usr/local/etc/bash_completion.d/ai-drawio`
   - `/usr/local/share/fish/vendor_completions.d/ai-drawio.fish`

The script must support repeat installation without requiring manual cleanup.

The script should treat completion copy failures as reportable but should not erase an otherwise successful command installation result.

## Packaging Decision

### DMG Distribution

The desktop build should produce a DMG suitable for drag-and-drop installation.

Expected user installation model:

- mount DMG
- drag `AI Drawio.app` into `/Applications`
- launch the app
- install the command from Settings

### Resource Bundling

The `.app` must contain:

- the packaged binary at `Contents/MacOS/ai-drawio`
- shell completion resources
- the bundled install script resource

The in-app installation flow must operate only on these bundled assets and the current running app location.

## Scope Boundaries

### In Scope

- DMG distribution as the main macOS install artifact
- home page Settings entry
- dedicated `/settings` route
- CLI Integration settings card
- status inspection for `/usr/local/bin/ai-drawio`
- explicit in-app system-level install action
- bundled shell completion installation

### Out Of Scope For This Iteration

- uninstall command flow
- automatic shell configuration repair
- LaunchAgent or privileged helper service
- automatic command installation during DMG drag-and-drop
- non-macOS install flows

## Error Handling

### User-Cancelled Elevation

If the administrator prompt is cancelled, the result should be a clean structured failure, not a crash and not a generic unknown error.

### App Path Variants

The installer should prefer `/Applications/AI Drawio.app` when that is the current app location, but it must work with the actual running bundle path rather than hardcoding `/Applications`.

### Partial Completion Failure

If the main command is installed successfully but completion files fail to install:

- report the command installation as successful
- report completion installation as failed
- keep the main symlink in place

## Testing Strategy

### Source-Level Tests

Add or update tests that verify:

- the new Settings entry exists in the home page source
- the `/settings` route exists
- the Rust integration commands are registered
- DMG-oriented resource bundling is configured
- the bundled install script path is present in the source/config

### Rust Tests

Add unit tests for:

- install status classification
- symlink target matching logic
- command result shaping
- script path resolution

Do not depend on real administrator prompts in automated tests.

### Manual Verification

Manual release verification must cover:

1. build the DMG
2. drag the app into `/Applications`
3. launch the app
4. open Settings
5. run `Install ai-drawio into PATH`
6. confirm `/usr/local/bin/ai-drawio` exists
7. open a new terminal
8. run `which ai-drawio`
9. run `ai-drawio status`

## Acceptance Criteria

The iteration is complete when all of the following are true:

- a DMG can be produced for the app
- the app can be installed by drag-and-drop
- the home page exposes a Settings entry
- the settings page can detect CLI install state
- the settings page can trigger a system-level install with administrator approval
- `/usr/local/bin/ai-drawio` points to the current installed app binary
- `ai-drawio status` works from a new terminal session after installation
- completion files are installed when available, or partial failure is reported accurately
