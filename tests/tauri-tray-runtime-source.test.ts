import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const MAIN_SOURCE_PATH = new URL("../src-tauri/src/main.rs", import.meta.url);
const CARGO_TOML_PATH = new URL("../src-tauri/Cargo.toml", import.meta.url);
const TRAY_SETTINGS_SOURCE_PATH = new URL("../src-tauri/src/tray_settings.rs", import.meta.url);

test("tauri runtime wires persistent tray settings and close interception", async () => {
  const [mainSource, cargoToml, traySettingsSource] = await Promise.all([
    readFile(MAIN_SOURCE_PATH, "utf8"),
    readFile(CARGO_TOML_PATH, "utf8"),
    readFile(TRAY_SETTINGS_SOURCE_PATH, "utf8"),
  ]);

  assert.match(cargoToml, /tauri\s*=\s*\{[\s\S]*features\s*=\s*\[[\s\S]*"tray-icon"/);
  assert.match(mainSource, /mod tray_settings;/);
  assert.match(mainSource, /tray_settings::/);
  assert.match(mainSource, /get_tray_settings/);
  assert.match(mainSource, /set_tray_enabled/);
  assert.match(mainSource, /register_close_interceptor/);
  assert.match(mainSource, /main_window\.hide\(\)/);
  assert.match(mainSource, /setup_tray/);
  assert.match(traySettingsSource, /const STARTUP_MODE_ENV_VAR: &str = "AI_DRAWIO_OPEN_MODE";/);
  assert.match(
    traySettingsSource,
    /enum StartupMode \{[\s\S]*Tray[\s\S]*Window[\s\S]*\}/
  );
  assert.match(
    traySettingsSource,
    /fn read_startup_mode_override\(\) -> Option<StartupMode> \{/
  );
  assert.match(
    traySettingsSource,
    /fn resolve_effective_tray_enabled\(\s*app: &AppHandle,\s*preference: TrayPreference\s*\) -> bool \{/
  );
  assert.match(
    traySettingsSource,
    /fn current_effective_tray_preference\(app: &AppHandle\) -> Result<TrayPreference, String> \{/
  );
  assert.match(traySettingsSource, /const TRAY_RUNTIME_STATE_CHANGE_EVENT: &str = "ai-drawio:tray-runtime-state-change";/);
  assert.match(traySettingsSource, /fn emit_tray_runtime_state_change\(app: &AppHandle\)/);
  assert.match(
    traySettingsSource,
    /fn restore_main_window_from_tray\(\s*app: &AppHandle,\s*state: &TrayRuntimeState,\s*\) -> Result<TraySettingsState, String>/
  );
  assert.match(traySettingsSource, /save_tray_preference\(app, TrayPreference \{ enabled: false \}\)/);
  assert.match(traySettingsSource, /fn apply_macos_startup_tray_mode\(_?app: &AppHandle, _?enabled: bool\) -> Result<\(\), String>/);
  assert.match(
    traySettingsSource,
    /fn apply_macos_tray_mode\(_?app: &AppHandle, _?enabled: bool\) -> Result<\(\), String> \{[\s\S]*set_dock_visibility\(!enabled\)/
  );
  assert.match(
    traySettingsSource,
    /const MACOS_APP_ICON_BYTES: &\[u8\] = include_bytes!\("\.\.\/\.\.\/assets\/ai-drawio\.icns"\);/
  );
  assert.match(
    traySettingsSource,
    /fn sync_macos_application_icon\(\) -> Result<\(\), String>/
  );
  assert.match(
    traySettingsSource,
    /fn apply_macos_startup_tray_mode\(_?app: &AppHandle, _?enabled: bool\) -> Result<\(\), String> \{[\s\S]*apply_macos_tray_mode\(app, enabled\)/
  );
  assert.match(traySettingsSource, /show_main_window\(app\)/);
  assert.match(
    traySettingsSource,
    /main_window[\s\S]*\.unminimize\(\)[\s\S]*map_err\(\|error\| error\.to_string\(\)\)\?/
  );
  assert.match(traySettingsSource, /remove_tray\(app\);/);
  assert.match(
    traySettingsSource,
    /window\.dispatchEvent\(new CustomEvent\("(\{TRAY_RUNTIME_STATE_CHANGE_EVENT\}|ai-drawio:tray-runtime-state-change)"\)\)/
  );
  assert.match(traySettingsSource, /let _ = emit_tray_runtime_state_change\(app\);/);
  assert.match(traySettingsSource, /if enabled && hide_window_on_enable/);
  assert.match(traySettingsSource, /hide_main_window\(app\)\?/);
  assert.match(traySettingsSource, /fn show_main_window\(app: &AppHandle\) -> Result<\(\), String> \{/);
  assert.match(
    traySettingsSource,
    /fn hide_main_window\(app: &AppHandle\) -> Result<\(\), String> \{[\s\S]*emit_tray_runtime_state_change\(app\);[\s\S]*\}/
  );
  assert.match(
    traySettingsSource,
    /fn schedule_restore_main_window_from_tray\(app: &AppHandle\) \{[\s\S]*thread::sleep\(Duration::from_millis\(150\)\);[\s\S]*run_on_main_thread\(move \|\| \{[\s\S]*restore_main_window_from_tray\(&restore_handle, &state\)/
  );
  assert.match(
    traySettingsSource,
    /if event.id\(\) == TRAY_MENU_SHOW_ID \{[\s\S]*schedule_restore_main_window_from_tray\(app\);/
  );
  assert.match(traySettingsSource, /let effective_preference = current_effective_tray_preference\(app\)\?;/);
  assert.match(traySettingsSource, /apply_macos_startup_tray_mode\(app, effective_preference\.enabled\)\?/);
  assert.match(
    traySettingsSource,
    /if effective_preference\.enabled \{[\s\S]*create_tray\(app\)\?;[\s\S]*\}/
  );
  assert.match(
    traySettingsSource,
    /pub fn should_show_main_window_on_app_ready\(app: &AppHandle\) -> bool \{[\s\S]*current_effective_tray_preference\(app\)[\s\S]*!effective_preference\.enabled/
  );
  assert.match(
    traySettingsSource,
    /if !enabled \{[\s\S]*apply_macos_tray_mode\(app, false\)\?;[\s\S]*sync_macos_application_icon\(\)\?;[\s\S]*remove_tray\(app\);[\s\S]*show_main_window\(app\)\?;[\s\S]*\}/
  );
  assert.match(
    traySettingsSource,
    /remove_tray\(app\);[\s\S]*apply_macos_tray_mode\(app, false\)[\s\S]*sync_macos_application_icon\(\)[\s\S]*set_runtime_enabled\(state, previous_preference\.enabled\);/
  );
  assert.match(traySettingsSource, /if !enabled \{[\s\S]*remove_tray\(app\);[\s\S]*show_main_window\(app\)\?;[\s\S]*\}/);
  assert.doesNotMatch(traySettingsSource, /setCanHide/);
  assert.doesNotMatch(traySettingsSource, /NSApplicationActivationPolicy/);
  assert.doesNotMatch(traySettingsSource, /activationPolicy/);
  assert.doesNotMatch(traySettingsSource, /sync_dock_visibility/);
  assert.doesNotMatch(traySettingsSource, /sync_window_taskbar_visibility/);
  assert.doesNotMatch(traySettingsSource, /activate_macos_application/);
  assert.doesNotMatch(traySettingsSource, /log_window_probe/);
  assert.doesNotMatch(traySettingsSource, /\[tray-probe\]/);
  assert.match(traySettingsSource, /show_menu_on_left_click\(true\)/);
  assert.doesNotMatch(traySettingsSource, /\[tray-debug\]/);
  assert.doesNotMatch(traySettingsSource, /on_tray_icon_event/);
});
