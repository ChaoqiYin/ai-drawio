# Canvas History Cached SVG Preview Design

**Date:** 2026-03-16

**Goal:** Cache per-page SVG previews on every canvas history write so restore preview dialogs can load historical snapshots instantly without converting XML during preview time.

## Context

The session workspace already supports:

- writing canvas history entries before AI document applies
- writing canvas history entries before restore applies
- opening a restore-preview modal before the final restore action

The current preview approach converts draw.io XML into SVG when the user opens the restore dialog. That works technically, but it has the wrong timing:

- preview generation is repeated at read time instead of write time
- preview latency is paid exactly when the user is trying to inspect history
- history entries do not carry their own visual snapshot payload

The requested change is to move SVG generation forward into the history write path and persist it with every history record.

This applies to both existing history sources:

- `ai-pre-apply`
- `restore-pre-apply`

## Product Decision

Every new `canvasHistory` record must include cached per-page SVG previews.

Restore preview dialogs must consume only the cached preview payload from the history record. They must not fall back to on-demand XML conversion for new behavior.

## User Experience

### History Write Behavior

When the app creates a new canvas history entry:

1. Capture the source XML snapshot.
2. Ask the embedded draw.io runtime to export every page as SVG.
3. Store the XML and exported preview pages together in IndexedDB.

The user does not see an additional step, but future preview dialogs become instant.

### Restore Preview Dialog

The dialog still uses the preview-first layout that was already approved:

- large preview area
- page tabs above the preview
- explicit `取消` and `确认恢复` actions

The important change is data sourcing:

- the dialog reads `entry.previewPages`
- it no longer generates SVG on open

### Old History Records

Older history records that predate this feature may not have cached previews.

For those records:

- the dialog shows a clear “暂无缓存预览” style message
- the restore confirmation action stays disabled

This keeps behavior explicit and avoids silently reintroducing read-time conversion logic.

## Data Model

### New Preview Record

Location: `app/(internal)/_lib/conversation-model.ts`

Add a preview-page type with:

- `id`
- `name`
- `svgDataUri`

### Updated Canvas History Entry

Location: `app/(internal)/_lib/conversation-model.ts`

Extend `CanvasHistoryEntry` with:

- `previewPages: CanvasHistoryPreviewPage[]`

`createCanvasHistoryEntry(...)` must require this field for new writes.

For compatibility with older stored data, hydration logic may normalize missing values to an empty array.

## Storage Model

Location: `app/(internal)/_lib/conversation-store.ts`

Keep the existing `canvasHistory` object store rather than adding a second preview-specific store.

Why:

- previews belong directly to one history record
- retrieval stays simple
- current scope does not justify a new store or cross-store cleanup logic

## IndexedDB Migration

The database version must be bumped because the shape of stored `canvasHistory` records changes.

Migration behavior:

- existing records remain readable
- records without `previewPages` are treated as `previewPages: []`
- no backfill generation runs during migration

This keeps migration predictable and avoids expensive upgrade-time rendering work.

## Architecture

### Unit 1: Cached Preview Data Types

Location: `app/(internal)/_lib/conversation-model.ts`

Responsibility:

- define preview-page types
- attach preview pages to history records
- construct normalized history entries

### Unit 2: History Storage Compatibility Layer

Location: `app/(internal)/_lib/conversation-store.ts`

Responsibility:

- persist `previewPages` with each history record
- normalize missing preview arrays when hydrating older records
- keep existing conversation and history indexes stable

### Unit 3: Draw.io Preview Export Bridge

Location: `app/(internal)/_components/session-workspace.tsx`

Responsibility:

- use the embedded draw.io runtime to export a snapshot XML into page-level SVG previews
- do this immediately before any canvas history write

This keeps preview fidelity aligned with the actual draw.io runtime already embedded in the desktop shell.

### Unit 4: Restore Preview Modal

Location: `app/(internal)/_components/session-workspace.tsx`

Responsibility:

- read cached preview pages from the chosen history entry
- render page tabs and active SVG preview
- block restore when no cached preview exists

## Data Flow

### AI Pre-Apply Snapshot

1. Read current draw.io XML.
2. Export current XML into cached `previewPages`.
3. Write `canvasHistory` entry with `xml + previewPages`.
4. Apply the new AI-generated document XML.

### Restore Pre-Apply Snapshot

1. Read current draw.io XML before restore.
2. Export current XML into cached `previewPages`.
3. Write `canvasHistory` entry with `xml + previewPages`.
4. Apply the chosen historical XML.

### Restore Preview Read Path

1. User clicks `恢复到此版本`.
2. Dialog opens for that history entry.
3. Dialog renders `entry.previewPages`.
4. User switches tabs if needed.
5. User confirms restore only after cached preview inspection.

## Error Handling

### History Write Errors

If SVG export fails while preparing a new history entry:

- do not silently write a preview-less new record
- surface an error through the existing session workspace error handling
- abort the document apply or restore operation that depends on the history write

Reason:

The feature contract is that new history entries always carry cached previews.

### Preview Read Errors

If a historical entry has no cached previews:

- show an inline empty/error state in the modal
- keep `确认恢复` disabled

This applies only to older records created before the migration.

## Testing Strategy

### Model Tests

Add or extend tests for:

- preview-page type normalization
- history entry construction with `previewPages`
- compatibility defaults for missing `previewPages`

### Store Tests

Add or extend tests for:

- `appendCanvasHistoryEntry(...)` requiring/storing `previewPages`
- hydrated history records exposing `previewPages`
- old records without `previewPages` hydrating to an empty array

### Session Workspace Source Tests

Add or update assertions that verify:

- history writes collect cached preview pages before calling `appendCanvasHistoryEntry(...)`
- restore preview UI reads `entry.previewPages`
- restore preview no longer depends on on-demand `buildSvgPreviewPages(entry.xml)` calls

### Regression Verification

Run the session-workspace-related test set and the full Node suite after the change.

## Out Of Scope

The following are intentionally excluded:

- background backfill of old history records
- separate preview object stores
- preview compression or deduplication
- side-by-side diff preview
- interactive SVG preview editing

## Open Decisions Resolved

The following decisions are fixed by this spec:

- preview cache timing: write time, not read time
- preview scope: both `ai-pre-apply` and `restore-pre-apply`
- preview storage location: inline on each `canvasHistory` record
- old-record behavior: readable, but previewless and non-restorable through the cached-preview dialog
