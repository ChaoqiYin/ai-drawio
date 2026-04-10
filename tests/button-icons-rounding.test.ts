import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ARCO_PROVIDER_PATH = new URL("../app/arco-config-provider.tsx", import.meta.url);
const HOME_SOURCE_PATH = new URL(
  "../app/(internal)/_components/conversation-home.tsx",
  import.meta.url
);
const SESSION_TABS_SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-tabs-shell.tsx",
  import.meta.url
);
const WORKSPACE_SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace.tsx",
  import.meta.url
);
const TOP_NAV_SOURCE_PATH = new URL(
  "../app/(internal)/_components/internal-top-navigation.tsx",
  import.meta.url
);

test("internal pages use rounded buttons and icons for key actions", async () => {
  const [providerSource, homeSource, sessionTabsSource, workspaceSource, topNavSource] = await Promise.all([
    readFile(ARCO_PROVIDER_PATH, "utf8"),
    readFile(HOME_SOURCE_PATH, "utf8"),
    readFile(SESSION_TABS_SOURCE_PATH, "utf8"),
    readFile(WORKSPACE_SOURCE_PATH, "utf8"),
    readFile(TOP_NAV_SOURCE_PATH, "utf8")
  ]);

  assert.match(providerSource, /Button:\s*\{\s*size:\s*"small",\s*shape:\s*"round"\s*\}/);

  assert.match(homeSource, /@arco-design\/web-react\/icon/);
  assert.match(homeSource, /icon=\{<IconPlus/);
  assert.match(homeSource, /icon=\{<IconEdit/);
  assert.match(homeSource, /icon=\{<IconDelete/);
  assert.match(homeSource, /icon=\{<IconPoweroff/);

  assert.match(sessionTabsSource, /@arco-design\/web-react\/icon/);
  assert.match(sessionTabsSource, /icon=\{<IconPlus/);
  assert.match(sessionTabsSource, /icon=\{<IconEdit/);
  assert.match(sessionTabsSource, /icon=\{<IconClose/);
  assert.match(sessionTabsSource, /shape="circle"/);
  assert.match(workspaceSource, /@arco-design\/web-react\/icon/);
  assert.match(
    workspaceSource,
    /icon=\{<IconRight style=\{\{ display: 'block', fontSize: 18, lineHeight: 1 \}\} \/>\}/
  );
  assert.match(workspaceSource, /icon=\{<IconLeft \/>\}/);
  assert.match(workspaceSource, /h-\[44px\]!/);
  assert.match(workspaceSource, /w-\[24px\]!/);
  assert.match(workspaceSource, /items-center!/);
  assert.match(workspaceSource, /justify-center!/);
  assert.match(workspaceSource, /leading-none!/);
  assert.match(workspaceSource, /shadow-\[10px_0_24px_rgba\(15,23,42,0\.22\)\]/);
  assert.match(workspaceSource, /fontSize: 18/);
  assert.match(workspaceSource, /lineHeight: 1/);
  assert.match(topNavSource, /@arco-design\/web-react\/icon/);
  assert.match(topNavSource, /icon=\{<IconLeft/);
});
