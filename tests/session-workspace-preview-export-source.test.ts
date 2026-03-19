import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace.tsx",
  import.meta.url
);

test("session workspace exposes document bridge PNG preview export for all current pages", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /exportPreviewPages: \(\) => Promise<\{/);
  assert.match(source, /aiDrawioBuildPngPreviewPages: \{ isAsync: true \}/);
  assert.match(source, /async function exportCurrentPreviewPages\(\): Promise<\{/);
  assert.match(source, /const pages = await buildPngPagesForExport\(xml\)/);
  assert.match(source, /typeof candidate\.pngDataUri === 'string'/);
  assert.match(source, /async exportPreviewPages\(\) \{/);
  assert.match(source, /return exportCurrentPreviewPages\(\);/);
  assert.match(source, /exportedAt: new Date\(\)\.toISOString\(\)/);
});
