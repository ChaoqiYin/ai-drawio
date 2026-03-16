import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace.tsx",
  import.meta.url
);

test("session workspace resets drawio bridge state when the session id changes", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /useEffect\(\(\) => \{/);
  assert.match(source, /bridge\.browserFileReady = false;/);
  assert.match(source, /bridge\.documentLoaded = false;/);
  assert.match(source, /bridge\.browserFileTitle = '';/);
  assert.match(source, /bridge\.lastDocumentXml = '';/);
  assert.match(source, /setIsFrameReady\(false\);/);
  assert.match(source, /\}, \[sessionId\]\);/);
});
