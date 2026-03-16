#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod control_protocol;
mod control_server;
mod document_bridge;
mod session_runtime;
mod webview_api;

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

fn main() {
    tauri::Builder::default()
        .manage(ScriptResultBridgeState::default())
        .setup(|app| {
            control_server::start_control_server(app.handle().clone())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            call_page_method,
            eval_page_script,
            report_bridge_result
        ])
        .run(tauri::generate_context!())
        .expect("failed to run tauri application");
}
