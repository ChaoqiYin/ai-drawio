# Canvas History Cached SVG Preview Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist per-page SVG previews with every new canvas history entry so restore preview dialogs can read cached previews instantly instead of generating SVG on demand.

**Architecture:** Extend the canvas-history record shape to carry cached preview pages, update IndexedDB hydration and writes to preserve that payload, and move draw.io SVG export into the history-write path in the session workspace. The restore preview modal then becomes a pure consumer of `entry.previewPages`, with old previewless records shown as non-restorable.

**Tech Stack:** Next.js App Router, React, TypeScript, IndexedDB, Arco Design, draw.io iframe bridge, Node test runner

---

## File Structure

- Modify: `app/(internal)/_lib/conversation-model.ts`
  Add preview-page types and attach cached previews to `CanvasHistoryEntry`.

- Modify: `app/(internal)/_lib/conversation-store.ts`
  Persist `previewPages`, normalize missing previews on hydrate, and bump IndexedDB schema version safely.

- Modify: `app/(internal)/_lib/canvas-history-preview.ts`
  Reuse this helper as the normalization layer for cached preview payloads returned by draw.io and read from IndexedDB.

- Modify: `app/(internal)/_components/session-workspace.tsx`
  Move preview generation to history-write time and simplify the restore modal to consume cached previews only.

- Modify: `tests/conversation-model.test.ts`
  Cover the updated `CanvasHistoryEntry` constructor and compatibility defaults.

- Modify: `tests/conversation-store-api.test.ts`
  Cover `appendCanvasHistoryEntry(...)` with cached preview pages and legacy-record hydration behavior.

- Modify: `tests/session-workspace-document-history-source.test.ts`
  Assert history writes collect cached preview pages before persisting history.

- Modify: `tests/session-workspace-restore-preview-source.test.ts`
  Assert restore preview reads `entry.previewPages` and no longer depends on on-demand conversion calls.

---

## Chunk 1: Data Model And Store Compatibility

### Task 1: Add failing model and store tests for cached preview pages

**Files:**
- Modify: `tests/conversation-model.test.ts`
- Modify: `tests/conversation-store-api.test.ts`
- Modify: `app/(internal)/_lib/conversation-model.ts`
- Modify: `app/(internal)/_lib/conversation-store.ts`

- [ ] **Step 1: Add failing model assertions for preview pages**

Add assertions similar to:

```ts
assert.deepEqual(entry.previewPages, [
  {
    id: "page-1",
    name: "Overview",
    svgDataUri: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
  },
]);
```

- [ ] **Step 2: Add failing store assertions for preview persistence and legacy defaults**

Add assertions that verify:

- `appendCanvasHistoryEntry(...)` requires `previewPages`
- hydrated history records expose stored `previewPages`
- old records without `previewPages` hydrate to `[]`

- [ ] **Step 3: Run the focused model/store tests and confirm they fail**

Run: `npm run test:node -- tests/conversation-model.test.ts tests/conversation-store-api.test.ts`
Expected: FAIL because `CanvasHistoryEntry` and store helpers do not yet support cached preview pages.

- [ ] **Step 4: Extend the model types and constructors**

Required code changes in `app/(internal)/_lib/conversation-model.ts`:

- add `CanvasHistoryPreviewPage`
- add `previewPages` to `CanvasHistoryEntry`
- require `previewPages` in `createCanvasHistoryEntry(...)`

- [ ] **Step 5: Extend storage compatibility and writes**

Required code changes in `app/(internal)/_lib/conversation-store.ts`:

- bump `DATABASE_VERSION`
- normalize missing `previewPages` to `[]` for hydrated old records
- require and persist `previewPages` in `appendCanvasHistoryEntry(...)`
- keep existing indexes unchanged unless a new migration guard truly requires it

- [ ] **Step 6: Re-run the focused model/store tests and confirm they pass**

Run: `npm run test:node -- tests/conversation-model.test.ts tests/conversation-store-api.test.ts`
Expected: PASS.

## Chunk 2: Cached Preview Generation On History Write

### Task 2: Add failing session-workspace tests for write-time preview caching

