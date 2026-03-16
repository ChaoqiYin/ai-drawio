# Tauri Next Dev HMR Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Tauri desktop development use Next.js HMR while preserving the current static export production build.

**Architecture:** Split Tauri web loading into two modes. In development, Tauri launches a long-running Next dev server and loads it through `devUrl`. In production, Tauri still builds and loads the exported `out` directory. Guard `next.config.mjs` so `output: "export"` is not applied during development.

**Tech Stack:** Tauri 2, Next.js 15, Node test runner, static export

---

### Task 1: Lock the expected development configuration with failing tests

**Files:**
- Create: `tests/dev-mode-config.test.ts`
- Modify: `tests/dev-mode-config.test.ts`

**Step 1: Write the failing test**

Read `package.json`, `src-tauri/tauri.conf.json`, and `next.config.mjs`, then assert:
- there is a dedicated Next dev script
- `beforeDevCommand` uses that dev script
- `devUrl` points to `http://127.0.0.1:3000`
- static export is conditional instead of unconditional

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/dev-mode-config.test.ts`
Expected: FAIL because the project still uses `build:web` for development and unconditional static export.

### Task 2: Implement the split dev/prod configuration

**Files:**
- Modify: `package.json`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `next.config.mjs`
- Test: `tests/dev-mode-config.test.ts`

**Step 1: Write the minimal implementation**

- add a `web:dev` script that starts `next dev` on `127.0.0.1:3000`
- switch Tauri `beforeDevCommand` to that script
- add `devUrl`
- keep `frontendDist` and `beforeBuildCommand` unchanged for production
- make `next.config.mjs` enable `output: "export"` only when not in development

**Step 2: Run the focused test**

Run: `node --experimental-strip-types --test tests/dev-mode-config.test.ts`
Expected: PASS

**Step 3: Run broader verification**

Run: `npm run test:node`
Expected: PASS

**Step 4: Run production build verification**

Run: `npm run build:web`
Expected: PASS

**Step 5: Run desktop Rust verification**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS
