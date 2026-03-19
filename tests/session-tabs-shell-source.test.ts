import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const PAGE_SOURCE_PATH = new URL("../app/(internal)/page.tsx", import.meta.url);
const SESSION_PAGE_SOURCE_PATH = new URL("../app/(internal)/session/page.tsx", import.meta.url);
const ROUTE_SHELL_SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-route-shell.tsx",
  import.meta.url
);
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

test("/session page is the route-level entry for the workspace detail shell", async () => {
  const source = await readFile(SESSION_PAGE_SOURCE_PATH, "utf8");

  assert.match(source, /Suspense/);
  assert.match(source, /SessionRouteShell/);
  assert.match(source, /return \(\s*<Suspense fallback=\{null\}>[\s\S]*<SessionRouteShell \/>/);
});

test("session route shell renders the detail shell without query-parameter coupling", async () => {
  const source = await readFile(ROUTE_SHELL_SOURCE_PATH, "utf8");

  assert.match(source, /SessionTabsShell/);
  assert.match(source, /return <SessionTabsShell \/>;/);
  assert.doesNotMatch(source, /useSearchParams/);
  assert.doesNotMatch(source, /initialSessionId/);
});

test("session tabs shell reads opened sessions from the detail store and renders top nav before tabs", async () => {
  const source = await readFile(SHELL_SOURCE_PATH, "utf8");

  assert.match(source, /useWorkspaceSessionStore/);
  assert.match(source, /openedSessions/);
  assert.match(source, /activeSessionId/);
  assert.match(source, /resetSessionDetail/);
  assert.match(source, /router\.push\("\/"\)/);
  assert.match(source, /InternalTopNavigation/);
  assert.match(source, /InternalBreadcrumb/);
  assert.match(source, /<InternalTopNavigation[\s\S]*<Tabs/);
  assert.match(source, /SessionWorkspaceHost/);
  assert.match(source, /openedSessions\.map\(\(session\) =>/);
  assert.match(source, /hidden=\{session\.id !== activeSessionId\}/);
  assert.doesNotMatch(source, /const \[openedSessionIds, setOpenedSessionIds\] = useState<string\[\]>/);
  assert.doesNotMatch(source, /const \[activeSessionId, setActiveSessionId\] = useState/);
  assert.doesNotMatch(source, /ConversationHome/);
});
