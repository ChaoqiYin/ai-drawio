import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ARCO_PROVIDER_PATH = new URL("../app/arco-config-provider.tsx", import.meta.url);
const HOME_SOURCE_PATH = new URL(
  "../app/(internal)/_components/conversation-home.tsx",
  import.meta.url
);
const WORKSPACE_SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace.tsx",
  import.meta.url
);

test("internal pages use rounded buttons and icons for key actions", async () => {
  const [providerSource, homeSource, workspaceSource] = await Promise.all([
    readFile(ARCO_PROVIDER_PATH, "utf8"),
    readFile(HOME_SOURCE_PATH, "utf8"),
    readFile(WORKSPACE_SOURCE_PATH, "utf8")
  ]);

  assert.match(providerSource, /Button:\s*\{\s*size:\s*"small",\s*shape:\s*"round"\s*\}/);

  assert.match(homeSource, /@arco-design\/web-react\/icon/);
  assert.match(homeSource, /icon=\{<IconPlus/);
  assert.match(homeSource, /icon=\{<IconEdit/);
  assert.match(homeSource, /icon=\{<IconDelete/);
  assert.match(homeSource, /icon=\{<IconPoweroff/);

  assert.match(workspaceSource, /@arco-design\/web-react\/icon/);
  assert.match(workspaceSource, /icon=\{<IconEdit/);
  assert.match(workspaceSource, /icon=\{<IconLeft/);
});
