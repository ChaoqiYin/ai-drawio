# Session Page HUD Dark Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the session detail page into a full-width dark HUD workspace with minimal side margins and a dominant draw.io panel.

**Architecture:** Keep the existing React route structure and data flow, but replace the session page layout and shared CSS tokens with a dark graphite design system. Focus on `components/session-workspace.js` and `app/globals.css`, with only minimal consistency touch-ups to shared utility classes.

**Tech Stack:** Next.js App Router, React, global CSS

---

### Task 1: Replace the shared color and spacing system

**Files:**
- Modify: `app/globals.css`

**Step 1: Write the failing check**

Identify the current warm palette and wide session padding as the wrong baseline.

**Step 2: Run verification to confirm the old style exists**

Run: `rg -n "#f3efe5|#8c5a00|padding: 28px|width: min\\(1240px, 100%\\)" app/globals.css`
Expected: PASS because the old warm layout tokens still exist.

**Step 3: Write minimal implementation**

- replace warm palette tokens with dark graphite tokens
- reduce desktop outer padding
- remove the narrow centered container effect for session pages

**Step 4: Run verification to confirm the old style is gone**

Run: `rg -n "#f3efe5|#8c5a00|padding: 28px|width: min\\(1240px, 100%\\)" app/globals.css`
Expected: FAIL

**Step 5: Commit**

```bash
git add app/globals.css
git commit -m "style: add dark hud design tokens"
```

### Task 2: Rebuild the session layout hierarchy

**Files:**
- Modify: `components/session-workspace.js`
- Modify: `app/globals.css`

**Step 1: Write the failing check**

Identify the current oversized hero-like section and card spacing as the wrong structure.

**Step 2: Run verification to confirm the old structure exists**

Run: `rg -n "workspace-card|workspace-copy|toolbar" components/session-workspace.js`
Expected: PASS

**Step 3: Write minimal implementation**

- compress the top section into a low-height control strip
- make the main grid denser and edge-oriented
- rebalance left sidebar and main iframe surface

**Step 4: Run verification to confirm the new structure is in place**

Run: `npm run build:web`
Expected: PASS

**Step 5: Commit**

```bash
git add components/session-workspace.js app/globals.css
git commit -m "style: rebuild session workspace layout"
```

### Task 3: Refine message cards and draw.io panel chrome

**Files:**
- Modify: `components/session-workspace.js`
- Modify: `app/globals.css`

**Step 1: Write the failing check**

Identify the current soft card treatment as visually inconsistent with the dark HUD goal.

**Step 2: Run verification to confirm the old treatment exists**

Run: `rg -n "border-radius: 18px|background: var\\(--surface\\)|drawio-header" app/globals.css`
Expected: PASS

**Step 3: Write minimal implementation**

- tighten message cards
- use darker panel layers and sharper chrome
- reduce iframe framing so the canvas dominates

**Step 4: Run verification to confirm the page still builds**

Run: `npm run build:web`
Expected: PASS

**Step 5: Commit**

```bash
git add components/session-workspace.js app/globals.css
git commit -m "style: refine session panel chrome"
```

### Task 4: Final validation

**Files:**
- Optional: `README.md`

**Step 1: Run final validation**

Run: `npm run build:web`
Run: `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
Expected: PASS

**Step 2: Run desktop startup validation**

Run: `source ~/.cargo/env && npm run dev`
Expected: PASS

**Step 3: Commit**

```bash
git add app/globals.css components/session-workspace.js
git commit -m "style: ship dark hud session page"
```
