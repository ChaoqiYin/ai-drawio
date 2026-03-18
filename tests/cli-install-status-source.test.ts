import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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
  const [presentationSource, homeSource, settingsSource] = await Promise.all([
    readFile(PRESENTATION_SOURCE_PATH, "utf8"),
    readFile(HOME_SOURCE_PATH, "utf8"),
    readFile(SETTINGS_SOURCE_PATH, "utf8"),
  ]);

  assert.match(
    presentationSource,
    /export function getCliInstallStatusLabel\(status: CliInstallStatus\["status"\]\): string/
  );
  assert.match(
    presentationSource,
    /export function getCliInstallStatusColor\(status: CliInstallStatus\["status"\]\): "green" \| "orange" \| "red" \| "gray"/
  );
  assert.match(presentationSource, /case "installed":[\s\S]*return "已安装"/);
  assert.match(presentationSource, /case "installed_other_build":[\s\S]*return "已安装到其他构建"/);
  assert.match(presentationSource, /case "mismatched":[\s\S]*return "安装目标异常"/);
  assert.match(presentationSource, /case "error":[\s\S]*return "状态异常"/);
  assert.match(presentationSource, /case "not_installed":[\s\S]*return "未安装"/);

  assert.match(homeSource, /getCliInstallStatusLabel/);
  assert.match(homeSource, /getCliInstallStatusColor/);
  assert.match(homeSource, /getCliInstallStatus\(\)/);

  assert.match(settingsSource, /getCliInstallStatusLabel/);
  assert.match(settingsSource, /getCliInstallStatusColor/);
  assert.doesNotMatch(settingsSource, /function getStatusLabel/);
  assert.doesNotMatch(settingsSource, /function getStatusColor/);
});
