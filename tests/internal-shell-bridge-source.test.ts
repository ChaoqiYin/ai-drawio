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
  assert.match(source, /createConversation/);
  assert.match(source, /hasConversation/);
  assert.match(source, /openSession/);
  assert.match(source, /router\.push/);
  assert.match(source, /conversationStore/);
});
