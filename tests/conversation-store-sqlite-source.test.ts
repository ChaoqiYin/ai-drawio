import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const FACADE_SOURCE_PATH = new URL(
  "../app/(internal)/_lib/conversation-store.ts",
  import.meta.url,
);
const LEGACY_SOURCE_PATH = new URL(
  "../app/(internal)/_lib/legacy-indexeddb-conversation-store.ts",
  import.meta.url,
);
const TAURI_SOURCE_PATH = new URL(
  "../app/(internal)/_lib/tauri-conversation-store.ts",
  import.meta.url,
);

test("conversation store facade routes between tauri and legacy implementations", async () => {
  const facadeSource = await readFile(FACADE_SOURCE_PATH, "utf8");

  assert.match(facadeSource, /legacy-indexeddb-conversation-store/);
  assert.match(facadeSource, /tauri-conversation-store/);
  assert.match(facadeSource, /hasTauriInvoke/);
  assert.match(facadeSource, /clearAllAppData/);
  assert.match(facadeSource, /importLegacyIndexedDbConversations/);
});

test("sqlite conversation adapters and legacy store source files exist", async () => {
  const [legacySource, tauriSource] = await Promise.all([
    readFile(LEGACY_SOURCE_PATH, "utf8"),
    readFile(TAURI_SOURCE_PATH, "utf8"),
  ]);

  assert.match(legacySource, /IndexedDB/);
  assert.match(legacySource, /deleteDrawioBrowserFile/);
  assert.match(tauriSource, /list_conversation_summaries/);
  assert.match(tauriSource, /clear_conversation_data/);
});
