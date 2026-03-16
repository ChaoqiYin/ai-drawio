import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace.tsx",
  import.meta.url
);

test("session workspace renders a custom restore preview dialog without arco modal or tabs refs", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /预览后恢复/);
  assert.match(source, /确认恢复/);
  assert.match(source, /restorePreviewPages/);
  assert.match(source, /restorePreviewActivePageId/);
  assert.match(source, /暂无缓存预览/);
  assert.match(source, /hasRestorePreview/);
  assert.match(source, /data-dialog=\"restore-preview\"/);
  assert.match(source, /restore-preview-tab/);
  assert.match(source, /entry\.previewPages/);
  assert.doesNotMatch(source, /buildSvgPreviewPages\(entry\.xml\)/);
  assert.doesNotMatch(source, /<Modal\s+title=\"预览后恢复\"/);
  assert.doesNotMatch(source, /<Tabs/);
});
