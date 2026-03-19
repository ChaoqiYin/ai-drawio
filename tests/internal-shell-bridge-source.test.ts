import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/internal-shell-bridge.tsx",
  import.meta.url
);

test("internal shell bridge exposes shared session orchestration helpers", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /useRouter/);
  assert.match(source, /getSessionStatus/);
  assert.match(source, /listOpenSessions/);
  assert.match(source, /registerSessionRuntime/);
  assert.match(source, /unregisterSessionRuntime/);
  assert.match(source, /createConversation/);
  assert.match(source, /findConversationByTitle/);
  assert.match(source, /getConversationById/);
  assert.match(source, /getConversation/);
  assert.match(source, /hasConversation/);
  assert.match(source, /listConversations/);
  assert.match(source, /openSession/);
  assert.match(source, /openSessionTab/);
  assert.match(source, /ensureSessionTab/);
  assert.match(source, /sessions:/);
  assert.match(source, /__AI_DRAWIO_SHELL__/);
  assert.match(source, /router\.push/);
  assert.match(source, /conversationStore/);
});
