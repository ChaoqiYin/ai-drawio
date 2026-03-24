# Page2 Left-To-Right Layout Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-layout the live draw.io `Page 2` into a clearer left-to-right module-oriented structure without changing the page structure.

**Architecture:** Read the current live document, isolate `Page 2`, classify the existing nodes into a visual backbone and attached branches, then apply a geometry-only update back to the same document. Validate the result with a page-level preview export to confirm the new routing and spacing are readable.

**Tech Stack:** draw.io mxGraph XML, packaged `ai-drawio` CLI

---

## Chunk 1: Live Document Access

### Task 1: Resolve the active session and inspect the current document

**Files:**
- Read: `docs/superpowers/specs/2026-03-24-page2-left-to-right-layout-design.md`

- [ ] **Step 1: Resolve the packaged `ai-drawio` executable**

Run: `test -x "/Applications/AI Drawio.app/Contents/MacOS/ai-drawio"`
Expected: exit success

- [ ] **Step 2: Find the active session that contains the current drawing**

Run: `"/Applications/AI Drawio.app/Contents/MacOS/ai-drawio" session list`
Expected: one or more session records

- [ ] **Step 3: Export the current live document XML**

Run: `"/Applications/AI Drawio.app/Contents/MacOS/ai-drawio" canvas document.get <session-id>`
Expected: full mxfile XML containing `Page 2`

## Chunk 2: Page2 Geometry Update

### Task 2: Re-layout `Page 2` with geometry-only changes

**Files:**
- Read: `docs/superpowers/specs/2026-03-24-page2-left-to-right-layout-design.md`

- [ ] **Step 1: Identify the `Page 2` diagram and its current vertices and edges**

Expected: one target diagram page with reusable existing ids

- [ ] **Step 2: Reassign node coordinates to a left-to-right backbone with upper and lower branches**

Expected: vertex positions change, ids and labels stay unchanged

- [ ] **Step 3: Preserve or refine connector waypoints only as needed to support the new channels**

Expected: fewer crossings and more consistent orthogonal travel

- [ ] **Step 4: Apply the updated full document back to the same session**

Run: `"/Applications/AI Drawio.app/Contents/MacOS/ai-drawio" canvas document.apply <session-id> "Re-layout Page 2 into a clearer left-to-right module layout" --xml-file /tmp/page2-layout.drawio`
Expected: apply succeeds

## Chunk 3: Validation

### Task 3: Export a preview and confirm the second page readability

**Files:**
- Read: `docs/superpowers/specs/2026-03-24-page2-left-to-right-layout-design.md`

- [ ] **Step 1: Export a PNG preview for page 2**

Run: `"/Applications/AI Drawio.app/Contents/MacOS/ai-drawio" canvas document.preview <session-id> /tmp/page2-preview --page 2`
Expected: one preview image for `Page 2`

- [ ] **Step 2: Inspect the preview result for crossings and spacing**

Expected: one obvious left-to-right backbone and cleaner connector channels
