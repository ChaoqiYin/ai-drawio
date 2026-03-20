use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager, WebviewWindow};

pub const MAIN_WINDOW_LABEL: &str = "main";
const SHELL_HELPER_OBJECT: &str = "__AI_DRAWIO_SHELL__";
const RESULT_BRIDGE_COMMAND: &str = "report_bridge_result";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CallRequest {
    pub method_path: String,
    #[serde(default = "default_args")]
    pub args: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvalRequest {
    pub script: String,
}

#[derive(Default)]
pub struct ScriptResultBridgeState {
    next_request_id: AtomicU64,
    pending: Mutex<HashMap<String, Sender<Value>>>,
}

impl ScriptResultBridgeState {
    fn create_request_id(&self) -> String {
        let sequence = self.next_request_id.fetch_add(1, Ordering::Relaxed) + 1;
        format!("bridge-{sequence}")
    }

    pub fn finish_request(&self, request_id: &str, payload: Value) -> Result<(), String> {
        let sender = self
            .pending
            .lock()
            .map_err(|_| "bridge result registry is unavailable".to_string())?
            .remove(request_id)
            .ok_or_else(|| format!("bridge request '{request_id}' was not found"))?;

        sender
            .send(payload)
            .map_err(|_| format!("bridge request '{request_id}' receiver was dropped"))
    }
}

impl CallRequest {
    pub fn validate(&self) -> Result<(), String> {
        validate_method_path(&self.method_path)
    }
}

impl EvalRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.script.trim().is_empty() {
            return Err("script cannot be empty".into());
        }

        Ok(())
    }
}

pub fn invoke_main_window_method(app: &AppHandle, request: &CallRequest) -> Result<(), String> {
    request.validate()?;

    let window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| format!("webview window '{}' was not found", MAIN_WINDOW_LABEL))?;

    invoke_method_on_window(&window, &request.method_path, &request.args)
}

pub fn invoke_method_on_window(
    window: &WebviewWindow,
    method_path: &str,
    args: &Value,
) -> Result<(), String> {
    let script = build_method_call_script(method_path, args)?;
    window.eval(script).map_err(|error| error.to_string())
}

pub fn eval_main_window_script(app: &AppHandle, request: &EvalRequest) -> Result<(), String> {
    request.validate()?;

    let window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| format!("webview window '{}' was not found", MAIN_WINDOW_LABEL))?;

    eval_script_on_window(&window, &request.script)
}

pub fn eval_script_on_window(window: &WebviewWindow, script: &str) -> Result<(), String> {
    let wrapped_script = build_script_eval_script(script)?;
    window
        .eval(wrapped_script)
        .map_err(|error| error.to_string())
}

pub fn eval_main_window_script_with_result(
    app: &AppHandle,
    bridge_state: &ScriptResultBridgeState,
    script: &str,
    timeout: Duration,
) -> Result<Value, String> {
    let window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| format!("webview window '{}' was not found", MAIN_WINDOW_LABEL))?;

    eval_script_on_window_with_result(&window, bridge_state, script, timeout)
}

pub fn eval_script_on_window_with_result(
    window: &WebviewWindow,
    bridge_state: &ScriptResultBridgeState,
    script: &str,
    timeout: Duration,
) -> Result<Value, String> {
    if script.trim().is_empty() {
        return Err("script cannot be empty".into());
    }

    let request_id = bridge_state.create_request_id();
    let wrapped_script = build_result_bridge_eval_script(&request_id, script)?;
    let (sender, receiver) = mpsc::channel();

    bridge_state
        .pending
        .lock()
        .map_err(|_| "bridge result registry is unavailable".to_string())?
        .insert(request_id.clone(), sender);

    if let Err(error) = window.eval(wrapped_script) {
        let _ = bridge_state
            .pending
            .lock()
            .map_err(|_| "bridge result registry is unavailable".to_string())?
            .remove(&request_id);

        return Err(error.to_string());
    }

    let payload = match receiver.recv_timeout(timeout) {
        Ok(payload) => payload,
        Err(_) => {
            let _ = bridge_state
                .pending
                .lock()
                .map_err(|_| "bridge result registry is unavailable".to_string())?
                .remove(&request_id);

            return Err(format!(
                "timed out waiting for bridge result after {} ms",
                timeout.as_millis()
            ));
        }
    };

    if payload.get("ok").and_then(Value::as_bool).unwrap_or(false) {
        Ok(payload.get("value").cloned().unwrap_or(Value::Null))
    } else {
        Err(payload
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or("bridge script execution failed")
            .to_string())
    }
}

