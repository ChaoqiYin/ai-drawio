import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const PAGE_SOURCE_PATH = new URL("../app/(internal)/page.tsx", import.meta.url);
const SHELL_SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-tabs-shell.tsx",
  import.meta.url
);

test("internal home route renders the multi-session tabs shell", async () => {
  const source = await readFile(PAGE_SOURCE_PATH, "utf8");

  assert.match(source, /ConversationHome/);
  assert.match(source, /return <ConversationHome \/>;/);
  assert.doesNotMatch(source, /SessionTabsShell/);
});

test("session tabs shell owns opened and active session tab state", async () => {
  const source = await readFile(SHELL_SOURCE_PATH, "utf8");

  assert.match(source, /const \[openedSessionIds, setOpenedSessionIds\] = useState<string\[\]>/);
  assert.match(source, /const \[activeSessionId, setActiveSessionId\] = useState/);
  assert.match(source, /function openSessionTab\(sessionId: string, title: string\)/);
  assert.match(source, /current\.includes\(sessionId\)/);
  assert.match(source, /setActiveSessionId\(sessionId\)/);
  assert.match(source, /SessionWorkspaceHost/);
  assert.match(source, /openedSessionIds\.map\(\(sessionId\) =>/);
  assert.match(source, /hidden=\{sessionId !== activeSessionId\}/);
});
