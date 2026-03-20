use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::menu::MenuBuilder;
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, State, WindowEvent};

#[cfg(target_os = "macos")]
use objc2::{AllocAnyThread, MainThreadMarker};
#[cfg(target_os = "macos")]
use objc2_app_kit::{NSApplication, NSImage};
#[cfg(target_os = "macos")]
use objc2_foundation::NSData;

const TRAY_ICON_ID: &str = "main-tray";
const TRAY_RUNTIME_STATE_CHANGE_EVENT: &str = "ai-drawio:tray-runtime-state-change";
const TRAY_MENU_SHOW_ID: &str = "tray-show-main-window";
const TRAY_MENU_QUIT_ID: &str = "tray-quit-app";
const TRAY_SETTINGS_FILE_NAME: &str = "tray-settings.json";
const MAIN_WINDOW_LABEL: &str = "main";
pub const STARTUP_MODE_ENV_VAR: &str = "AI_DRAWIO_OPEN_MODE";
#[cfg(target_os = "macos")]
const MACOS_APP_ICON_BYTES: &[u8] = include_bytes!("../../assets/ai-drawio.icns");

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum TrayCloseBehavior {
    HideToTray,
    Quit,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TraySettingsState {
    pub enabled: bool,
    pub tray_visible: bool,
    pub main_window_visible: bool,
    pub close_behavior: TrayCloseBehavior,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
struct TrayPreference {
    enabled: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum StartupMode {
    Tray,
    Window,
}

impl StartupMode {
    fn parse(value: &str) -> Option<Self> {
        match value.trim() {
            "tray" => Some(Self::Tray),
            "window" => Some(Self::Window),
            _ => None,
        }
    }

    fn tray_enabled(self) -> bool {
        matches!(self, Self::Tray)
    }
}

impl Default for TrayPreference {
    fn default() -> Self {
        Self { enabled: false }
    }
}

#[derive(Debug, Default)]
pub struct TrayRuntimeState {
    inner: Mutex<TrayRuntimeFlags>,
}

#[derive(Debug, Default)]
struct TrayRuntimeFlags {
    enabled: bool,
    quitting: bool,
}

fn tray_settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|path| path.join(TRAY_SETTINGS_FILE_NAME))
        .map_err(|error| error.to_string())
}

fn load_tray_preference_from_path(path: &Path) -> Result<TrayPreference, String> {
    match fs::read_to_string(path) {
        Ok(contents) => {
            Ok(serde_json::from_str(&contents).unwrap_or_else(|_| TrayPreference::default()))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(TrayPreference::default()),
        Err(error) => Err(error.to_string()),
    }
}

fn save_tray_preference_to_path(path: &Path, preference: TrayPreference) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let payload = serde_json::to_string_pretty(&preference).map_err(|error| error.to_string())?;
    fs::write(path, payload).map_err(|error| error.to_string())
}

fn load_tray_preference(app: &AppHandle) -> Result<TrayPreference, String> {
    let path = tray_settings_path(app)?;
    load_tray_preference_from_path(&path)
}

fn save_tray_preference(app: &AppHandle, preference: TrayPreference) -> Result<(), String> {
    let path = tray_settings_path(app)?;
    save_tray_preference_to_path(&path, preference)
}

fn read_startup_mode_override() -> Option<StartupMode> {
    std::env::var(STARTUP_MODE_ENV_VAR)
        .ok()
        .and_then(|value| StartupMode::parse(&value))
}

fn resolve_effective_tray_enabled(app: &AppHandle, preference: TrayPreference) -> bool {
    let _ = app;

    read_startup_mode_override()
        .map(StartupMode::tray_enabled)
        .unwrap_or(preference.enabled)
}

fn current_effective_tray_preference(app: &AppHandle) -> Result<TrayPreference, String> {
    let preference = load_tray_preference(app)?;

    Ok(TrayPreference {
        enabled: resolve_effective_tray_enabled(app, preference),
    })
}

fn close_behavior_for_enabled(enabled: bool) -> TrayCloseBehavior {
    if enabled {
        TrayCloseBehavior::HideToTray
    } else {
        TrayCloseBehavior::Quit
    }
}

fn is_main_window_visible(app: &AppHandle) -> Result<bool, String> {
    let Some(main_window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return Ok(false);
    };

    main_window.is_visible().map_err(|error| error.to_string())
}

fn build_tray_settings_state(
    enabled: bool,
    tray_visible: bool,
    main_window_visible: bool,
) -> TraySettingsState {
    TraySettingsState {
        enabled,
        tray_visible,
        main_window_visible,
        close_behavior: close_behavior_for_enabled(enabled),
    }
}

fn current_tray_settings_state(
    app: &AppHandle,
    enabled: bool,
) -> Result<TraySettingsState, String> {
    Ok(build_tray_settings_state(
        enabled,
        app.tray_by_id(TRAY_ICON_ID).is_some(),
        is_main_window_visible(app)?,
    ))
}

fn set_runtime_enabled(state: &TrayRuntimeState, enabled: bool) {
    if let Ok(mut flags) = state.inner.lock() {
        flags.enabled = enabled;
        flags.quitting = false;
    }
}

fn is_hide_to_tray_enabled(state: &TrayRuntimeState) -> bool {
    if let Ok(flags) = state.inner.lock() {
        flags.enabled && !flags.quitting
    } else {
        false
    }
}

fn mark_app_quitting(state: &TrayRuntimeState) {
    if let Ok(mut flags) = state.inner.lock() {
        flags.quitting = true;
    }
}

fn show_main_window(app: &AppHandle) -> Result<(), String> {
    let main_window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "main window is not available".to_string())?;

    main_window
        .unminimize()
        .map_err(|error| error.to_string())?;
    main_window.show().map_err(|error| error.to_string())?;
    main_window.set_focus().map_err(|error| error.to_string())?;
    let _ = emit_tray_runtime_state_change(app);
    Ok(())
}

