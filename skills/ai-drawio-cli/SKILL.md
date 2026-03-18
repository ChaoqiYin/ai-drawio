---
name: ai-drawio-cli
description: Use when the task involves draw.io, diagram editing, or similar drawing tools and should be handled through `ai-drawio`, including opening the app, checking status, creating conversations, listing or opening sessions, reading the current canvas XML, exporting SVG pages, applying XML updates, or restoring a document. Use when the agent should prefer the shortest valid command and avoid optional `--` flags unless the user explicitly requires them.
---

# AI Drawio CLI

## Overview

Use this skill when a draw.io, diagram editing, or similar drawing-tool task should be handled through `ai-drawio`. Prefer the smallest command that satisfies the request, and do not add optional `--` flags unless the user explicitly asks for the extra targeting, output, or metadata behavior.

## Command Policy

- Use only `ai-drawio`, not development wrappers such as `npm run cli`.
- Prefer automatic session resolution for canvas commands when the user does not name a specific session.
- Add `--session`, `--session-title`, `--output-file`, `--base-version`, or `--prompt` only when the task truly requires them.
- Prefer `--xml-file` for `canvas document.apply` and `canvas document.restore`.
- Use `--xml-stdin` only when the XML is explicitly being piped through stdin.
- Treat mutually exclusive flags as hard constraints. Do not combine `--session` with `--session-title`, or `--id` with `--title`.

## Workflow

1. Identify the smallest command that can satisfy the request.
2. Check whether the user explicitly named a session id, session title, output path, base version, prompt text, or stdin-based XML input.
3. Omit every optional `--` flag that is not required by that request.
4. If command syntax or output behavior is relevant, read `references/cli-commands.md`.

## Reference

Read `references/cli-commands.md` for:

- the supported command surface
- flag selection rules
- minimal command examples
- cases where the repository implementation differs from older README examples
