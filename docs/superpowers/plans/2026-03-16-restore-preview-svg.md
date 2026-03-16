# Restore Preview SVG Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a preview-first confirmation modal before restoring a canvas history snapshot, using per-page SVG previews and explicit confirmation before the existing restore path runs.

**Architecture:** Keep restore execution in the existing session workspace component, but split the new behavior into two clear units: a pure snapshot-preview helper that converts stored draw.io XML into page-level SVG preview models, and a modal orchestration layer in the session workspace that prepares preview state, renders tabs, and only calls the existing restore handler after confirmation. This preserves current IndexedDB history semantics and keeps risk localized to the restore UI flow.

**Tech Stack:** Next.js App Router, React, TypeScript, Arco Design, browser DOM APIs, Node test runner

---

## File Structure

- Modify: `app/(internal)/_components/session-workspace.tsx`
  Own the restore-preview modal state, preview loading/error handling, page-tab selection, and final confirmed restore action.

- Create: `app/(internal)/_lib/canvas-history-preview.ts`
  Provide a pure helper that parses snapshot XML and returns `[{ id, name, svgMarkup }]` preview records for each diagram page.

- Create: `tests/canvas-history-preview.test.ts`
  Cover multi-page parsing, fallback page labels, and malformed XML failure for the new helper.

- Modify: `tests/session-workspace-canvas-history-source.test.ts`
  Assert the sidebar restore flow now opens preview state and renders modal-related markers instead of restoring immediately from the button click.

- Create: `tests/session-workspace-restore-preview-source.test.ts`
  Assert the session workspace source contains the modal, page tabs, preview-error/loading handling, and explicit confirm/cancel actions.

---

## Chunk 1: Snapshot Preview Helper

### Task 1: Add failing tests for XML-to-SVG preview generation

**Files:**
- Create: `tests/canvas-history-preview.test.ts`
- Create: `app/(internal)/_lib/canvas-history-preview.ts`

- [ ] **Step 1: Write the failing helper tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { buildCanvasHistoryPreviewPages } from "../app/(internal)/_lib/canvas-history-preview.ts";

test("buildCanvasHistoryPreviewPages returns one preview per diagram page", () => {
  const xml = `<mxfile compressed="false">
    <diagram id="page-1" name="First"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram>
    <diagram id="page-2"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram>
  </mxfile>`;

  const pages = buildCanvasHistoryPreviewPages(xml);

  assert.equal(pages.length, 2);
  assert.equal(pages[0].name, "First");
  assert.equal(pages[1].name, "Page 2");
  assert.match(pages[0].svgMarkup, /<svg[\s>]/);
});

test("buildCanvasHistoryPreviewPages rejects malformed xml", () => {
  assert.throws(() => buildCanvasHistoryPreviewPages("<mxfile><diagram>"), /preview/i);
});
```

- [ ] **Step 2: Run the new helper tests and verify they fail for the missing helper**

Run: `npm run test:node -- tests/canvas-history-preview.test.ts`
Expected: FAIL with a missing file/export error for `buildCanvasHistoryPreviewPages`.

- [ ] **Step 3: Implement the minimal preview helper**

```ts
export interface CanvasHistoryPreviewPage {
  id: string;
  name: string;
  svgMarkup: string;
}

export function buildCanvasHistoryPreviewPages(xml: string): CanvasHistoryPreviewPage[] {
  // Parse mxfile XML, iterate diagram pages, and return page metadata plus SVG markup.
}
```

Implementation notes:

- Use browser-compatible DOM parsing primitives already available in the frontend code path.
- Normalize unnamed pages to `Page N`.
- Throw explicit errors when XML is empty, malformed, or produces no pages.
- Keep this helper pure: input is snapshot XML, output is preview records only.
- Keep page-level SVG generation independent from the current iframe editor state.

- [ ] **Step 4: Re-run the helper tests and verify they pass**

Run: `npm run test:node -- tests/canvas-history-preview.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit the helper slice**

```bash
git add tests/canvas-history-preview.test.ts app/(internal)/_lib/canvas-history-preview.ts
git commit -m "feat: add canvas history svg preview helper"
```

## Chunk 2: Restore Preview Modal Flow

### Task 2: Add failing source assertions for preview-gated restore behavior

**Files:**
- Modify: `tests/session-workspace-canvas-history-source.test.ts`
- Create: `tests/session-workspace-restore-preview-source.test.ts`
- Modify: `app/(internal)/_components/session-workspace.tsx`

- [ ] **Step 1: Expand the existing restore source test to assert preview entry points**

Add assertions similar to:

