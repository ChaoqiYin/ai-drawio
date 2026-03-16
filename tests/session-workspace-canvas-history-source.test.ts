import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace.tsx",
  import.meta.url
);

test("session workspace sidebar renders canvas history entries with restore actions", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /AI 修改前快照/);
  assert.match(source, /恢复到此版本/);
  assert.match(source, /buildConversationTimeline/);
  assert.match(source, /handleRestoreCanvasHistory/);
  assert.match(source, /openRestorePreview/);
  assert.match(source, /restorePreviewDialogOpen/);
  assert.doesNotMatch(source, /onClick=\{\(\) => void handleRestoreCanvasHistory\(entry\)\}/);
});