**Files:**
- Modify: `tests/session-workspace-document-history-source.test.ts`
- Modify: `tests/session-workspace-restore-preview-source.test.ts`
- Modify: `app/(internal)/_components/session-workspace.tsx`
- Modify: `app/(internal)/_lib/canvas-history-preview.ts`

- [ ] **Step 1: Update the document-history source test to require cached preview generation before history writes**

Add assertions similar to:

```ts
assert.match(source, /buildSvgPreviewPagesForHistory/);
assert.match(source, /previewPages:/);

const buildPreviewIndex = source.indexOf("buildSvgPreviewPagesForHistory");
const appendHistoryIndex = source.indexOf("await appendCanvasHistoryEntry");
assert.ok(buildPreviewIndex < appendHistoryIndex);
```

- [ ] **Step 2: Update the restore-preview source test to require cached-preview reads**

Add assertions that verify:

- restore preview reads `restorePreviewEntry.previewPages` or equivalent cached state
- source no longer depends on `buildSvgPreviewPages(entry.xml)` in the modal-open path
- old previewless entries render a disabled confirmation path

- [ ] **Step 3: Run the focused session-workspace tests and confirm they fail**

Run: `npm run test:node -- tests/session-workspace-document-history-source.test.ts tests/session-workspace-restore-preview-source.test.ts`
Expected: FAIL because the workspace still generates previews on dialog open instead of during history writes.

- [ ] **Step 4: Move preview generation to the history-write path**

Required changes in `app/(internal)/_components/session-workspace.tsx`:

- add one helper that asks draw.io to export `previewPages` for a given XML snapshot
- call that helper immediately before every `appendCanvasHistoryEntry(...)`
- use the same path for both `ai-pre-apply` and `restore-pre-apply`
- treat preview generation failure as a hard failure for new history writes

- [ ] **Step 5: Simplify the restore preview dialog to consume cached previews only**

Required changes:

- open the dialog using `entry.previewPages`
- remove on-demand preview conversion from the modal-open path
- show a “暂无缓存预览” style state when `entry.previewPages.length === 0`
- keep `确认恢复` disabled when no cached preview exists

- [ ] **Step 6: Keep preview payload normalization focused**

Update `app/(internal)/_lib/canvas-history-preview.ts` so it normalizes:

- draw.io export payloads before history writes
- hydrated `previewPages` arrays before UI use

Do not move persistence or UI orchestration into this helper.

- [ ] **Step 7: Re-run the focused session-workspace tests and confirm they pass**

Run: `npm run test:node -- tests/session-workspace-document-history-source.test.ts tests/session-workspace-restore-preview-source.test.ts`
Expected: PASS.

## Chunk 3: Regression Verification

### Task 3: Run the full cached-preview verification set

**Files:**
- Test: `tests/conversation-model.test.ts`
- Test: `tests/conversation-store-api.test.ts`
- Test: `tests/canvas-history-preview.test.ts`
- Test: `tests/session-workspace-canvas-history-source.test.ts`
- Test: `tests/session-workspace-document-history-source.test.ts`
- Test: `tests/session-workspace-restore-preview-source.test.ts`

- [ ] **Step 1: Run the focused cached-preview suite**

Run: `npm run test:node -- tests/conversation-model.test.ts tests/conversation-store-api.test.ts tests/canvas-history-preview.test.ts tests/session-workspace-canvas-history-source.test.ts tests/session-workspace-document-history-source.test.ts tests/session-workspace-restore-preview-source.test.ts`
Expected: PASS.

- [ ] **Step 2: Run the full Node suite**

Run: `npm run test:node`
Expected: PASS.

- [ ] **Step 3: Run the frontend build check**

Run: `npm run build:web`
Expected: PASS, unless blocked by a pre-existing unrelated type/build failure.

- [ ] **Step 4: If build fails, separate pre-existing failures from regressions introduced by this work**

Report exact file and line for any unrelated blocker instead of papering over it.

- [ ] **Step 5: Re-run the changed verification commands after any final fixes**

Run:

- `npm run test:node`
- `npm run build:web`

Expected: clean pass, or a clearly documented unrelated blocker.