#[cfg(target_os = "macos")]
fn apply_macos_tray_mode(app: &AppHandle, enabled: bool) -> Result<(), String> {
    app.set_dock_visibility(!enabled)
        .map_err(|error| error.to_string())
}

#[cfg(not(target_os = "macos"))]
fn apply_macos_tray_mode(_app: &AppHandle, _enabled: bool) -> Result<(), String> {
    Ok(())
}

fn apply_macos_startup_tray_mode(app: &AppHandle, enabled: bool) -> Result<(), String> {
    apply_macos_tray_mode(app, enabled)
}

#[cfg(target_os = "macos")]
fn sync_macos_application_icon() -> Result<(), String> {
    let mtm =
        MainThreadMarker::new().ok_or_else(|| "main thread marker is unavailable".to_string())?;
    let app = NSApplication::sharedApplication(mtm);
    let data = NSData::with_bytes(MACOS_APP_ICON_BYTES);
    let app_icon = NSImage::initWithData(NSImage::alloc(), &data)
        .ok_or_else(|| "failed to decode macOS app icon".to_string())?;
    unsafe { app.setApplicationIconImage(Some(&app_icon)) };
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn sync_macos_application_icon() -> Result<(), String> {
    Ok(())
}

fn restore_main_window_from_tray(
    app: &AppHandle,
    state: &TrayRuntimeState,
) -> Result<TraySettingsState, String> {
    let previous_preference = load_tray_preference(app)?;

    if let Err(error) = save_tray_preference(app, TrayPreference { enabled: false }) {
        let _ = save_tray_preference(app, previous_preference);
        return Err(error);
    }

    set_runtime_enabled(state, false);

    remove_tray(app);

    if let Err(error) = apply_macos_tray_mode(app, false) {
        let _ = save_tray_preference(app, previous_preference);
        if previous_preference.enabled {
            let _ = create_tray(app);
        }
        let _ = apply_macos_tray_mode(app, previous_preference.enabled);
        set_runtime_enabled(state, previous_preference.enabled);
        return Err(error);
    }

    if let Err(error) = sync_macos_application_icon() {
        let _ = save_tray_preference(app, previous_preference);
        if previous_preference.enabled {
            let _ = create_tray(app);
        }
        let _ = apply_macos_tray_mode(app, previous_preference.enabled);
        set_runtime_enabled(state, previous_preference.enabled);
        return Err(error);
    }

    if let Err(error) = show_main_window(app) {
        let _ = save_tray_preference(app, previous_preference);
        if previous_preference.enabled {
            let _ = create_tray(app);
        }
        let _ = apply_macos_tray_mode(app, previous_preference.enabled);
        set_runtime_enabled(state, previous_preference.enabled);
        return Err(error);
    }

    current_tray_settings_state(app, false)
}

fn hide_main_window(app: &AppHandle) -> Result<(), String> {
    let main_window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "main window is not available".to_string())?;

    main_window.hide().map_err(|error| error.to_string())?;
    let _ = emit_tray_runtime_state_change(app);
    Ok(())
}

