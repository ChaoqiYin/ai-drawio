import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const PRESENTATION_SOURCE_PATH = new URL(
  "../app/(internal)/_lib/cli-install-status-presentation.ts",
  import.meta.url
);
const HOME_SOURCE_PATH = new URL(
  "../app/(internal)/_components/conversation-home.tsx",
  import.meta.url
);
const SETTINGS_SOURCE_PATH = new URL(
  "../app/(internal)/_components/settings-page.tsx",
  import.meta.url
);

test("cli install status presentation is shared between home and settings", async () => {
  const [homeSource, settingsSource] = await Promise.all([
    readFile(HOME_SOURCE_PATH, "utf8"),
    readFile(SETTINGS_SOURCE_PATH, "utf8"),
  ]);

  await assert.rejects(() => access(PRESENTATION_SOURCE_PATH));
  assert.doesNotMatch(homeSource, /getCliInstallStatusLabel/);
  assert.doesNotMatch(homeSource, /getCliInstallStatusColor/);
  assert.doesNotMatch(homeSource, /getCliInstallStatus\(\)/);
  assert.doesNotMatch(settingsSource, /getCliInstallStatusLabel/);
  assert.doesNotMatch(settingsSource, /getCliInstallStatusColor/);
  assert.doesNotMatch(homeSource, /cli-install-status-presentation/);
  assert.doesNotMatch(settingsSource, /cli-install-status-presentation/);
});
