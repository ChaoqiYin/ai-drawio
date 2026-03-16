# Next.js AI Session Shell Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the temporary shell entry with a statically exported Next.js frontend that starts on a local IndexedDB conversation list and opens draw.io in an iframe workspace route.

**Architecture:** Add a Next.js App Router application at the repository root, export it to `out/`, and point Tauri at the exported assets. Copy `webapp/` into `public/drawio/` during frontend builds so the session route can embed draw.io from `/drawio/index.html` while all conversation history remains browser-only in IndexedDB.

**Tech Stack:** Next.js App Router, React, static export, IndexedDB, Node build scripts, Tauri v2, Rust

---

### Task 1: Add frontend build plumbing

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `src-tauri/tauri.conf.json`
- Create: `next.config.mjs`
- Create: `scripts/prepare-drawio.mjs`

**Step 1: Write the failing test**

Add a Node test for a pure build helper that expects draw.io to be copied into the Next.js public directory layout.

**Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL because the helper script and Next build plumbing do not exist.

**Step 3: Write minimal implementation**

- add Next.js dependencies and scripts
- add static export config
- add `prepare-drawio` copy script
- point Tauri `frontendDist` at `../out`
- configure `beforeDevCommand` and `beforeBuildCommand` to run the frontend build

**Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS

**Step 5: Commit**

```bash
git add package.json .gitignore src-tauri/tauri.conf.json next.config.mjs scripts/prepare-drawio.mjs
git commit -m "feat: add next static build pipeline"
```

### Task 2: Add conversation domain helpers and IndexedDB storage

**Files:**
- Create: `lib/conversation-model.js`
- Create: `lib/conversation-store.js`
- Create: `tests/conversation-model.test.mjs`

**Step 1: Write the failing test**

Add Node tests for:

- creating a new conversation record
- sorting conversations by `updatedAt`
- building a safe summary preview from messages

**Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL because the conversation modules do not exist.

**Step 3: Write minimal implementation**

- implement pure conversation helpers in `lib/conversation-model.js`
- implement browser-only IndexedDB access in `lib/conversation-store.js`

**Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/conversation-model.js lib/conversation-store.js tests/conversation-model.test.mjs
git commit -m "feat: add local conversation storage"
```

### Task 3: Build the Next.js routes

**Files:**
- Create: `app/layout.js`
- Create: `app/page.js`
- Create: `app/session/page.js`
- Create: `app/globals.css`
- Create: `components/conversation-home.js`
- Create: `components/session-workspace.js`

**Step 1: Write the failing test**

Add a small Node test for any pure route-level helper used by the pages, such as deriving the session URL query.

**Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL because the route helpers do not exist.

**Step 3: Write minimal implementation**

- home route lists IndexedDB conversations and creates a new one when needed
- session route reads `id` from query params client-side
- session route embeds draw.io in an iframe
- session route exposes a shell helper object for iframe access

**Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS

**Step 5: Commit**

```bash
git add app components lib
git commit -m "feat: add ai conversation routes"
```

### Task 4: Rewire the Tauri bridge to the Next.js session shell

**Files:**
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/src/webview_api.rs`

**Step 1: Write the failing test**

Extend Rust tests so iframe-targeted scripts explicitly depend on the Next.js session helper contract.

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
Expected: FAIL because the old shell assumptions are no longer correct.

**Step 3: Write minimal implementation**

- remove the temporary render-path shell injection
- keep iframe-targeted script builders
- align the helper contract with the Next.js session page

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/src/main.rs src-tauri/src/webview_api.rs
git commit -m "feat: align tauri bridge with next session shell"
```

### Task 5: Verify static export and desktop startup

**Files:**
- Modify: `README.md`

**Step 1: Write the failing verification checklist**

Document expected outcomes:

- `npm run build:web` creates `out/`
- app starts on the conversation home route
- selecting a conversation opens the iframe workspace route

**Step 2: Run verification to confirm current gaps**

Run: `npm run build:web`
Run: `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Run: `npm run dev`

**Step 3: Write minimal documentation**

Update the README with:

- build pipeline overview
- route structure
- IndexedDB ownership
- draw.io static asset copy behavior

**Step 4: Run verification to confirm it passes**

Run: `npm run build:web`
Run: `node --test`
Run: `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Run: `npm run dev`
Expected: PASS

**Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document next ai session shell"
```
