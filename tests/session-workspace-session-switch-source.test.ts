import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SHELL_SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-tabs-shell.tsx",
  import.meta.url
);
const HOST_SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace-host.tsx",
  import.meta.url
);
const WORKSPACE_SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace.tsx",
  import.meta.url
);

test("session tabs shell keeps one mounted host per opened session and only hides inactive ones", async () => {
  const [shellSource, hostSource, workspaceSource] = await Promise.all([
    readFile(SHELL_SOURCE_PATH, "utf8"),
    readFile(HOST_SOURCE_PATH, "utf8"),
    readFile(WORKSPACE_SOURCE_PATH, "utf8"),
  ]);

  assert.match(shellSource, /SessionWorkspaceHost/);
  assert.match(shellSource, /openedSessions\.map\(\(session\) =>/);
  assert.match(shellSource, /hidden=\{session\.id !== activeSessionId\}/);
  assert.match(shellSource, /closeSession\(session\.id\)/);
  assert.match(shellSource, /useWorkspaceSessionStore/);

  assert.match(hostSource, /export default function SessionWorkspaceHost/);
  assert.match(hostSource, /data-session-host=\{sessionId\}/);
  assert.match(hostSource, /className=\{hidden \? 'hidden' : 'flex min-h-0 min-w-0 flex-1 overflow-hidden'\}/);
  assert.match(hostSource, /<SessionWorkspace hidden=\{hidden\} sessionId=\{sessionId\} \/>/);

  assert.match(workspaceSource, /sessionId: providedSessionId/);
  assert.match(workspaceSource, /const sessionId = providedSessionId \|\| '';/);
  assert.doesNotMatch(workspaceSource, /useSearchParams/);
});
