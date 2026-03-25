---
name: ai-drawio-cli
description: Use when a draw.io, diagram-editing, or canvas-document task should be executed through the installed `ai-drawio` CLI, especially when a task must target an explicit session id, create a new ready session, read live canvas XML, export assets, or update or restore a document from the desktop app.
---

# AI Drawio CLI

## Overview

Use this skill for draw.io work that must go through the installed `ai-drawio` CLI.

## Core Rules

- All commands executed via `$AI_DRAWIO_BIN` must run with elevated privileges in a non-sandboxed terminal.
- Do not generate a `.drawio` file unless the user explicitly asked for file output or the XML payload is too large for a safe inline command.
- Unless the user explicitly asks to close or quit the app, do not close the desktop app after any CLI command completes.

## SOP (Standard Operating Procedure)

Execute phases strictly in order: Phase 1 → 2 → 3 → 4 → 5. Within each phase, follow steps sequentially.

---

### Phase 1 — Resolve Executable

1.1. Load `references/bundle-executable-discovery.md`.
1.2. **IF** `/Applications/AI Drawio.app/Contents/MacOS/ai-drawio` exists → store as `$AI_DRAWIO_BIN`.
1.3. **ELSE** → discover via `mdfind` per the loaded reference → store first valid result as `$AI_DRAWIO_BIN`.

---

### Phase 2 — Session Routing

2.1. **IF** multiple sessions may be involved → load `references/session-concurrency.md`.
2.2. Determine session-id (first match wins):
  - Reuse the session from the current AI conversation, **OR**
  - Use the user-specified session-id (load `references/session-open.md` if readiness check is needed), **OR**
  - Run `session create` for a new session (load `references/session-create.md`).

---

### Phase 3 — Plan & Execute Commands

#### 3A — Plan

3A.1. Load `references/command-selection.md` and `references/minimal-path-rule.md`.
3A.2. **IF** task is diagram authoring or layout correction **AND** `drawio-diagramming` skill is available → load `references/paired-drawio-diagramming.md` → build a per-page authoring checklist from its Priority Order.
3A.3. **IF** the edit depends on existing document content → plan `canvas document.get` as a prerequisite.
3A.4. Select the minimal command sequence that satisfies both the task and all applicable completion checks.

#### 3B — Execute

3B.1. Before running any command, load its matching reference from the **Progressive Reference Loading** mapping.
3B.2. **IF** 3A.3 applies → run `canvas document.get <session-id>`. On `APP_NOT_RUNNING` → **GOTO E1**.
3B.3. Run the target command. On `APP_NOT_RUNNING` → **GOTO E1**.
3B.4. On success:
  - **IF** diagram authoring or layout correction → proceed to Phase 4.
  - **ELSE** → skip to Phase 5.

---

### Phase 4 — Verification Loop (diagram authoring / layout correction only)

4.1. Load `references/connector-verification.md`. **IF** `drawio-diagramming` is paired → use its stricter requirements as the verification standard.
4.2. Export rendered output via `canvas document.preview` or `canvas document.svg`.
4.3. Run per-page inspection checks as defined in the loaded verification reference. Escalate to SVG path or XML geometry inspection if PNG is insufficient.
4.4. **Verdict** (per page):
  - All checks pass → present per-page checklist in the final response → proceed to Phase 5.
  - Any check fails or is unchecked → return to **3B.1**, re-apply, then re-enter Phase 4.
  - User explicitly approves exception → mark exception → proceed to Phase 5.

---

### Phase 5 — Cleanup

5.1. Load `references/session-close.md`.
5.2. **IF** app is in tray state **AND** user did not request keeping the session → run `session close <session-id>`. **ELSE** → skip.

---

### Exception Subroutine

#### E1 — APP_NOT_RUNNING Recovery

Triggered when any command returns `APP_NOT_RUNNING` or a `status` check reports `running: false`.

E1.1. Load `references/status.md`.
E1.2. Launch the desktop app by executing the resolved packaged app path directly.
E1.3. After the app is ready, **return to the originating step** and retry the command.

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
