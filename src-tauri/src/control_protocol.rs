use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const DEFAULT_TIMEOUT_MS: u64 = 15_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CommandKind {
    ConversationCreate,
    SessionList,
    SessionOpen,
    Status,
    CanvasDocumentApply,
    CanvasDocumentGet,
    CanvasDocumentPreview,
    CanvasDocumentRestore,
    CanvasDocumentSvg,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandSource {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub r#type: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ControlRequest {
    pub command: String,
    #[serde(default = "default_payload")]
    pub payload: Value,
    pub request_id: String,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub source: Option<CommandSource>,
    #[serde(default = "default_timeout_ms")]
    pub timeout_ms: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ControlResponse {
    pub command: String,
    pub data: Option<Value>,
    pub error: Option<ControlError>,
    pub ok: bool,
    pub request_id: String,
    pub session_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ControlError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
}

impl ControlRequest {
    pub fn command_kind(&self) -> Result<CommandKind, ControlError> {
        match self.command.trim() {
            "canvas.document.apply" => Ok(CommandKind::CanvasDocumentApply),
            "canvas.document.get" => Ok(CommandKind::CanvasDocumentGet),
            "canvas.document.preview" => Ok(CommandKind::CanvasDocumentPreview),
            "canvas.document.restore" => Ok(CommandKind::CanvasDocumentRestore),
            "canvas.document.svg" => Ok(CommandKind::CanvasDocumentSvg),
            "conversation.create" => Ok(CommandKind::ConversationCreate),
            "session.list" => Ok(CommandKind::SessionList),
            "session.open" => Ok(CommandKind::SessionOpen),
            "status" => Ok(CommandKind::Status),
            _ => Err(ControlError::new(
                "UNSUPPORTED_COMMAND",
                format!("unsupported command '{}'", self.command),
            )),
        }
    }

    pub fn require_session_id(&self) -> Result<&str, ControlError> {
        let session_id = self
            .session_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                ControlError::new(
                    "VALIDATION_FAILED",
                    format!("command '{}' requires sessionId", self.command),
                )
            })?;

        Ok(session_id)
    }

    pub fn validated_timeout_ms(&self) -> u64 {
        self.timeout_ms.clamp(1_000, 120_000)
    }

    pub fn validate(&self) -> Result<CommandKind, ControlError> {
        if self.request_id.trim().is_empty() {
            return Err(ControlError::new(
                "VALIDATION_FAILED",
                "requestId cannot be empty",
            ));
        }

        let command_kind = self.command_kind()?;

        match command_kind {
            CommandKind::CanvasDocumentApply => {
                self.require_session_id()?;

                let xml = self
                    .payload
                    .get("xml")
                    .and_then(Value::as_str)
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .ok_or_else(|| {
                        ControlError::new("DOCUMENT_INVALID", "payload.xml cannot be empty")
                    })?;

                if xml.is_empty() {
                    return Err(ControlError::new(
                        "DOCUMENT_INVALID",
                        "payload.xml cannot be empty",
                    ));
                }

                if let Some(prompt) = self.payload.get("prompt") {
                    let prompt = prompt.as_str().map(str::trim).ok_or_else(|| {
                        ControlError::new("VALIDATION_FAILED", "payload.prompt must be a string")
                    })?;

                    if prompt.is_empty() {
                        return Err(ControlError::new(
                            "VALIDATION_FAILED",
                            "payload.prompt cannot be empty",
                        ));
                    }
                }
            }
            CommandKind::CanvasDocumentPreview => {
                self.require_session_id()?;

                if let Some(page) = self.payload.get("page") {
                    let page = page.as_u64().ok_or_else(|| {
                        ControlError::new(
                            "VALIDATION_FAILED",
                            "payload.page must be a positive integer",
                        )
                    })?;

                    if page == 0 {
                        return Err(ControlError::new(
                            "VALIDATION_FAILED",
                            "payload.page must be greater than 0",
                        ));
                    }
                }
            }
            CommandKind::CanvasDocumentRestore => {
                self.require_session_id()?;

                let xml = self
                    .payload
                    .get("xml")
                    .and_then(Value::as_str)
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .ok_or_else(|| {
                        ControlError::new("DOCUMENT_INVALID", "payload.xml cannot be empty")
                    })?;

                if xml.is_empty() {
                    return Err(ControlError::new(
                        "DOCUMENT_INVALID",
                        "payload.xml cannot be empty",
                    ));
                }
            }
            CommandKind::CanvasDocumentGet
            | CommandKind::CanvasDocumentSvg
            | CommandKind::SessionOpen => {
                self.require_session_id()?;
            }
            CommandKind::ConversationCreate | CommandKind::SessionList | CommandKind::Status => {}
        }

        Ok(command_kind)
    }
}

impl ControlError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            details: None,
            message: message.into(),
        }
    }

    pub fn with_details(mut self, details: Value) -> Self {
        self.details = Some(details);
        self
    }
}

