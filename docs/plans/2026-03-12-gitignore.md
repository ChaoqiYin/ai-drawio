# Git Ignore Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a root `.gitignore` that ignores macOS, editor, Node.js, and Rust/Tauri local artifacts for this repository.

**Architecture:** Use a single root `.gitignore` so Git filtering stays centralized. Keep the rule set broad enough for daily development noise, but scoped to local artifacts and generated output rather than source content.

**Tech Stack:** Git, Node.js/npm, Rust, Tauri, macOS, VS Code-like editors

---

### Task 1: Add the repository ignore rules

**Files:**
- Create: `.gitignore`
- Reference: `package.json`
- Reference: `src-tauri/Cargo.toml`

**Step 1: Define the ignore groups**

Prepare grouped rules for:

- macOS metadata
- editor and IDE local files
- Node.js dependencies, logs, cache, and coverage
- Rust and Tauri build output
- local-only environment files

**Step 2: Write the `.gitignore` file**

Add the grouped rules with short comments so future updates stay maintainable.

**Step 3: Verify Git status**

Run: `git status --short`
Expected: `node_modules/` no longer appears as untracked, while source folders still appear normally.

**Step 4: Review rule safety**

Check that the file does not ignore:

- `webapp/`
- `src-tauri/src/`
- `docs/`
- `README.md`

**Step 5: Commit**

```bash
git add .gitignore docs/plans/2026-03-12-gitignore-design.md docs/plans/2026-03-12-gitignore.md
git commit -m "chore: add repository gitignore"
```
