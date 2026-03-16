# Git Ignore Design

**Date:** 2026-03-12

## Goal

Add a root `.gitignore` that keeps the repository clean for local development on macOS with VS Code-like editors, while accounting for the current Node.js and Rust/Tauri stack.

## Scope

- Ignore macOS metadata files and resource forks.
- Ignore editor and IDE local state for VS Code-like tools and common alternatives.
- Ignore Node.js dependency folders, logs, caches, and coverage output.
- Ignore Rust and Tauri build artifacts.
- Ignore local-only environment files.

## Non-Goals

- Do not ignore application source files or bundled web assets.
- Do not ignore shared documentation or repository configuration by default.
- Do not introduce tool-specific rules that would likely hide files intended for version control.

## Recommended Rules

1. Add platform rules for `.DS_Store`, `._*`, and related Finder metadata.
2. Add editor rules for `.vscode/`, `.idea/`, `.history/`, swap files, and backup files.
3. Add Node.js rules for `node_modules/`, package-manager logs, cache folders, coverage output, and `*.tsbuildinfo`.
4. Add Rust/Tauri rules for `target/` and `src-tauri/target/`.
5. Add local environment rules for `.env` variants, while preserving example env files.

## Validation

- Run `git status --short` before and after the change.
- Confirm that `node_modules/` is no longer shown as untracked.
- Confirm that application files such as `webapp/`, `src-tauri/`, and docs remain visible to Git.
