---
name: ai-drawio-cli
description: Use when a draw.io, diagram-editing, or canvas-document task should be executed through the installed `ai-drawio` CLI, including resolving or reusing sessions, reading canvas XML, exporting SVG, or updating or rolling back a document from the desktop app.
---

# AI Drawio CLI

## Overview

Use this skill for draw.io work that should go through the installed `ai-drawio` CLI. Choose the smallest valid command path and load only the one command reference file you need next.

## Hard Rule

`ai-drawio` commands must be executed strictly one at a time.

## Intent Mapping

- If the user asks to draw, render, or put a diagram into draw.io, treat the completed outcome as updating the live canvas through `ai-drawio canvas document.apply`.
- Do not treat generating a `.drawio` file or raw XML as completion unless the user explicitly asks for file-only output or raw XML.
- If XML authoring is needed before execution, treat that XML as an intermediate artifact and continue to the apply command.

## Command Policy

- Use only `ai-drawio`, not development wrappers such as `npm run cli`.
- Run every terminal command from this skill with escalated permissions. Do not execute `ai-drawio` commands inside the default sandbox.
- Every `canvas document.apply` command must include a required prompt argument with the user request summary.
- Treat `ai-drawio` as a single-user desktop control surface.
- `ai-drawio status` is detection-only and must never auto-launch the desktop app.
- If the app is not running, the CLI returns state or `APP_NOT_RUNNING`. The chat layer owns the user-facing reminder to open the desktop window manually.
- Unless the user explicitly asks to close or quit the app, do not close the desktop app after any CLI command completes.
- If you need multiple `ai-drawio` operations, execute them serially and do not start the next command until the previous command has fully completed.
- Do not reason about specific flags in the main skill flow. Read only the single command reference file that matches the command you are about to run.

## Minimal Path Rule

- Default to one `ai-drawio` command, not two.
- Do not run `ai-drawio status` as a routine pre-check before every command.
- Do not run `session list` or `session open` unless the user explicitly needs those results.
- If one request needs multiple diagrams rendered together, default to one XML document containing multiple diagrams or pages.
- Only split the work into multiple XML documents when the user explicitly asks for separate XML outputs.
- For canvas reads, use `canvas document.get` directly.
- For SVG export, use `canvas document.svg` directly.
- For forward edits, use `canvas document.apply` directly.
- For rollback, use `canvas document.restore` directly.
- When the user asks to draw in draw.io, default to `canvas document.apply`, not file generation.
- Do not generate a `.drawio` file unless the user explicitly asked for file output or the XML payload is too large for a safe inline command.
- Only use a two-step path such as `canvas document.get` followed by `canvas document.apply` when the task truly needs the current XML first.

## Command Selection

- `status`: only when you need to know whether the desktop app is already running.
- `conversation create`: only when the user explicitly wants a new local conversation.
- `session list`: only when the user explicitly needs the persisted session list.
- `session open`: only when the user explicitly wants one persisted session opened.
- `canvas document.get`: default entry point when you need current XML first.
- `canvas document.svg`: direct SVG export or inspection.
- `canvas document.apply`: normal forward edits.
- `canvas document.restore`: rollback or revert only.

## Progressive Reference Loading

- Do not read a combined command handbook.
- Read only one detailed reference file at a time, based on the command you are about to run.
- If the task changes commands, then load the next matching file. Do not preload unrelated command files.
- Reference mapping:
  - `ai-drawio status` -> `references/status.md`
  - `ai-drawio conversation create` -> `references/conversation-create.md`
  - `ai-drawio session list` -> `references/session-list.md`
  - `ai-drawio session open` -> `references/session-open.md`
  - `ai-drawio canvas document.get` -> `references/canvas-document-get.md`
  - `ai-drawio canvas document.svg` -> `references/canvas-document-svg.md`
  - `ai-drawio canvas document.apply` -> `references/canvas-document-apply.md`
  - `ai-drawio canvas document.restore` -> `references/canvas-document-restore.md`

## Workflow

1. Identify the smallest command that can satisfy the request.
2. Execute one command if one command can satisfy the task.
3. If the task needs multiple `ai-drawio` commands, plan a strictly serial sequence and wait for each command to finish before starting the next one.
4. For canvas edits that need the current document first, call `canvas document.get` before constructing the updated XML. Otherwise do not add this read step.
5. If one request needs multiple diagrams rendered together, build one XML document with multiple diagrams or pages unless the user explicitly asked for separate XML outputs.
6. If the user asked to draw or render in draw.io, use `canvas document.apply` as the default completion path unless the user explicitly requested file-only output.
7. Always include the required prompt argument when running `canvas document.apply`.
8. Keep XML in memory by default. Only use `--xml-file` when the XML already exists on disk or an oversized inline payload requires a temporary file.
9. Use `canvas document.apply` for forward changes and `canvas document.restore` only for rollback-style changes.
10. If a command returns `APP_NOT_RUNNING`, or `status` returns `running: false`, stop and tell the user to open the desktop window manually before retrying. Do not fall back to handing back a `.drawio` file as a substitute completion state.
11. Read only the single matching command reference file when exact command syntax or argument shape matters.

## Reference

Use the command-specific files under `references/` for:

- exact flag shapes
- minimal command examples
- command-specific output behavior
