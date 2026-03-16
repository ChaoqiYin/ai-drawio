import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace.tsx",
  import.meta.url
);

test("session workspace saves a snapshot before applying a new AI document", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /buildSvgPreviewPagesForHistory/);
  assert.match(source, /const previewPages = await buildSvgPreviewPagesForHistory/);
  assert.match(source, /previewPages,/);
  assert.match(source, /await appendCanvasHistoryEntry/);
  assert.match(source, /callRemoteInvoke\('aiDrawioGetDocument'\)/);
  assert.match(source, /callRemoteInvoke\('aiDrawioApplyDocument'/);

  const getDocumentIndex = source.indexOf("callRemoteInvoke('aiDrawioGetDocument')");
  const buildPreviewIndex = source.indexOf("const previewPages = await buildSvgPreviewPagesForHistory");
  const appendHistoryIndex = source.indexOf("await appendCanvasHistoryEntry");
  const applyDocumentIndex = source.indexOf("callRemoteInvoke('aiDrawioApplyDocument'");

  assert.notEqual(getDocumentIndex, -1);
  assert.notEqual(buildPreviewIndex, -1);
  assert.notEqual(appendHistoryIndex, -1);
  assert.notEqual(applyDocumentIndex, -1);
  assert.ok(getDocumentIndex < appendHistoryIndex);
  assert.ok(buildPreviewIndex < appendHistoryIndex);
  assert.ok(appendHistoryIndex < applyDocumentIndex);
});
