import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL("../app/(internal)/_components/session-workspace.tsx", import.meta.url);

test("session workspace redirects invalid session visits back to home", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /useRouter/);
  assert.match(source, /router\.replace\('\//);
  assert.match(source, /saveHomeRedirectError/);
  assert.match(source, /未找到对应的本地会话/);
  assert.match(source, /缺少会话编号/);
});