impl ControlResponse {
    pub fn error(request: &ControlRequest, error: ControlError) -> Self {
        Self {
            command: request.command.clone(),
            data: None,
            error: Some(error),
            ok: false,
            request_id: request.request_id.clone(),
            session_id: request.session_id.clone(),
        }
    }

    pub fn success(request: &ControlRequest, data: Value) -> Self {
        Self {
            command: request.command.clone(),
            data: Some(data),
            error: None,
            ok: true,
            request_id: request.request_id.clone(),
            session_id: request.session_id.clone(),
        }
    }
}

fn default_payload() -> Value {
    Value::Object(Default::default())
}

fn default_timeout_ms() -> u64 {
    DEFAULT_TIMEOUT_MS
}

#[cfg(test)]
mod tests {
    use super::{CommandKind, ControlRequest, DEFAULT_TIMEOUT_MS};
    use serde_json::json;

    fn base_request(command: &str) -> ControlRequest {
        ControlRequest {
            command: command.to_string(),
            payload: json!({}),
            request_id: "req-1".to_string(),
            session_id: None,
            source: None,
            timeout_ms: DEFAULT_TIMEOUT_MS,
        }
    }

    #[test]
    fn rejects_unsupported_commands() {
        let request = base_request("canvas.unknown");
        let error = request
            .validate()
            .expect_err("unsupported command must fail");

        assert_eq!(error.code, "UNSUPPORTED_COMMAND");
    }

    #[test]
    fn rejects_open_command() {
        let request = base_request("open");
        let error = request.validate().expect_err("open command must fail");

        assert_eq!(error.code, "UNSUPPORTED_COMMAND");
    }

    #[test]
    fn requires_xml_payload_for_document_apply() {
        let mut request = base_request("canvas.document.apply");
        request.session_id = Some("sess-1".to_string());

        let error = request
            .validate()
            .expect_err("missing xml payload must fail");

        assert_eq!(error.code, "DOCUMENT_INVALID");
    }

    #[test]
    fn requires_session_id_for_session_commands() {
        let request = base_request("session.open");
        let error = request
            .validate()
            .expect_err("missing session id must fail");

        assert_eq!(error.code, "VALIDATION_FAILED");
    }

    #[test]
    fn validates_document_get_requests() {
        let mut request = base_request("canvas.document.get");
        request.session_id = Some("sess-1".to_string());

        let command = request.validate().expect("request should validate");

        assert_eq!(command, CommandKind::CanvasDocumentGet);
    }

    #[test]
    fn validates_document_restore_requests() {
        let mut request = base_request("canvas.document.restore");
        request.session_id = Some("sess-1".to_string());
        request.payload = json!({
            "xml": "<mxGraphModel />"
        });

        let command = request.validate().expect("request should validate");

        assert_eq!(command, CommandKind::CanvasDocumentRestore);
    }

    #[test]
    fn validates_document_svg_requests() {
        let mut request = base_request("canvas.document.svg");
        request.session_id = Some("sess-1".to_string());

        let command = request.validate().expect("request should validate");

        assert_eq!(command, CommandKind::CanvasDocumentSvg);
    }

    #[test]
    fn validates_document_preview_requests() {
        let mut request = base_request("canvas.document.preview");
        request.session_id = Some("sess-1".to_string());
        request.payload = json!({
            "page": 2
        });

        let command = request.validate().expect("request should validate");

        assert_eq!(command, CommandKind::CanvasDocumentPreview);
    }

    #[test]
    fn rejects_document_preview_requests_with_zero_page() {
        let mut request = base_request("canvas.document.preview");
        request.session_id = Some("sess-1".to_string());
        request.payload = json!({
            "page": 0
        });

        let error = request
            .validate()
            .expect_err("page zero should fail validation");

        assert_eq!(error.code, "VALIDATION_FAILED");
    }

    #[test]
    fn uses_the_default_timeout() {
        let request = base_request("status");
        assert_eq!(request.timeout_ms, DEFAULT_TIMEOUT_MS);
    }

    #[test]
    fn validates_conversation_create_requests() {
        let request = base_request("conversation.create");

        let command = request.validate().expect("request should validate");

        assert_eq!(command, CommandKind::ConversationCreate);
    }

    #[test]
    fn rejects_session_ensure_requests() {
        let request = base_request("session.ensure");
        let error = request
            .validate()
            .expect_err("session ensure should be unsupported");

        assert_eq!(error.code, "UNSUPPORTED_COMMAND");
    }

    #[test]
    fn validates_session_list_requests() {
        let request = base_request("session.list");

        let command = request.validate().expect("request should validate");

        assert_eq!(command, CommandKind::SessionList);
    }

    #[test]
    fn rejects_session_get_requests() {
        let mut request = base_request("session.get");
        request.session_id = Some("sess-1".to_string());
        let error = request
            .validate()
            .expect_err("session get should be unsupported");

        assert_eq!(error.code, "UNSUPPORTED_COMMAND");
    }
}
