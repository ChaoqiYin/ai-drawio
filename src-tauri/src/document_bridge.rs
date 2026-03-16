use crate::control_protocol::ControlError;
use crate::session_runtime::{require_active_session, ShellState};
use crate::webview_api::{eval_main_window_script_with_result, ScriptResultBridgeState};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::time::Duration;
use tauri::AppHandle;

pub fn get_document(
    app: &AppHandle,
    bridge_state: &ScriptResultBridgeState,
    session_id: &str,
    timeout: Duration,
) -> Result<Value, ControlError> {
    let state = require_active_session(app, bridge_state, session_id, timeout)?;
    let value = eval_main_window_script_with_result(
        app,
        bridge_state,
        r#"
return await window.__AI_DRAWIO_SHELL__.documentBridge.getDocument();
"#,
        timeout,
    )
    .map_err(|error| ControlError::new("DOCUMENT_NOT_AVAILABLE", error))?;

    build_document_payload(value, &state)
}

pub fn apply_document(
    app: &AppHandle,
    bridge_state: &ScriptResultBridgeState,
    session_id: &str,
    xml: &str,
    base_version: Option<&str>,
    timeout: Duration,
) -> Result<Value, ControlError> {
    if xml.trim().is_empty() {
        return Err(ControlError::new(
            "DOCUMENT_INVALID",
            "xml cannot be empty",
        ));
    }

    let state = require_active_session(app, bridge_state, session_id, timeout)?;
    let current_document = get_document(app, bridge_state, session_id, timeout)?;
    let current_version = current_document
        .get("version")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();

    if let Some(expected_version) = base_version {
        if !expected_version.trim().is_empty() && expected_version != current_version {
            return Err(ControlError::new(
                "DOCUMENT_VERSION_MISMATCH",
                "baseVersion does not match the current document",
            )
            .with_details(json!({
                "expected": current_version,
                "received": expected_version
            })));
        }
    }

    let xml_json =
        serde_json::to_string(xml).map_err(|error| ControlError::new("INTERNAL_ERROR", error.to_string()))?;

    let value = eval_main_window_script_with_result(
        app,
        bridge_state,
        &format!(
            r#"
return await window.__AI_DRAWIO_SHELL__.documentBridge.applyDocument({{ xml: {xml_json} }});
"#
        ),
        timeout,
    )
    .map_err(|error| ControlError::new("CANVAS_ACTION_FAILED", error))?;

    let mut payload = build_document_payload(value, &state)?;
    if let Some(object) = payload.as_object_mut() {
        object.insert("previousVersion".to_string(), Value::String(current_version));
    }

    Ok(payload)
}

fn build_document_payload(value: Value, state: &ShellState) -> Result<Value, ControlError> {
    let xml = value
        .get("xml")
        .and_then(Value::as_str)
        .map(str::to_string)
        .filter(|payload| !payload.trim().is_empty())
        .ok_or_else(|| {
            ControlError::new("DOCUMENT_NOT_AVAILABLE", "document xml is missing from the bridge response")
        })?;

    let timestamp = value
        .get("appliedAt")
        .or_else(|| value.get("readAt"))
        .and_then(Value::as_str)
        .unwrap_or_default();

    Ok(json!({
        "bridgeState": {
            "bridgeReady": state.bridge_ready,
            "frameReady": state.frame_ready,
            "route": state.route,
            "sessionId": state.session_id
        },
        "timestamp": timestamp,
        "version": hash_xml(&xml),
        "xml": xml
    }))
}

pub fn hash_xml(xml: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(xml.as_bytes());
    format!("sha256:{:x}", hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::hash_xml;

    #[test]
    fn hashes_xml_with_sha256_prefix() {
        let hash = hash_xml("<mxGraphModel />");
        assert!(hash.starts_with("sha256:"));
        assert!(hash.len() > "sha256:".len());
    }
}
