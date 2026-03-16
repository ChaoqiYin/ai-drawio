import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace.tsx",
  import.meta.url
);

test("session workspace sidebar renders canvas history entries with restore actions", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /findCanvasHistoryEntryForMessage/);
  assert.match(source, /buildTimelineEntryHeading/);
  assert.match(source, /buildTimelineEntryBody/);
  assert.match(source, /findUserPromptForCanvasHistory/);
  assert.match(source, /恢复快照/);
  assert.match(source, /return entry\.source === 'restore-pre-apply' \? '恢复快照' : 'assistant';/);
  assert.match(source, /return findUserPromptForCanvasHistory\(entry, messages\);/);
  assert.match(source, /恢复到此版本/);
  assert.match(source, /buildConversationTimeline/);
  assert.match(source, /handleRestoreCanvasHistory/);
  assert.match(source, /openRestorePreview/);
  assert.match(source, /const linkedCanvasHistoryEntry = findCanvasHistoryEntryForMessage/);
  assert.match(source, /restorePreviewDialogOpen/);
  assert.doesNotMatch(source, /<Tag color="purple">\{entry\.role\}<\/Tag>/);
  assert.doesNotMatch(source, /<Tag color="cyan">画布历史<\/Tag>/);
  assert.doesNotMatch(source, /onClick=\{\(\) => void handleRestoreCanvasHistory\(entry\)\}/);
});
