import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL("../app/(internal)/_components/session-workspace.tsx", import.meta.url);

test("session workspace uses drawio browser storage instead of conversation xml persistence", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /saveAndExit=0/);
  assert.doesNotMatch(source, /saveConversationDocument/);
  assert.doesNotMatch(source, /conversation\?\.documentXml/);
  assert.doesNotMatch(source, /withUpdatedConversationDocument/);
  assert.match(source, /aiDrawioEnsureBrowserFile/);
  assert.match(source, /browserFileReady/);
  assert.match(source, /mode: 'browser'/);
  assert.match(source, /catch \(callbackError\)/);
  assert.match(source, /fail\(callbackError\)/);
});