pub fn build_method_call_script(method_path: &str, args: &Value) -> Result<String, String> {
    validate_method_path(method_path)?;

    if !args.is_array() {
        return Err("args must be a JSON array".into());
    }

    let segments = method_path.split('.').collect::<Vec<_>>();
    let segments_json = serde_json::to_string(&segments).map_err(|error| error.to_string())?;
    let args_json = serde_json::to_string(args).map_err(|error| error.to_string())?;

    Ok(format!(
        r#"
(() => {{
  const path = {segments_json};
  const args = {args_json};
  const shell = window.{shell_helper};
  const finalize = (result) => {{
    window.__TAURI_LAST_CALL_RESULT__ = result;
    return JSON.stringify(result);
  }};

  try {{
    if (!shell || typeof shell.getFrameWindow !== "function") {{
      return finalize({{
        "ok": false,
        "error": "iframe bridge is not available",
        "methodPath": path.join(".")
      }});
    }}

    const frameWindow = shell.getFrameWindow();
    let owner = frameWindow;
    let current = frameWindow;

    for (const segment of path) {{
      owner = current;
      current = current?.[segment];
      if (typeof current === "undefined") {{
        return finalize({{
          "ok": false,
          "error": "target method not found",
          "methodPath": path.join("."),
          "missingSegment": segment
        }});
      }}
    }}

    if (typeof current !== "function") {{
      return finalize({{
        "ok": false,
        "error": "target is not callable",
        "methodPath": path.join("."),
        "resolvedType": typeof current
      }});
    }}

    const value = current.apply(owner, args);
    let serializedValue = null;

    try {{
      serializedValue = JSON.parse(JSON.stringify(value));
    }} catch (_serializationError) {{
      serializedValue = String(value);
    }}

    return finalize({{
      "ok": true,
      "methodPath": path.join("."),
      "value": serializedValue
    }});
  }} catch (error) {{
    return finalize({{
      "ok": false,
      "error": error instanceof Error ? error.message : String(error),
      "methodPath": path.join(".")
    }});
  }}
}})();
"#,
        shell_helper = SHELL_HELPER_OBJECT
    ))
}

pub fn build_script_eval_script(script: &str) -> Result<String, String> {
    if script.trim().is_empty() {
        return Err("script cannot be empty".into());
    }

    let script_json = serde_json::to_string(script).map_err(|error| error.to_string())?;

    Ok(format!(
        r#"
(() => {{
  const shell = window.{shell_helper};

  if (!shell || typeof shell.getFrameWindow !== "function") {{
    throw new Error("iframe bridge is not available");
  }}

  const frameWindow = shell.getFrameWindow();
  return frameWindow.eval({script_json});
}})();
"#,
        shell_helper = SHELL_HELPER_OBJECT
    ))
}

pub fn build_result_bridge_eval_script(request_id: &str, script: &str) -> Result<String, String> {
    if request_id.trim().is_empty() {
        return Err("request id cannot be empty".into());
    }

    if script.trim().is_empty() {
        return Err("script cannot be empty".into());
    }

    let request_id_json = serde_json::to_string(request_id).map_err(|error| error.to_string())?;

    Ok(format!(
        r#"
(() => {{
  const requestId = {request_id_json};

  const getInvoke = () => {{
    if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === "function") {{
      return window.__TAURI_INTERNALS__.invoke;
    }}

    if (window.__TAURI__?.core && typeof window.__TAURI__.core.invoke === "function") {{
      return window.__TAURI__.core.invoke;
    }}

    throw new Error("tauri invoke bridge is not available");
  }};

  const report = async (payload) => {{
    const invoke = getInvoke();
    await invoke("{bridge_command}", {{
      payload,
      requestId
    }});
  }};

  const run = async () => {{
    try {{
      const value = await (async () => {{
        {script}
      }})();

      await report({{
        ok: true,
        value
      }});
    }} catch (error) {{
      await report({{
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      }});
    }}
  }};

  run();
}})();
"#,
        bridge_command = RESULT_BRIDGE_COMMAND,
        request_id_json = request_id_json,
        script = script
    ))
}

