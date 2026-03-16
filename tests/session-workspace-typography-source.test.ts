import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace.tsx",
  import.meta.url
);

test("session workspace imports Typography.Text when timeline metadata uses Text nodes", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /<Text style=\{\{ fontWeight: 600 \}\}>/);
  assert.match(source, /<Text type="secondary">\{formatDate\(entry\.createdAt\)\}<\/Text>/);
  assert.match(source, /const \{ Paragraph, Text \} = Typography;/);
});
