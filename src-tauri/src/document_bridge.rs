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

pub fn export_svg_pages(
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
return await window.__AI_DRAWIO_SHELL__.documentBridge.exportSvgPages();
"#,
        timeout,
    )
    .map_err(|error| ControlError::new("DOCUMENT_NOT_AVAILABLE", error))?;

    build_svg_pages_payload(value, &state)
}

pub fn export_preview_pages(
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
return await window.__AI_DRAWIO_SHELL__.documentBridge.exportPreviewPages();
"#,
        timeout,
    )
    .map_err(|error| ControlError::new("DOCUMENT_NOT_AVAILABLE", error))?;

    build_preview_pages_payload(value, &state)
}

pub fn apply_document(
    app: &AppHandle,
    bridge_state: &ScriptResultBridgeState,
    session_id: &str,
    xml: &str,
    base_version: Option<&str>,
    prompt: Option<&str>,
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
    let prompt_json = serde_json::to_string(prompt.unwrap_or_default())
        .map_err(|error| ControlError::new("INTERNAL_ERROR", error.to_string()))?;

    let value = eval_main_window_script_with_result(
        app,
        bridge_state,
        &format!(
            r#"
return await window.__AI_DRAWIO_SHELL__.documentBridge.applyDocument({{ prompt: {prompt_json}, xml: {xml_json} }});
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

pub fn apply_document_without_history(
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
return await window.__AI_DRAWIO_SHELL__.documentBridge.applyDocumentWithoutHistory({xml_json});
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

fn build_svg_pages_payload(value: Value, state: &ShellState) -> Result<Value, ControlError> {
    let pages = value
        .get("pages")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            ControlError::new(
                "DOCUMENT_NOT_AVAILABLE",
                "document svg pages are missing from the bridge response",
            )
        })?;

    if pages.is_empty() {
        return Err(ControlError::new(
            "DOCUMENT_NOT_AVAILABLE",
            "document svg export returned no pages",
        ));
    }

    let normalized_pages = pages
        .iter()
        .enumerate()
        .map(|(index, page)| {
            let id = page
                .get("id")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .unwrap_or_else(|| format!("page-{}", index + 1));
            let name = page
                .get("name")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .unwrap_or_else(|| format!("Page {}", index + 1));
            let svg = page
                .get("svg")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .ok_or_else(|| {
                    ControlError::new(
                        "DOCUMENT_NOT_AVAILABLE",
                        "document svg export page is missing svg text",
                    )
                })?;

            Ok(json!({
                "id": id,
                "name": name,
                "svg": svg
            }))
        })
        .collect::<Result<Vec<_>, ControlError>>()?;

    let timestamp = value
        .get("exportedAt")
        .and_then(Value::as_str)
        .unwrap_or_default();

    Ok(json!({
        "bridgeState": {
            "bridgeReady": state.bridge_ready,
            "frameReady": state.frame_ready,
            "route": state.route,
            "sessionId": state.session_id
        },
        "pages": normalized_pages,
        "timestamp": timestamp
    }))
}

fn build_preview_pages_payload(value: Value, state: &ShellState) -> Result<Value, ControlError> {
    let pages = value
        .get("pages")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            ControlError::new(
                "DOCUMENT_NOT_AVAILABLE",
                "document preview pages are missing from the bridge response",
            )
        })?;

    if pages.is_empty() {
        return Err(ControlError::new(
            "DOCUMENT_NOT_AVAILABLE",
            "document preview export returned no pages",
        ));
    }

    let normalized_pages = pages
        .iter()
        .enumerate()
        .map(|(index, page)| {
            let id = page
                .get("id")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .unwrap_or_else(|| format!("page-{}", index + 1));
            let name = page
                .get("name")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .unwrap_or_else(|| format!("Page {}", index + 1));
            let png_data_uri = page
                .get("pngDataUri")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .filter(|value| value.starts_with("data:image/png"))
                .map(str::to_string)
                .ok_or_else(|| {
                    ControlError::new(
                        "DOCUMENT_NOT_AVAILABLE",
                        "document preview export page is missing png data",
                    )
                })?;

            Ok(json!({
                "id": id,
                "name": name,
                "pngDataUri": png_data_uri
            }))
        })
        .collect::<Result<Vec<_>, ControlError>>()?;

    let timestamp = value
        .get("exportedAt")
        .and_then(Value::as_str)
        .unwrap_or_default();

    Ok(json!({
        "bridgeState": {
            "bridgeReady": state.bridge_ready,
            "frameReady": state.frame_ready,
            "route": state.route,
            "sessionId": state.session_id
        },
        "pages": normalized_pages,
        "timestamp": timestamp
    }))
}

pub fn hash_xml(xml: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(xml.as_bytes());
    format!("sha256:{:x}", hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::{build_preview_pages_payload, build_svg_pages_payload, hash_xml};
    use crate::session_runtime::ShellState;
    use serde_json::json;

    #[test]
    fn hashes_xml_with_sha256_prefix() {
        let hash = hash_xml("<mxGraphModel />");
        assert!(hash.starts_with("sha256:"));
        assert!(hash.len() > "sha256:".len());
    }

    #[test]
    fn builds_svg_pages_payload_with_bridge_metadata() {
        let payload = build_svg_pages_payload(
            json!({
                "exportedAt": "2026-03-17T00:00:00.000Z",
                "pages": [
                    {
                        "id": "page-1",
                        "name": "Page 1",
                        "svg": "<svg><text>one</text></svg>"
                    }
                ]
            }),
            &ShellState {
                bootstrap_error: None,
                bridge_ready: true,
                conversation_loaded: true,
                document_loaded: true,
                frame_ready: true,
                last_event: "ready".to_string(),
                route: "/session?id=sess-1".to_string(),
                session_id: "sess-1".to_string(),
            },
        )
        .expect("svg payload should build");

        assert_eq!(payload["pages"][0]["id"], "page-1");
        assert_eq!(payload["pages"][0]["svg"], "<svg><text>one</text></svg>");
        assert_eq!(payload["bridgeState"]["sessionId"], "sess-1");
        assert_eq!(payload["timestamp"], "2026-03-17T00:00:00.000Z");
    }

    #[test]
    fn builds_preview_pages_payload_with_bridge_metadata() {
        let payload = build_preview_pages_payload(
            json!({
                "exportedAt": "2026-03-19T00:00:00.000Z",
                "pages": [
                    {
                        "id": "page-1",
                        "name": "Page 1",
                        "pngDataUri": "data:image/png;base64,cG5n"
                    }
                ]
            }),
            &ShellState {
                bootstrap_error: None,
                bridge_ready: true,
                conversation_loaded: true,
                document_loaded: true,
                frame_ready: true,
                last_event: "ready".to_string(),
                route: "/session?id=sess-1".to_string(),
                session_id: "sess-1".to_string(),
            },
        )
        .expect("preview payload should build");

        assert_eq!(payload["pages"][0]["id"], "page-1");
        assert_eq!(payload["pages"][0]["pngDataUri"], "data:image/png;base64,cG5n");
        assert_eq!(payload["bridgeState"]["sessionId"], "sess-1");
        assert_eq!(payload["timestamp"], "2026-03-19T00:00:00.000Z");
    }
}
