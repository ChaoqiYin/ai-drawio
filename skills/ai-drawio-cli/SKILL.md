---
name: ai-drawio-cli
description: Use when a draw.io, diagram-editing, or canvas-document task should be executed through the installed `ai-drawio` CLI, especially when a task must target an explicit session id, create a new ready session, read live canvas XML, export assets, or update or restore a document from the desktop app.
---

# AI Drawio CLI

## Overview

Use this skill for draw.io work that must go through the installed `ai-drawio` CLI. Treat live canvas updates as completion unless the user explicitly wants file-only output.

## Core Rules

- Use only `ai-drawio`, not development wrappers such as `npm run cli`.
- Do not execute any `ai-drawio` terminal command from this skill inside the default sandbox, including `open`, `status`, `session *`, and `canvas document.*`.
- For existing sessions, use the exact `session-id` as a required positional argument.
- Use `session create` when the user needs a new ready session.
- Every `canvas document.apply` command must include a required prompt argument with the user request summary.
- Do not generate a `.drawio` file unless the user explicitly asked for file output or the XML payload is too large for a safe inline command.
- `ai-drawio status` is detection-only and must never auto-launch the desktop app.
- If a command returns `APP_NOT_RUNNING`, or `status` returns `running: false`, run `ai-drawio open` yourself outside the sandbox and then continue with the original task.
- Unless the user explicitly asks to close or quit the app, do not close the desktop app after any CLI command completes.

## Session Concurrency

- Commands for different session IDs may run in parallel.
- Commands that target the same session ID must run strictly serially.
- Treat `session open <session-id>` and every `canvas document.* <session-id>` command as work that locks that session until the command completes.
- `session create` is serial for the new session it returns. After it completes, use the returned session ID for any later locking decisions.
- Do not use a global one-command-at-a-time rule when separate session IDs are available.

## Command Selection

- `open`: only when you need to launch the desktop app itself.
- `status`: only when you need to know whether the desktop app is running.
- `session status <session-id>`: only when you need to know whether one session is ready.
- `session create`: only when the user explicitly needs a new ready session.
- `session list`: only when the user explicitly needs persisted session IDs.
- `session open <session-id>`: only when the user explicitly wants a session opened or when later session-targeted work must ensure readiness first.
- `canvas document.get <session-id>`: default entry point when you need the current XML first.
- `canvas document.svg <session-id>`: direct SVG export or inspection.
- `canvas document.preview <session-id>`: PNG preview export.
- `canvas document.apply <session-id> <prompt>`: normal forward edits.
- `canvas document.restore <session-id>`: rollback or revert only.

## Minimal Path Rule

- Default to one `ai-drawio` command, not two.
- Do not run `ai-drawio status` as a routine pre-check before every command.
- Do not run `session list` unless the user explicitly needs the persisted session list.
- If the user asks to draw in draw.io, default to `canvas document.apply`, not file generation.
- If XML authoring is needed before execution, treat that XML as an intermediate artifact and continue to the apply command.
- For canvas reads, use `canvas document.get <session-id>`.
- For SVG export, use `canvas document.svg <session-id>`.
- For PNG export, use `canvas document.preview <session-id>`.
- For forward edits, use `canvas document.apply <session-id> <prompt>`.
- For rollback, use `canvas document.restore <session-id>`.
- Only use a two-step path such as `canvas document.get <session-id>` followed by `canvas document.apply <session-id> <prompt>` when the task truly needs the current XML first.
- If one request needs multiple diagrams rendered together, prefer one XML document containing multiple diagrams or pages over several separate XML payloads.

## Workflow

1. Pick the smallest command that can satisfy the request.
2. If the task targets an existing session, require the explicit `session-id`.
3. If the user needs a new workspace, use `session create`, capture the returned `sessionId`, and use that ID afterward.
4. If the chosen command returns `APP_NOT_RUNNING`, or an intentional `status` check reports `running: false`, run `ai-drawio open` outside the sandbox and then continue with the original task.
5. Parallelize only across different session IDs.
6. Keep same-session commands strictly serial.
7. Read XML first only when the edit actually depends on the current document.
8. If the user asked to draw or render in draw.io, use `canvas document.apply <session-id> <prompt>` unless the user explicitly requested file-only output.
9. Keep XML in memory by default. Only use `--xml-file` when the XML already exists on disk or an oversized inline payload requires a temporary file.
10. Read only the single matching command reference file when exact command syntax or argument shape matters.

## Progressive Reference Loading

- Read only one detailed reference file at a time.
- If the command changes, load the next matching file. Do not preload unrelated files.
- Reference mapping:
  - `ai-drawio open` -> `references/open.md`
  - `ai-drawio status` -> `references/status.md`
  - `ai-drawio session create` -> `references/session-create.md`
  - `ai-drawio session list` -> `references/session-list.md`
  - `ai-drawio session open` -> `references/session-open.md`
  - `ai-drawio canvas document.get` -> `references/canvas-document-get.md`
  - `ai-drawio canvas document.svg` -> `references/canvas-document-svg.md`
  - `ai-drawio canvas document.preview` -> `references/canvas-document-preview.md`
  - `ai-drawio canvas document.apply` -> `references/canvas-document-apply.md`
  - `ai-drawio canvas document.restore` -> `references/canvas-document-restore.md`
