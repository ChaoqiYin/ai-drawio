# Tailwind Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current custom global CSS system with Tailwind CSS while preserving the existing dark compact UI and draw.io workspace behavior.

**Architecture:** Add Tailwind and PostCSS as the new frontend styling pipeline, reduce the global stylesheet to a minimal Tailwind entry plus a few shared component classes, and move page-specific styling into the React components. Keep all application behavior unchanged and limit the migration to presentation concerns.

**Tech Stack:** Next.js static export, React, Tailwind CSS, PostCSS, Node.js, Tauri

---

### Task 1: Add the Tailwind pipeline

**Files:**
- Modify: `package.json`
- Create: `tailwind.config.mjs`
- Create: `postcss.config.mjs`

**Step 1: Write the failing setup check**

Run the current frontend build after referencing Tailwind directives in a temporary local diff.
The build should fail because Tailwind and PostCSS are not installed or configured yet.

**Step 2: Run test to verify it fails**

Run: `npm run build:web`
Expected: FAIL due to missing Tailwind/PostCSS setup.

**Step 3: Add the minimal Tailwind configuration**

Install and configure:

- `tailwindcss`
- `@tailwindcss/postcss`

Create a Tailwind config that scans:

- `./app/**/*.{js,jsx,mjs}`
- `./components/**/*.{js,jsx,mjs}`
- `./lib/**/*.{js,jsx,mjs}`

**Step 4: Run build to verify it passes**

Run: `npm run build:web`
Expected: PASS

### Task 2: Replace the global stylesheet entry

**Files:**
- Modify: `app/globals.css`

**Step 1: Write the failing visual baseline**

Capture the current rule groups to remove:

- page layout selectors
- card selectors
- button selectors
- session layout selectors

The new stylesheet should no longer depend on those selectors.

**Step 2: Replace the stylesheet**

Reduce `app/globals.css` to:

- Tailwind import
- root tokens
- body baseline
- a small `@layer components` block for reusable primitives

**Step 3: Run build to verify Tailwind classes compile**

Run: `npm run build:web`
Expected: PASS

### Task 3: Migrate the home page component to Tailwind

**Files:**
- Modify: `components/conversation-home.js`

**Step 1: Write the failing UI check**

Identify the old selector dependencies currently used by the home page:

- `.page-shell`
- `.page-frame`
- `.hero-card`
- `.content-card`
- `.conversation-card`

The component must stop using those classes after migration.

**Step 2: Rewrite the component classes**

Replace the selector names with Tailwind classes and the new shared primitives.
Keep:

- current dark theme
- compact spacing
- current text hierarchy

**Step 3: Run build to verify it passes**

Run: `npm run build:web`
Expected: PASS

### Task 4: Migrate the session page component to Tailwind

**Files:**
- Modify: `components/session-workspace.js`

**Step 1: Write the failing UI check**

Identify the old selector dependencies currently used by the session page:

- `.session-shell`
- `.session-frame`
- `.session-topbar`
- `.session-grid`
- `.session-sidebar`
- `.drawio-card--workspace`

The component must stop using those classes after migration.

**Step 2: Rewrite the component classes**

Replace selector-based styling with Tailwind class strings and the shared panel/button/chip primitives.
Preserve:

- full-width session layout
- narrow left information rail
- large dominant draw.io iframe area
- small dense copy and controls

**Step 3: Run build to verify it passes**

Run: `npm run build:web`
Expected: PASS

### Task 5: Clean up the app shell entry

**Files:**
- Modify: `app/layout.js`

**Step 1: Update root layout assumptions**

Ensure the root layout only imports the Tailwind-backed global entry and uses the correct document language metadata if needed.

**Step 2: Run frontend tests**

Run: `npm run test:node`
Expected: PASS

### Task 6: Run full verification

**Files:**
- No new files

**Step 1: Run the frontend build**

Run: `npm run build:web`
Expected: PASS

**Step 2: Run Node tests**

Run: `npm run test:node`
Expected: PASS

**Step 3: Run Rust tests**

Run: `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
Expected: PASS

**Step 4: Run Rust compile check**

Run: `source ~/.cargo/env && cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS
