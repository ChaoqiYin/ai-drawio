import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import * as conversationStore from "../app/(internal)/_lib/conversation-store.ts";

const SOURCE_PATH = new URL(
  "../app/(internal)/_lib/legacy-indexeddb-conversation-store.ts",
  import.meta.url
);

test("conversation store exports deletion helpers", () => {
  assert.equal(typeof conversationStore.deleteConversation, "function");
  assert.equal(typeof conversationStore.clearAllIndexedDbDatabases, "function");
  assert.equal(typeof conversationStore.clearAllAppData, "function");
  assert.equal(typeof conversationStore.findConversationByTitle, "function");
  assert.equal(typeof conversationStore.hasConversation, "function");
  assert.equal(typeof conversationStore.importLegacyIndexedDbConversations, "function");
  assert.equal(typeof conversationStore.touchConversationUpdatedAt, "function");
  assert.equal(typeof conversationStore.updateConversationTitle, "function");
  assert.equal(typeof conversationStore.subscribeConversationChanges, "function");
  assert.equal(typeof conversationStore.listConversationMessages, "function");
  assert.equal(typeof conversationStore.appendConversationMessage, "function");
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

test("conversation store deletes the matching drawio browser file when deleting a conversation", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /indexedDB\.open\("database", 2\)/);
  assert.match(source, /filesInfo/);
  assert.match(source, /files/);
  assert.match(source, /buildBrowserFileTitle/);
  assert.match(source, /removeItem\(title\)/);
});

test("conversation store seeds an initial blank-canvas snapshot for the welcome message", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /buildBlankCanvasHistoryPreviewPages/);
  assert.match(source, /label:\s*"Initial Blank Canvas"/);
  assert.match(source, /relatedMessageId:\s*welcomeMessage\.id/);
  assert.match(source, /stores\[CANVAS_HISTORY_STORE_NAME\]\.put/);
});
