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

test("session tabs shell uses a fixed header plus a flex detail body", async () => {
  const source = await readFile(SHELL_SOURCE_PATH, "utf8");

  assert.match(
    source,
    /const shellClassName =\s*'internal-app-shell mx-auto flex h-screen min-h-0 min-w-0 w-full flex-col overflow-hidden px-3! py-3! md:px-5! md:py-5!';/
  );
  assert.match(source, /useWorkspaceSessionStore/);
  assert.match(source, /openedSessions/);
  assert.match(source, /activeSessionId/);
  assert.match(source, /createConversation/);
  assert.match(source, /const \[isCreatingSession, setIsCreatingSession\] = useState\(false\);/);
  assert.match(source, /const \[createSessionError, setCreateSessionError\] = useState\(''\);/);
  assert.match(source, /async function handleCreateSession\(\): Promise<void> \{/);
  assert.match(source, /const conversation = await createConversation\('本地 AI 会话'\);/);
  assert.match(source, /openSession\(\{/);
  assert.match(source, /setIsCreatingSession\(true\)/);
  assert.match(source, /setIsCreatingSession\(false\)/);
  assert.match(source, /resetSessionDetail/);
  assert.match(source, /InternalTopNavigation/);
  assert.match(source, /InternalBreadcrumb/);
  assert.match(source, /<div className="relative z-\[1\] flex min-h-0 min-w-0 flex-1 flex-col gap-3">/);
  assert.match(source, /<div className="flex flex-col gap-3" data-layout="session-shell-header">/);
  assert.match(source, /data-layout="session-shell-header"/);
  assert.match(source, /data-layout="session-shell-tabs"/);
  assert.match(source, /data-layout="session-shell-tabs-inner"/);
  assert.match(source, /data-layout="session-shell-body"/);
  assert.match(source, /className="min-w-0 overflow-x-auto" data-layout="session-shell-tabs"/);
  assert.match(source, /className="min-w-max px-1 py-0" data-layout="session-shell-tabs-inner"/);
  assert.match(source, /<Tabs activeTab=\{activeSessionId\} className="internal-session-tabs" onChange=\{activateSession\} type="rounded">/);
  assert.match(source, /<InternalTopNavigation[\s\S]*actions=\{/);
  assert.match(source, /aria-label="创建本地会话"/);
  assert.match(source, /data-layout="session-shell-create"/);
  assert.match(source, /IconPlus/);
  assert.match(source, /createSessionError \? <Alert type="error" content=\{createSessionError\} showIcon \/> : null/);
  assert.match(source, /<InternalTopNavigation[\s\S]*data-layout="session-shell-tabs"/);
  assert.match(source, /data-layout="session-tab-title"/);
  assert.match(source, /className="relative min-h-0 min-w-0 flex flex-1 flex-col overflow-hidden" data-layout="session-shell-body"/);
  assert.match(source, /SessionWorkspaceHost/);
  assert.match(source, /openedSessions\.map\(\(session\) =>/);
  assert.match(source, /hidden=\{session\.id !== activeSessionId\}/);
  assert.match(source, /当前没有打开的标签页/);
  assert.match(source, /可以从首页重新进入一个会话，或等待新的会话在这里打开。/);
  assert.doesNotMatch(source, /<Layout/);
  assert.doesNotMatch(source, /<Content/);
  assert.doesNotMatch(source, /const \[openedSessionIds, setOpenedSessionIds\] = useState<string\[\]>/);
  assert.doesNotMatch(source, /const \[activeSessionId, setActiveSessionId\] = useState/);
  assert.doesNotMatch(source, /ConversationHome/);
  assert.doesNotMatch(
    source,
    /useEffect\(\(\) => \{\s*if \(openedSessions\.length > 0\) \{\s*return;\s*\}\s*router\.push\("\/"\);\s*\}, \[openedSessions\.length, router\]\);/
  );
});
