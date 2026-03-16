import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace.tsx",
  import.meta.url
);

test("session workspace persists the triggering user prompt before AI snapshot history", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /appendConversationMessage/);
  assert.match(source, /prompt = ''/);
  assert.match(source, /const normalizedPrompt = prompt\.trim\(\)/);
  assert.match(source, /role: 'user'/);
  assert.match(source, /relatedMessageId: userMessage\?\.id \|\| relatedMessageId/);
});