fn emit_tray_runtime_state_change(app: &AppHandle) -> Result<(), String> {
    let main_window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "main window is not available".to_string())?;

    main_window
        .eval(&format!(
            r#"window.dispatchEvent(new CustomEvent("{TRAY_RUNTIME_STATE_CHANGE_EVENT}"));"#
        ))
        .map_err(|error| error.to_string())
}

fn remove_tray(app: &AppHandle) {
    let _ = app.remove_tray_by_id(TRAY_ICON_ID);
}

fn schedule_restore_main_window_from_tray(app: &AppHandle) {
    let app_handle = app.clone();

    thread::spawn(move || {
        thread::sleep(Duration::from_millis(150));

        let restore_handle = app_handle.clone();
        if app_handle
            .run_on_main_thread(move || {
                let state = restore_handle.state::<TrayRuntimeState>();
                let _ = restore_main_window_from_tray(&restore_handle, &state);
            })
            .is_err()
        {}
    });
}

fn create_tray(app: &AppHandle) -> Result<(), String> {
    if app.tray_by_id(TRAY_ICON_ID).is_some() {
        return Ok(());
    }

    let menu = MenuBuilder::new(app)
        .text(TRAY_MENU_SHOW_ID, "显示主窗口")
        .text(TRAY_MENU_QUIT_ID, "退出应用")
        .build()
        .map_err(|error| error.to_string())?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ICON_ID)
        .menu(&menu)
        .tooltip("AI Drawio")
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| {
            if event.id() == TRAY_MENU_SHOW_ID {
                schedule_restore_main_window_from_tray(app);
                return;
            }

            if event.id() == TRAY_MENU_QUIT_ID {
                mark_app_quitting(&app.state::<TrayRuntimeState>());
                app.exit(0);
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder.build(app).map_err(|error| error.to_string())?;
    Ok(())
}

fn apply_tray_enabled(
    app: &AppHandle,
    state: &TrayRuntimeState,
    enabled: bool,
    hide_window_on_enable: bool,
) -> Result<(), String> {
    if enabled {
        create_tray(app)?;
        apply_macos_tray_mode(app, true)?;
        set_runtime_enabled(state, true);
    } else {
        set_runtime_enabled(state, false);
    }

    if enabled && hide_window_on_enable {
        hide_main_window(app)?;
    }

    if !enabled {
        apply_macos_tray_mode(app, false)?;
        sync_macos_application_icon()?;
        remove_tray(app);
        show_main_window(app)?;
    }

    Ok(())
}

pub fn setup_tray(app: &AppHandle) -> Result<(), String> {
    let effective_preference = current_effective_tray_preference(app)?;
    let state = app.state::<TrayRuntimeState>();
    apply_macos_startup_tray_mode(app, effective_preference.enabled)?;
    set_runtime_enabled(&state, effective_preference.enabled);

    if effective_preference.enabled {
        create_tray(app)?;
    }

    Ok(())
}

pub fn should_show_main_window_on_app_ready(app: &AppHandle) -> bool {
    if let Ok(effective_preference) = current_effective_tray_preference(app) {
        return !effective_preference.enabled;
    }

    let state = app.state::<TrayRuntimeState>();
    !is_hide_to_tray_enabled(&state)
}

pub fn register_close_interceptor(app: &AppHandle) {
    if let Some(main_window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let app_handle = app.clone();
        main_window.on_window_event(move |event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let state = app_handle.state::<TrayRuntimeState>();
                if is_hide_to_tray_enabled(&state) {
                    api.prevent_close();
                    let _ = hide_main_window(&app_handle);
                }
            }
        });
    }
}