fn default_args() -> Value {
    Value::Array(Vec::new())
}

fn validate_method_path(method_path: &str) -> Result<(), String> {
    let trimmed = method_path.trim();

    if trimmed.is_empty() {
        return Err("method path cannot be empty".into());
    }

    for segment in trimmed.split('.') {
        if segment.is_empty() {
            return Err("method path cannot contain empty segments".into());
        }

        if !is_valid_identifier(segment) {
            return Err(format!("invalid method path segment: {segment}"));
        }
    }

    Ok(())
}

fn is_valid_identifier(segment: &str) -> bool {
    let mut chars = segment.chars();
    let Some(first) = chars.next() else {
        return false;
    };

    if !is_identifier_start(first) {
        return false;
    }

    chars.all(is_identifier_continue)
}

fn is_identifier_start(ch: char) -> bool {
    ch == '_' || ch == '$' || ch.is_ascii_alphabetic()
}

fn is_identifier_continue(ch: char) -> bool {
    is_identifier_start(ch) || ch.is_ascii_digit()
}

#[cfg(test)]
mod tests {
    use super::{
        build_method_call_script, build_result_bridge_eval_script, build_script_eval_script,
        CallRequest, EvalRequest, SHELL_HELPER_OBJECT,
    };
    use serde_json::json;

    #[test]
    fn builds_a_call_for_a_nested_global_method() {
        let script = build_method_call_script("App.actions.openFile", &json!(["demo.drawio"]))
            .expect("script should be built");

        assert!(script.contains(SHELL_HELPER_OBJECT));
        assert!(script.contains("getFrameWindow"));
        assert!(script.contains("\"App\",\"actions\",\"openFile\""));
        assert!(script.contains("\"demo.drawio\""));
    }

    #[test]
    fn rejects_an_empty_method_path() {
        let error =
            build_method_call_script("", &json!([])).expect_err("empty method path must fail");
        assert!(error.contains("method path"));
    }

    #[test]
    fn rejects_non_array_arguments() {
        let error =
            build_method_call_script("App.actions.openFile", &json!({"name": "demo.drawio"}))
                .expect_err("non-array args must fail");
        assert!(error.contains("JSON array"));
    }

    #[test]
    fn script_builder_output_contains_structured_result_fields() {
        let script =
            build_method_call_script("myGlobalFn", &json!([1, 2])).expect("script should be built");

        assert!(script.contains("\"ok\""));
        assert!(script.contains("\"error\""));
        assert!(script.contains("__TAURI_LAST_CALL_RESULT__"));
    }

    #[test]
    fn eval_script_builder_targets_the_iframe_window() {
        let script =
            build_script_eval_script("window.someGlobal = true;").expect("script should be built");

        assert!(script.contains(SHELL_HELPER_OBJECT));
        assert!(script.contains("getFrameWindow"));
        assert!(script.contains("frameWindow.eval"));
    }

    #[test]
    fn result_bridge_script_reports_back_through_tauri_invoke() {
        let script = build_result_bridge_eval_script(
            "bridge-1",
            r#"return await window.__AI_DRAWIO_SHELL__.documentBridge.getDocument();"#,
        )
        .expect("result bridge script should be built");

        assert!(script.contains("report_bridge_result"));
        assert!(script.contains("bridge-1"));
        assert!(script.contains("window.__TAURI_INTERNALS__"));
        assert!(script.contains("documentBridge.getDocument"));
    }

    #[test]
    fn request_requires_a_non_empty_method_path() {
        let request = CallRequest {
            method_path: String::new(),
            args: json!([]),
        };

        assert!(request.validate().is_err());
    }

    #[test]
    fn eval_request_requires_a_non_empty_script() {
        let request = EvalRequest {
            script: String::from(" "),
        };

        assert!(request.validate().is_err());
    }

    #[test]
    fn result_bridge_builder_rejects_empty_request_id() {
        let error = build_result_bridge_eval_script("", "return 1;")
            .expect_err("empty request id must fail");

        assert!(error.contains("request id"));
    }
}
