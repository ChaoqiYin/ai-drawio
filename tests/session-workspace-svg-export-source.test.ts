import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace.tsx",
  import.meta.url
);

test("session workspace exposes document bridge svg export for all current pages", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /exportSvgPages: \(\) => Promise<\{/);
  assert.match(source, /async function exportCurrentSvgPages\(\): Promise<\{/);
  assert.match(source, /const xml = await readCurrentDocumentXml\(\)/);
  assert.match(source, /const pages = await buildSvgPagesForExport\(xml\)/);
  assert.match(source, /svg: decodeSvgDataUri\(page\.svgDataUri\)/);
  assert.match(source, /async exportSvgPages\(\) \{/);
  assert.match(source, /return exportCurrentSvgPages\(\);/);
  assert.match(source, /exportedAt: new Date\(\)\.toISOString\(\)/);
  assert.doesNotMatch(source, /svgDataUri,\s*outputPath/);
});
