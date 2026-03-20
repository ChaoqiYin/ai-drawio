import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import * as tauriConversationStore from "../app/(internal)/_lib/tauri-conversation-store.ts";

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

test("tauri conversation store treats empty preview pages as an empty cached preview state", async () => {
  const originalWindow = globalThis.window;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      __TAURI_INTERNALS__: {
        invoke: async (command: string) => {
          assert.equal(command, "get_conversation");

          return {
            id: "conversation-1",
            title: "Conversation 1",
            createdAt: "2026-03-20T00:00:00.000Z",
            updatedAt: "2026-03-20T00:00:00.000Z",
            messages: [],
            canvasHistory: [
              {
                id: "canvas-history-1",
                conversationId: "conversation-1",
                createdAt: "2026-03-20T00:00:00.000Z",
                label: "Initial Blank Canvas",
                previewPages: [],
                relatedMessageId: null,
                source: "ai-pre-apply",
                xml: "<mxGraphModel />",
              },
            ],
          };
        },
      },
    },
  });

  try {
    const conversation = await tauriConversationStore.getConversationById("conversation-1");

    assert.ok(conversation);
    assert.deepEqual(conversation.canvasHistory[0]?.previewPages, []);
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  }
});
