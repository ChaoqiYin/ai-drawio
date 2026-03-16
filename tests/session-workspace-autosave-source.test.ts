import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL("../app/(internal)/_components/session-workspace.tsx", import.meta.url);

test("session workspace syncs conversation updatedAt when drawio autosaves", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /message\.event === 'autosave' \|\| message\.event === 'save'/);
  assert.match(source, /void syncConversationUpdatedAt\(\)/);
  assert.match(source, /await touchConversationUpdatedAt\(conversationId\)/);
});
