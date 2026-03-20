import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace.tsx",
  import.meta.url
);

test("session workspace exposes document bridge PNG preview export with optional page selection", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /exportPreviewPages: \(selectedPage\?: number\) => Promise<\{/);
  assert.match(source, /aiDrawioBuildPngPreviewPages: \{ isAsync: true \}/);
  assert.match(source, /async function exportCurrentPreviewPages\(selectedPage\?: number\): Promise<\{/);
  assert.match(source, /const pages = await buildPngPagesForExport\(xml\)/);
  assert.match(source, /const pageCount = pages\.length/);
  assert.match(source, /selectedIndex >= 0 && selectedIndex < pages\.length/);
  assert.match(source, /typeof candidate\.pngDataUri === 'string'/);
  assert.match(source, /async exportPreviewPages\(selectedPage\?: number\) \{/);
  assert.match(source, /return exportCurrentPreviewPages\(selectedPage\);/);
  assert.match(source, /exportedAt: new Date\(\)\.toISOString\(\)/);
});
