---
name: ai-drawio-cli
description: Use when a draw.io, diagram-editing, or canvas-document task should be executed through the installed `ai-drawio` CLI, especially when a task must target an explicit session id, create a new ready session, read live canvas XML, export assets, or update or restore a document from the desktop app.
---

# AI Drawio CLI

## Overview

Use this skill for draw.io work that must go through the installed `ai-drawio` CLI. Treat the live canvas as a delivery surface, not as proof of diagram quality.

## Core Rules

- Resolve the packaged `ai-drawio` executable to an absolute path before running any CLI command.
- Do not rely on PATH lookup or shell command discovery for `ai-drawio`.
- If the packaged app is installed in the default macOS location, prefer `/Applications/AI Drawio.app/Contents/MacOS/ai-drawio`.
- If the default location is unavailable, discover the actual app bundle path first and then keep using the resolved executable path consistently for the rest of the task.
- Use only the packaged `ai-drawio` executable, not development wrappers such as `npm run cli`.
- Do not execute any `ai-drawio` terminal command from this skill inside the default sandbox, including `status`, `session *`, and `canvas document.*`.
- Load `references/command-selection.md` when choosing which CLI command fits the task.
- Load `references/minimal-path-rule.md` when choosing the command path.
- Load `references/session-concurrency.md` when more than one session may be involved or command ordering matters.
- Launch the desktop app itself by executing the resolved packaged app path directly.
- Every `canvas document.apply` command must include a required prompt argument with the user request summary.
- Do not generate a `.drawio` file unless the user explicitly asked for file output or the XML payload is too large for a safe inline command.
- If this skill is paired with `drawio-diagramming`, load `references/paired-drawio-diagramming.md` for authoring rules.
- For multi-page authoring, apply page-specific authoring rules to each page before drafting or routing.
- For diagram authoring or layout correction, do not treat apply success, preview export, or a visible live canvas as completion. Load `references/connector-verification.md` for rendered inspection and final sign-off.
- Unless the user explicitly asks to close or quit the app, do not close the desktop app after any CLI command completes.

## Workflow

1. Pick the smallest command sequence that can satisfy both the user's requested output and the applicable completion checks.
2. Resolve the packaged executable path once and keep using that absolute path for the rest of the task.
3. Choose the session path: reuse the most recent session from the same AI conversation when continuing that work, require an explicit existing `session-id` when the task names one, or use `session create` when the user needs a new ready session.
4. If a command returns `APP_NOT_RUNNING`, or an intentional `status` check reports `running: false`, follow the status handling rule and then continue.
5. Parallelize only across different session IDs. Keep same-session commands strictly serial.
6. Read XML first only when the edit depends on the current document.
7. Keep XML in memory by default. Use `--xml-file` only when the XML already exists on disk or an oversized inline payload requires a temporary file.
8. Determine the completion checks before final inspection: use `drawio-diagramming` when it applies; otherwise use this skill's default completion checks.
9. If `drawio-diagramming` applies, load `references/paired-drawio-diagramming.md` before drafting XML or reusing existing layout.
10. For diagram authoring or layout-fix work, load `references/connector-verification.md`, export rendered output with `canvas document.preview` or `canvas document.svg` after apply, and inspect the result against the loaded checks.
11. If any applicable check fails or remains unchecked, repeat the edit-plus-apply-plus-inspect loop until everything passes or the user explicitly approves an exception.
12. After the full bounded task is complete, follow `references/session-close.md` when deciding whether the task session should be closed.

## Progressive Reference Loading

- Read only one detailed reference file at a time.
- If the command changes, load the next matching file. Do not preload unrelated files.
- Reference mapping:
  - `bundle executable discovery` -> `references/bundle-executable-discovery.md`
  - `command selection` -> `references/command-selection.md`
  - `connector verification` -> `references/connector-verification.md`
  - `command path selection` -> `references/minimal-path-rule.md`
  - `paired with drawio-diagramming` -> `references/paired-drawio-diagramming.md`
  - `session concurrency` -> `references/session-concurrency.md`
  - `ai-drawio status` -> `references/status.md`
  - `ai-drawio session create` -> `references/session-create.md`
  - `ai-drawio session list` -> `references/session-list.md`
  - `ai-drawio session open` -> `references/session-open.md`
  - `ai-drawio session close` -> `references/session-close.md`
  - `ai-drawio canvas document.get` -> `references/canvas-document-get.md`
  - `ai-drawio canvas document.svg` -> `references/canvas-document-svg.md`
  - `ai-drawio canvas document.preview` -> `references/canvas-document-preview.md`
  - `ai-drawio canvas document.apply` -> `references/canvas-document-apply.md`
  - `ai-drawio canvas document.restore` -> `references/canvas-document-restore.md`