```ts
assert.match(source, /openRestorePreview/);
assert.match(source, /restorePreviewDialogOpen/);
assert.doesNotMatch(source, /onClick=\{\(\) => void handleRestoreCanvasHistory\(entry\)\}/);
```

- [ ] **Step 2: Add a new failing source test for modal structure**

```ts
test("session workspace renders a restore preview modal with page tabs and explicit confirmation", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /预览后恢复/);
  assert.match(source, /确认恢复/);
  assert.match(source, /restorePreviewPages/);
  assert.match(source, /restorePreviewActivePageId/);
  assert.match(source, /Tabs/);
  assert.match(source, /dangerouslySetInnerHTML/);
});
```

- [ ] **Step 3: Run the focused source tests and confirm they fail**

Run: `npm run test:node -- tests/session-workspace-canvas-history-source.test.ts tests/session-workspace-restore-preview-source.test.ts`
Expected: FAIL because the session workspace does not yet expose preview-open state, modal markers, or tabbed preview rendering.

- [ ] **Step 4: Implement modal state and preview orchestration in the session workspace**

Required changes inside `app/(internal)/_components/session-workspace.tsx`:

- add preview state:

```ts
const [restorePreviewEntry, setRestorePreviewEntry] = useState<CanvasHistoryEntry | null>(null);
const [restorePreviewDialogOpen, setRestorePreviewDialogOpen] = useState(false);
const [restorePreviewPages, setRestorePreviewPages] = useState<CanvasHistoryPreviewPage[]>([]);
const [restorePreviewActivePageId, setRestorePreviewActivePageId] = useState("");
const [restorePreviewError, setRestorePreviewError] = useState("");
const [isPreparingRestorePreview, setIsPreparingRestorePreview] = useState(false);
```

- replace direct button wiring with `openRestorePreview(entry)`
- generate preview pages before enabling confirmation
- render a second `Modal` for restore preview using the approved preview-first layout
- render page tabs above the SVG preview
- disable `确认恢复` while preview is loading, failed, or a restore is already running
- keep `取消` always available unless a confirmed restore is actively in flight

- [ ] **Step 5: Reuse the current restore path only from the confirmation action**

Refactor the current restore code into two functions:

```ts
async function confirmRestorePreview(): Promise<void> {
  if (!restorePreviewEntry) {
    return;
  }

  await handleRestoreCanvasHistory(restorePreviewEntry);
}
```

Implementation notes:

- Keep `handleRestoreCanvasHistory(entry)` as the only function that talks to `documentBridge.applyDocument(...)`.
- Close and reset the modal only after a successful restore.
- If restore fails, leave the modal open and surface the existing workspace error.

- [ ] **Step 6: Re-run the focused source tests and confirm they pass**

Run: `npm run test:node -- tests/session-workspace-canvas-history-source.test.ts tests/session-workspace-restore-preview-source.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit the modal-flow slice**

```bash
git add tests/session-workspace-canvas-history-source.test.ts tests/session-workspace-restore-preview-source.test.ts app/(internal)/_components/session-workspace.tsx
git commit -m "feat: gate canvas restore behind svg preview modal"
```

## Chunk 3: Regression Verification

### Task 3: Run helper, source, and existing restore-related verification

**Files:**
- Test: `tests/canvas-history-preview.test.ts`
- Test: `tests/session-workspace-canvas-history-source.test.ts`
- Test: `tests/session-workspace-restore-preview-source.test.ts`
- Test: `tests/session-workspace-document-history-source.test.ts`

- [ ] **Step 1: Run the restore-related focused verification set**

Run: `npm run test:node -- tests/canvas-history-preview.test.ts tests/session-workspace-canvas-history-source.test.ts tests/session-workspace-restore-preview-source.test.ts tests/session-workspace-document-history-source.test.ts`
Expected: PASS.

- [ ] **Step 2: Run the full Node test suite**

Run: `npm run test:node`
Expected: PASS.

- [ ] **Step 3: Review failures and fix only restore-preview regressions introduced by this work**

Guardrail:

- Do not refactor unrelated session workspace behavior.
- If unrelated pre-existing failures appear, document them separately instead of masking them.

- [ ] **Step 4: Re-run `npm run test:node` and confirm a clean pass**

Run: `npm run test:node`
Expected: PASS.

- [ ] **Step 5: Commit the verification result**

```bash
git add app/(internal)/_components/session-workspace.tsx app/(internal)/_lib/canvas-history-preview.ts tests/canvas-history-preview.test.ts tests/session-workspace-canvas-history-source.test.ts tests/session-workspace-restore-preview-source.test.ts
git commit -m "test: verify restore preview flow"
```
