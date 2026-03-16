import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace.tsx",
  import.meta.url
);

test("session workspace renders a restore preview modal with page tabs and explicit confirmation", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /预览后恢复/);
  assert.match(source, /确认恢复/);
  assert.match(source, /restorePreviewPages/);
  assert.match(source, /restorePreviewActivePageId/);
  assert.match(source, /暂无缓存预览/);
  assert.match(source, /hasRestorePreview/);
  assert.match(source, /Modal/);
  assert.match(source, /Tabs/);
  assert.match(source, /entry\.previewPages/);
  assert.match(source, /applyDocumentWithoutHistory\(entry\.xml\)/);
  assert.match(source, /style=\{\{ width: ['"]70vw['"], maxWidth: ['"]70vw['"] \}\}/);
  assert.match(source, /className="flex items-center justify-between gap-3"/);
  assert.match(source, /<Tag>\s*[\s\S]*\{buildCanvasHistoryDescription\(restorePreviewEntry\)\}[\s\S]*<\/Tag>/);
  assert.match(source, /<Tag color="green">\{formatDate\(restorePreviewEntry\.createdAt\)\}<\/Tag>/);
  assert.doesNotMatch(source, /<Tag color="green">\s*\{buildCanvasHistoryDescription\(restorePreviewEntry\)\}\s*<\/Tag>/);
  assert.doesNotMatch(source, /restorePreviewEntry\.label \|\| 'AI 生成结果快照'/);
  assert.doesNotMatch(source, /AI 结果快照/);
  assert.doesNotMatch(source, /AI 生成结果快照/);
  assert.match(source, /rounded-\[8px\]/);
  assert.doesNotMatch(source, /rounded-\[12px\]/);
  assert.doesNotMatch(source, /rounded-\[18px\]/);
  assert.doesNotMatch(source, /border border-\[rgba\(148,163,184,0\.2\)\] bg-white p-4/);
  assert.doesNotMatch(source, /shadow-\[0_18px_36px_rgba\(15,23,42,0\.38\)\]/);
  assert.doesNotMatch(source, /buildSvgPreviewPages\(entry\.xml\)/);
  assert.doesNotMatch(source, /truncateConversationAfterCanvasHistoryEntry/);
  assert.doesNotMatch(
    source,
    /documentBridge\.applyDocument\(\{\s*historyLabel:\s*'恢复前快照',\s*historySource:\s*'restore-pre-apply',\s*xml:\s*entry\.xml,\s*\}\)/
  );
});
