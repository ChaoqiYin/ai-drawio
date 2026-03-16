# Restore Preview SVG Design

**Date:** 2026-03-16

**Goal:** Require an explicit confirmation dialog before restoring a canvas history snapshot, and let the user preview the target snapshot as per-page SVG images before confirming the restore.

## Context

The session workspace currently renders canvas history entries in the sidebar and lets the user click `恢复到此版本` to immediately apply the stored XML through the existing document bridge.

That direct restore path works, but it is too eager for a destructive action:

- There is no confirmation step.
- There is no visual preview of the snapshot about to be restored.
- Multi-page snapshots cannot be inspected before restore.

The requested change is deliberately scoped:

- Keep the existing restore backend path and version-history behavior.
- Add a confirmation modal before restore.
- Render the preview as SVG for speed.
- If a snapshot contains multiple pages, provide page tabs inside the modal so the user can inspect each page before restoring.

## User Experience

### Entry Point

The sidebar continues to show the existing history cards and the `恢复到此版本` action.

Clicking that button no longer restores immediately. Instead, it opens a restore-preview modal.

### Modal Layout

The modal follows the preview-first layout that was approved during brainstorming:

- Large SVG preview area is the dominant surface.
- Page tabs sit above the preview region.
- A compact metadata row shows snapshot label, timestamp, and source.
- Footer actions are `取消` and `确认恢复`.

The modal previews only the target historical snapshot. It does not show a side-by-side diff against the current canvas.

### Multi-Page Behavior

If the snapshot contains multiple diagram pages:

- The modal renders one tab per page.
- The first available page is selected when the modal opens.
- Clicking a tab swaps the SVG preview to that page.

If page names are missing, the UI falls back to generated labels such as `Page 1`, `Page 2`, and so on.

### Restore Confirmation

Restore happens only after the user clicks `确认恢复`.

The current restore semantics stay unchanged:

- The target XML from the selected history entry is applied through the existing `documentBridge.applyDocument(...)` path.
- The pre-restore canvas is still captured as a new history snapshot with source `restore-pre-apply`.

### Failure States

The modal must handle preview failures safely:

- If preview generation is still running, the preview surface shows a loading state and the confirm button stays disabled.
- If preview generation fails, the modal shows an error message in place of the preview and the confirm button stays disabled.
- The user can still dismiss the modal with `取消`.

The sidebar restore button remains disabled under the existing bridge-readiness constraints.

## Architecture

This feature stays inside the current session workspace boundary and avoids storage-model changes.

### Unit 1: Restore Preview Modal State

Location: `app/(internal)/_components/session-workspace.tsx`

Responsibility:

- Track which history entry is being previewed.
- Track modal visibility.
- Track preview loading, preview error, selected page, and restore-in-progress state.

This unit only manages UI state and orchestration. It does not perform XML parsing or SVG generation itself.

### Unit 2: Snapshot Preview Preparation Helper

Location: `app/(internal)/_lib/canvas-history-preview.ts`

Responsibility:

- Parse the stored draw.io XML snapshot.
- Extract the diagram page list.
- Produce a per-page preview model with:
  - page id
  - page display name
  - SVG markup string

The helper must operate on the snapshot XML itself so the preview reflects the restore target, not the current editor state.

The helper returns structured data and throws explicit errors for malformed or unsupported XML.

Suggested interface:

- `buildCanvasHistoryPreviewPages(xml: string): CanvasHistoryPreviewPage[]`

### Unit 3: Existing Restore Execution Path

Location: existing restore handler in `app/(internal)/_components/session-workspace.tsx`

Responsibility:

- Apply the chosen snapshot XML only after confirmation.
- Reuse the current document bridge integration.
- Preserve the existing pre-restore snapshot write and conversation reload behavior.

This unit should change as little as possible. The main change is that it becomes the confirmation action rather than the initial click action.

## Data Flow

1. User clicks `恢复到此版本` on a sidebar history item.
2. The workspace stores that history entry as the active preview target and opens the modal.
3. Preview preparation starts for the entry XML.
4. The preview helper parses the snapshot into page-level SVG preview records.
5. The modal renders tabs plus the active page SVG.
6. If the user clicks `确认恢复`, the existing restore path applies `entry.xml`.
7. The workspace reloads conversation state after the restore completes.

This keeps preview generation and restore application as separate phases, which reduces accidental restores and keeps the destructive step explicit.

## Rendering Strategy

The preview surface renders SVG markup strings generated from the snapshot pages.

Why SVG:

- It is faster to display than spinning up a second editable draw.io instance inside the modal.
- It is naturally read-only.
- It matches the user request for a quick visual confirmation surface.

The preview is not interactive beyond page selection. Zooming, panning, and editing are out of scope.

## Error Handling

The feature must distinguish between two error classes:

### Preview Errors

- Invalid snapshot XML
- SVG generation failure
- Empty page set

Behavior:

- Show an inline modal error.
- Keep `确认恢复` disabled.
- Do not mutate the current canvas.

### Restore Errors

- Bridge unavailable
- Document apply failure
- Conversation reload failure after restore

Behavior:

- Preserve the current existing error banner behavior in the session workspace.
- Close the modal only after a successful restore.
- Re-enable controls when the failure path completes.

## Testing Strategy

### Source-Level UI Coverage

Add or update source assertions that verify:

- restore clicks open preview flow instead of restoring immediately
- the restore-preview modal exists
- page tabs are rendered for preview selection
- the modal contains explicit confirm/cancel actions
- the final restore action still routes through the existing restore handler

### Helper Coverage

If preview generation is extracted into a helper, add focused Node tests for:

- single-page snapshot preview model generation
- multi-page snapshot preview model generation
- fallback page labels
- malformed XML rejection

### Regression Coverage

Run the relevant existing source-level tests for session workspace history and restore behavior to ensure the confirmation gate does not break the current history timeline or restore semantics.

## Out Of Scope

These changes are intentionally excluded from this spec:

- side-by-side diff between current canvas and historical snapshot
- persistent SVG preview caching in IndexedDB
- thumbnail generation during history writes
- interactive preview editing
- changes to the underlying history storage schema

## Open Decisions Resolved

The following product decisions are fixed by this spec:

- Preview type: SVG image preview
- Layout: preview-first modal
- Comparison mode: preview target only
- Multi-page handling: tabs inside the modal
- Restore gate: explicit confirm button only after successful preview generation