#[tauri::command]
pub fn get_tray_settings(
    app: tauri::AppHandle,
    state: State<'_, TrayRuntimeState>,
) -> Result<TraySettingsState, String> {
    let effective_preference = current_effective_tray_preference(&app)?;
    set_runtime_enabled(&state, effective_preference.enabled);

    current_tray_settings_state(&app, effective_preference.enabled)
}

#[tauri::command]
pub fn set_tray_enabled(
    app: tauri::AppHandle,
    state: State<'_, TrayRuntimeState>,
    enabled: bool,
) -> Result<TraySettingsState, String> {
    let previous_preference = load_tray_preference(&app)?;

    if let Err(error) = apply_tray_enabled(&app, &state, enabled, true) {
        let _ = apply_tray_enabled(&app, &state, previous_preference.enabled, false);
        return Err(error);
    }

    if let Err(error) = save_tray_preference(&app, TrayPreference { enabled }) {
        let _ = apply_tray_enabled(&app, &state, previous_preference.enabled, false);
        return Err(error);
    }

    current_tray_settings_state(&app, enabled)
}

#[cfg(test)]
mod tests {
    use super::{
        build_tray_settings_state, close_behavior_for_enabled, load_tray_preference_from_path,
        save_tray_preference_to_path, TrayCloseBehavior, TrayPreference,
    };
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn create_temp_path(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time should move forward")
            .as_nanos();
        std::env::temp_dir().join(format!("ai-drawio-{name}-{nanos}.json"))
    }

    #[test]
    fn missing_tray_settings_defaults_to_disabled() {
        let path = create_temp_path("missing");

        let preference =
            load_tray_preference_from_path(&path).expect("default preference should load");

        assert_eq!(preference, TrayPreference { enabled: false });
    }

    #[test]
    fn tray_settings_round_trip_through_json_file() {
        let path = create_temp_path("roundtrip");

        save_tray_preference_to_path(&path, TrayPreference { enabled: true })
            .expect("preference should write");

        let preference = load_tray_preference_from_path(&path).expect("preference should read");
        assert_eq!(preference, TrayPreference { enabled: true });

        let _ = fs::remove_file(path);
    }

    #[test]
    fn enabled_state_maps_to_hide_to_tray_behavior() {
        assert_eq!(
            close_behavior_for_enabled(true),
            TrayCloseBehavior::HideToTray
        );
        assert_eq!(close_behavior_for_enabled(false), TrayCloseBehavior::Quit);
    }

    #[test]
    fn normalized_state_reports_visibility_and_close_behavior() {
        let enabled_state = build_tray_settings_state(true, true, false);
        assert!(enabled_state.enabled);
        assert!(enabled_state.tray_visible);
        assert!(!enabled_state.main_window_visible);
        assert_eq!(enabled_state.close_behavior, TrayCloseBehavior::HideToTray);

        let disabled_state = build_tray_settings_state(false, false, true);
        assert!(!disabled_state.enabled);
        assert!(!disabled_state.tray_visible);
        assert!(disabled_state.main_window_visible);
        assert_eq!(disabled_state.close_behavior, TrayCloseBehavior::Quit);
    }
}
