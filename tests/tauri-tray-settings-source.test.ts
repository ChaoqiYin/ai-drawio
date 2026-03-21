import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const TAURI_TRAY_SETTINGS_PATH = new URL(
  "../app/(internal)/_lib/tauri-tray-settings.ts",
  import.meta.url
);

test("tray settings helper uses tauri tray commands", async () => {
  const helperSource = await readFile(TAURI_TRAY_SETTINGS_PATH, "utf8");

  assert.match(helperSource, /const TRAY_RUNTIME_STATE_CHANGE_EVENT = "ai-drawio:tray-runtime-state-change"/);
  assert.match(helperSource, /getRequiredTauriInvoke/);
  assert.match(helperSource, /export type TrayCloseBehavior = "hide_to_tray" \| "quit"/);
  assert.match(helperSource, /export type TraySettingsState = \{/);
  assert.match(helperSource, /enabled: boolean/);
  assert.match(helperSource, /trayVisible: boolean/);
  assert.match(helperSource, /mainWindowVisible: boolean/);
  assert.match(helperSource, /closeBehavior: TrayCloseBehavior/);
  assert.match(helperSource, /return invoke\("get_tray_settings"\) as Promise<TraySettingsState>/);
  assert.match(
    helperSource,
    /return invoke\("set_tray_enabled", \{\s*enabled,\s*\}\) as Promise<TraySettingsState>/
  );
  assert.match(
    helperSource,
    /export function subscribeTrayRuntimeStateChange\(listener: \(\) => void\): \(\) => void \{/
  );
  assert.match(helperSource, /window\.addEventListener\(TRAY_RUNTIME_STATE_CHANGE_EVENT, handleChange\)/);
  assert.match(helperSource, /window\.removeEventListener\(TRAY_RUNTIME_STATE_CHANGE_EVENT, handleChange\)/);
  assert.doesNotMatch(helperSource, /\[tray-debug\]/);
});
