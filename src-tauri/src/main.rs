#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cli_schema;
mod cli_path_install;
mod control_protocol;
mod control_server;
mod document_bridge;
mod packaged_cli;
mod session_runtime;
mod webview_api;

use tauri::Manager;
use serde_json::Value;
use webview_api::{
    eval_main_window_script, invoke_main_window_method, CallRequest, EvalRequest,
    ScriptResultBridgeState,
};

#[tauri::command]
fn call_page_method(app: tauri::AppHandle, request: CallRequest) -> Result<(), String> {
    invoke_main_window_method(&app, &request)
}

#[tauri::command]
fn eval_page_script(app: tauri::AppHandle, request: EvalRequest) -> Result<(), String> {
    eval_main_window_script(&app, &request)
}

#[tauri::command]
fn report_bridge_result(
    state: tauri::State<'_, ScriptResultBridgeState>,
    request_id: String,
    payload: Value,
) -> Result<(), String> {
    state.finish_request(&request_id, payload)
}

#[tauri::command]
fn app_ready(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(main_window) = app.get_webview_window("main") {
        main_window.show().map_err(|error| error.to_string())?;
        main_window.set_focus().map_err(|error| error.to_string())?;
    }

    if let Some(splash_window) = app.get_webview_window("splash") {
        splash_window.close().map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn main() {
    if let Some(exit_code) = packaged_cli::maybe_run_from_env() {
        std::process::exit(exit_code);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_cli::init())
        .manage(ScriptResultBridgeState::default())
        .setup(|app| {
            control_server::start_control_server(app.handle().clone())?;

            if let Some(main_window) = app.get_webview_window("main") {
                main_window.hide().map_err(|error| error.to_string())?;
            }

            if let Some(splash_window) = app.get_webview_window("splash") {
                splash_window.show().map_err(|error| error.to_string())?;
                splash_window
                    .set_focus()
                    .map_err(|error| error.to_string())?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_ready,
            cli_path_install::get_cli_install_status,
            cli_path_install::install_cli_to_path,
            call_page_method,
            eval_page_script,
            report_bridge_result
        ])
        .run(tauri::generate_context!())
        .expect("failed to run tauri application");
}
