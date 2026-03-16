import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import * as conversationStore from "../app/(internal)/_lib/conversation-store.ts";

const SOURCE_PATH = new URL(
  "../app/(internal)/_lib/conversation-store.ts",
  import.meta.url
);

test("conversation store exports deletion helpers", () => {
  assert.equal(typeof conversationStore.deleteConversation, "function");
  assert.equal(typeof conversationStore.clearAllIndexedDbDatabases, "function");
  assert.equal(typeof conversationStore.hasConversation, "function");
  assert.equal(typeof conversationStore.updateConversationTitle, "function");
  assert.equal(typeof conversationStore.subscribeConversationChanges, "function");
  assert.equal(typeof conversationStore.listConversationMessages, "function");
  assert.equal(typeof conversationStore.listCanvasHistoryEntries, "function");
  assert.equal(typeof conversationStore.appendCanvasHistoryEntry, "function");
});

test("conversation store persists cached preview pages for canvas history entries", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /previewPages/);
  assert.match(source, /DATABASE_VERSION = 3/);
  assert.match(source, /normalizeCanvasHistoryPreviewPages/);
  assert.match(source, /previewPages:\s*normalizeCanvasHistoryPreviewPages/);
});
