import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace.tsx",
  import.meta.url
);

test("session workspace saves a result snapshot after applying a new AI document", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /buildSvgPreviewPagesForHistory/);
  assert.match(source, /const previewPages = await buildSvgPreviewPagesForHistory/);
  assert.match(source, /previewPages,/);
  assert.match(source, /await appendCanvasHistoryEntry/);
  assert.match(source, /callRemoteInvoke\('aiDrawioApplyDocument'/);
  assert.match(source, /const appliedDocument = await applyDocumentWithoutHistory\(xml\)/);
  assert.match(source, /buildSvgPreviewPagesForHistory\(appliedDocument\.xml\)/);
  assert.match(source, /xml:\s*appliedDocument\.xml/);

  const applyDocumentIndex = source.indexOf("const appliedDocument = await applyDocumentWithoutHistory(xml)");
  const buildPreviewIndex = source.indexOf("const previewPages = await buildSvgPreviewPagesForHistory");
  const appendHistoryIndex = source.indexOf("await appendCanvasHistoryEntry");

  assert.notEqual(applyDocumentIndex, -1);
  assert.notEqual(buildPreviewIndex, -1);
  assert.notEqual(appendHistoryIndex, -1);
  assert.ok(applyDocumentIndex < buildPreviewIndex);
  assert.ok(buildPreviewIndex < appendHistoryIndex);
});
