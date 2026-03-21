use crate::cli_schema::build_cli_command;
use crate::control_protocol::{CommandSource, ControlError, ControlRequest, ControlResponse};
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use clap::ArgMatches;
use serde_json::{json, Map, Value};
use std::env;
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
#[cfg(unix)]
use std::os::unix::net::UnixStream;
use std::path::Path;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
#[cfg(test)]
use std::time::Instant;

const CLI_SOURCE_NAME: &str = "ai-drawio";
const CONTROL_TIMEOUT_MS: u64 = 20_000;
const SESSION_CREATE_TIMEOUT_MS: u64 = 60_000;
const SESSION_CREATE_OPEN_TIMEOUT_MS: u64 = 10_000;
const STATUS_TIMEOUT_MS: u64 = 5_000;
const CONTROL_SOCKET_TIMEOUT_GRACE_MS: u64 = 2_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PackagedCliCommand {
    Status {
        session_id: String,
    },
    SessionCreate,
    SessionList,
    SessionClose {
        session_id: String,
    },
    SessionOpen {
        session_id: String,
    },
    CanvasDocumentGet {
        session_id: String,
        output_file: Option<String>,
    },
    CanvasDocumentSvg {
        session_id: String,
        output_file: Option<String>,
    },
    CanvasDocumentPreview {
        session_id: String,
        output_directory: String,
        page: Option<usize>,
    },
    CanvasDocumentApply {
        session_id: String,
        xml: Option<String>,
        xml_file: Option<String>,
        xml_stdin: bool,
        base_version: Option<String>,
        prompt: Option<String>,
        output_file: Option<String>,
    },
    CanvasDocumentRestore {
        session_id: String,
        xml: Option<String>,
        xml_file: Option<String>,
        xml_stdin: bool,
        base_version: Option<String>,
    },
}

fn should_run_cli_from_args(args: &[String]) -> bool {
    !args.is_empty()
}

pub fn maybe_run_from_env() -> Option<i32> {
    let args = env::args().skip(1).collect::<Vec<_>>();
    if !should_run_cli_from_args(&args) {
        return None;
    }

    let exit_code =
        match parse_cli_args_from_strings(&args).and_then(|command| execute_cli(&command)) {
            Ok(response) => {
                print_json_response(&response);
                if response.ok {
                    0
                } else {
                    1
                }
            }
            Err(message) => {
                print_json_value(&json!({
                    "ok": false,
                    "error": {
                        "code": "CLI_ERROR",
                        "message": message
                    }
                }));
                1
            }
        };

    Some(exit_code)
}

#[cfg(test)]
pub fn parse_cli_args(args: &[&str]) -> Result<PackagedCliCommand, String> {
    let owned_args = args
        .iter()
        .map(|value| (*value).to_string())
        .collect::<Vec<_>>();
    parse_cli_args_from_strings(&owned_args)
}

pub fn parse_cli_args_from_strings(args: &[String]) -> Result<PackagedCliCommand, String> {
    let mut argv = vec![CLI_SOURCE_NAME.to_string()];
    argv.extend(args.iter().cloned());

    let matches = build_cli_command()
        .try_get_matches_from(argv)
        .map_err(|error| error.to_string())?;

    parse_matches(&matches)
}

fn parse_matches(matches: &ArgMatches) -> Result<PackagedCliCommand, String> {
    match matches.subcommand() {
        Some(("status", _)) => Ok(PackagedCliCommand::Status {
            session_id: String::new(),
        }),
        Some(("session", submatches)) => match submatches.subcommand() {
            Some(("create", _)) => Ok(PackagedCliCommand::SessionCreate),
            Some(("list", _)) => Ok(PackagedCliCommand::SessionList),
            Some(("status", status_matches)) => Ok(PackagedCliCommand::Status {
                session_id: required_string_arg(status_matches, "session-id")?,
            }),
            Some(("close", close_matches)) => Ok(PackagedCliCommand::SessionClose {
                session_id: required_string_arg(close_matches, "session-id")?,
            }),
            Some(("open", open_matches)) => Ok(PackagedCliCommand::SessionOpen {
                session_id: required_string_arg(open_matches, "session-id")?,
            }),
            _ => Err("session only supports create, list, status, close or open".to_string()),
        },
        Some(("canvas", submatches)) => match submatches.subcommand() {
            Some(("document.get", get_matches)) => Ok(PackagedCliCommand::CanvasDocumentGet {
                session_id: required_string_arg(get_matches, "session-id")?,
                output_file: string_arg(get_matches, "output-file"),
            }),
            Some(("document.svg", svg_matches)) => Ok(PackagedCliCommand::CanvasDocumentSvg {
                session_id: required_string_arg(svg_matches, "session-id")?,
                output_file: string_arg(svg_matches, "output-file"),
            }),
            Some(("document.preview", preview_matches)) => {
                Ok(PackagedCliCommand::CanvasDocumentPreview {
                    session_id: required_string_arg(preview_matches, "session-id")?,
                    output_directory: required_string_arg(preview_matches, "output-directory")?,
                    page: optional_positive_usize_arg(preview_matches, "page")?,
                })
            }
            Some(("document.apply", apply_matches)) => Ok(PackagedCliCommand::CanvasDocumentApply {
                session_id: required_string_arg(apply_matches, "session-id")?,
                xml: string_arg(apply_matches, "xml"),
                xml_file: string_arg(apply_matches, "xml-file"),
                xml_stdin: apply_matches.get_flag("xml-stdin"),
                base_version: string_arg(apply_matches, "base-version"),
                prompt: string_arg(apply_matches, "prompt"),
                output_file: string_arg(apply_matches, "output-file"),
            }),
            Some(("document.restore", restore_matches)) => {
                Ok(PackagedCliCommand::CanvasDocumentRestore {
                    session_id: required_string_arg(restore_matches, "session-id")?,
                    xml: string_arg(restore_matches, "xml"),
                    xml_file: string_arg(restore_matches, "xml-file"),
                    xml_stdin: restore_matches.get_flag("xml-stdin"),
                    base_version: string_arg(restore_matches, "base-version"),
                })
            }
            _ => Err(
                "canvas only supports document.get, document.svg, document.preview, document.apply or document.restore"
                    .to_string(),
            ),
        },
        _ => Err("missing command".to_string()),
    }
}

pub fn build_resolution_request(command: &PackagedCliCommand) -> Option<ControlRequest> {
    let session_id = match command {
        PackagedCliCommand::CanvasDocumentGet { session_id, .. } => Some(session_id.as_str()),
        PackagedCliCommand::CanvasDocumentSvg { session_id, .. } => Some(session_id.as_str()),
        PackagedCliCommand::CanvasDocumentPreview { session_id, .. } => Some(session_id.as_str()),
        PackagedCliCommand::CanvasDocumentApply { session_id, .. } => Some(session_id.as_str()),
        PackagedCliCommand::CanvasDocumentRestore { session_id, .. } => Some(session_id.as_str()),
        _ => None,
    }?;

    Some(build_request(
        "session.open",
        Some(session_id.to_string()),
        json!({}),
        CONTROL_TIMEOUT_MS,
    ))
}

pub fn build_request_for_command(
    command: &PackagedCliCommand,
    session_id: Option<String>,
) -> Result<ControlRequest, String> {
    match command {
        PackagedCliCommand::Status { session_id } => Ok(build_request(
            "status",
            {
                let session_id = session_id.trim();
                if session_id.is_empty() {
                    None
                } else {
                    Some(session_id.to_string())
                }
            },
            json!({}),
            STATUS_TIMEOUT_MS,
        )),
        PackagedCliCommand::SessionCreate => {
            Err("session.create is orchestrated by the CLI".to_string())
        }
        PackagedCliCommand::SessionList => Ok(build_request(
            "session.list",
            None,
            json!({}),
            CONTROL_TIMEOUT_MS,
        )),
        PackagedCliCommand::SessionClose { session_id } => Ok(build_request(
            "session.close",
            Some(session_id.to_string()),
            json!({}),
            CONTROL_TIMEOUT_MS,
        )),
        PackagedCliCommand::SessionOpen { session_id } => Ok(build_request(
            "session.open",
            Some(session_id.to_string()),
            json!({}),
            CONTROL_TIMEOUT_MS,
        )),
        PackagedCliCommand::CanvasDocumentGet { .. } => Ok(build_request(
            "canvas.document.get",
            session_id,
            json!({}),
            CONTROL_TIMEOUT_MS,
        )),
        PackagedCliCommand::CanvasDocumentSvg { .. } => Ok(build_request(
            "canvas.document.svg",
            session_id,
            json!({}),
            CONTROL_TIMEOUT_MS,
        )),
        PackagedCliCommand::CanvasDocumentPreview { page, .. } => {
            let mut payload = Map::new();

            if let Some(page) = page {
                payload.insert("page".to_string(), json!(page));
            }

            Ok(build_request(
                "canvas.document.preview",
                session_id,
                Value::Object(payload),
                CONTROL_TIMEOUT_MS,
            ))
        }
        PackagedCliCommand::CanvasDocumentApply {
            xml,
            xml_file,
            xml_stdin,
            base_version,
            prompt,
            ..
        } => {
            let xml = if let Some(xml) = xml {
                xml.to_string()
            } else if *xml_stdin {
                read_stdin()?
            } else if let Some(xml_file) = xml_file {
                fs::read_to_string(xml_file)
                    .map_err(|error| format!("failed to read xml file '{xml_file}': {error}"))?
            } else {
                return Err(
                    "canvas document.apply requires exactly one xml input mode: <xml>, --xml-file <path>, or --xml-stdin".to_string(),
                );
            };
            let prompt = require_apply_prompt(prompt)?;

            let mut payload = Map::from_iter([("xml".to_string(), Value::String(xml))]);

            if let Some(base_version) = base_version {
                payload.insert(
                    "baseVersion".to_string(),
                    Value::String(base_version.to_string()),
                );
            }

            payload.insert("prompt".to_string(), Value::String(prompt));

            Ok(build_request(
                "canvas.document.apply",
                session_id,
                Value::Object(payload),
                CONTROL_TIMEOUT_MS,
            ))
        }
        PackagedCliCommand::CanvasDocumentRestore {
            xml,
            xml_file,
            xml_stdin,
            base_version,
            ..
        } => {
            let xml = if let Some(xml) = xml {
                xml.to_string()
            } else if *xml_stdin {
                read_stdin()?
            } else if let Some(xml_file) = xml_file {
                fs::read_to_string(xml_file)
                    .map_err(|error| format!("failed to read xml file '{xml_file}': {error}"))?
            } else {
                return Err(
                    "canvas document.restore requires exactly one xml input mode: <xml>, --xml-file <path>, or --xml-stdin".to_string(),
                );
            };

            let mut payload = Map::from_iter([("xml".to_string(), Value::String(xml))]);

            if let Some(base_version) = base_version {
                payload.insert(
                    "baseVersion".to_string(),
                    Value::String(base_version.to_string()),
                );
            }

            Ok(build_request(
                "canvas.document.restore",
                session_id,
                Value::Object(payload),
                CONTROL_TIMEOUT_MS,
            ))
        }
    }
}

pub fn execute_cli(command: &PackagedCliCommand) -> Result<ControlResponse, String> {
    if !requires_running_app(command) {
        let requested_session_id = status_request_session_id(command);
        cli_debug_log(format!(
            "status start session_id={:?} exe={}",
            requested_session_id,
            std::env::current_exe()
                .map(|path| path.display().to_string())
                .unwrap_or_else(|error| format!("<current_exe_error:{error}>"))
        ));
        let mut response = match send_status_request(requested_session_id) {
            Ok(response) => {
                cli_debug_log(format!(
                    "status primary ok session_id={:?} running={:?} command={}",
                    requested_session_id,
                    response
                        .data
                        .as_ref()
                        .and_then(|value| value.get("running"))
                        .and_then(Value::as_bool),
                    response.command
                ));
                response
            }
            Err(primary_error) => {
                cli_debug_log(format!(
                    "status primary err session_id={:?} error={primary_error}",
                    requested_session_id
                ));
                if requested_session_id.is_some() {
                    match send_status_request(None) {
                        Ok(response) => {
                            cli_debug_log("status fallback ok session_id=None".to_string());
                            response
                        }
                        Err(error) => {
                            cli_debug_log(format!(
                                "status fallback err session_id=None error={error}"
                            ));
                            build_control_unreachable_response(
                                command_name(command),
                                requested_session_id,
                                &format!("{primary_error}; {error}"),
                            )
                        }
                    }
                } else {
                    build_control_unreachable_response(
                        command_name(command),
                        None,
                        &primary_error,
                    )
                }
            }
        };

        trim_status_response_data(command, &mut response)?;
        return Ok(response);
    }

    if send_status_request(None).is_err() {
        return Ok(build_app_not_running_response(command_name(command)));
    }

    if let PackagedCliCommand::SessionCreate = command {
        return execute_session_create();
    }

    if let Some(resolution_request) = build_resolution_request(command) {
        let resolution_response = send_control_request(&resolution_request)?;
        if !resolution_response.ok {
            Ok(resolution_response)
        } else {
            let session_id = extract_resolved_session_id(&resolution_response)?;
            let request = build_request_for_command(command, Some(session_id))?;
            let mut response = send_control_request(&request)?;
            maybe_write_output_file(command, &mut response)?;
            Ok(response)
        }
    } else {
        let request = build_request_for_command(command, None)?;
        let mut response = send_control_request(&request)?;
        maybe_write_output_file(command, &mut response)?;
        Ok(response)
    }
}

fn requires_running_app(command: &PackagedCliCommand) -> bool {
    !matches!(command, PackagedCliCommand::Status { .. })
}

fn execute_session_create() -> Result<ControlResponse, String> {
    let create_response = send_control_request(&build_session_create_request())?;

    if !create_response.ok {
        return Ok(relabel_response_command(create_response, "session.create"));
    }

    let session_id = extract_created_session_id(&create_response)?;
    let open_response = send_control_request(&build_session_create_open_request(session_id.clone()))?;

    if !open_response.ok {
        return Ok(relabel_response_command(open_response, "session.create"));
    }

    let mut response = relabel_response_command(create_response, "session.create");
    response.session_id = Some(session_id);

    Ok(response)
}

fn send_status_request(session_id: Option<&str>) -> Result<ControlResponse, String> {
    send_control_request(&build_request(
        "status",
        session_id.map(str::to_string),
        json!({}),
        STATUS_TIMEOUT_MS,
    ))
}

fn build_session_create_request() -> ControlRequest {
    build_request(
        "conversation.create",
        None,
        json!({}),
        SESSION_CREATE_TIMEOUT_MS,
    )
}

fn build_session_create_open_request(session_id: String) -> ControlRequest {
    build_request(
        "session.open",
        Some(session_id),
        json!({
            "activate": false
        }),
        SESSION_CREATE_OPEN_TIMEOUT_MS,
    )
}

#[cfg(test)]
fn wait_for_created_session_ready_with<F>(
    session_id: &str,
    timeout: Duration,
    poll_interval: Duration,
    mut open_session: F,
) -> Result<ControlResponse, String>
where
    F: FnMut(&str) -> Result<ControlResponse, String>,
{
    let started_at = Instant::now();
    let mut last_error: Option<String> = None;
    let mut last_response: Option<ControlResponse> = None;

    while started_at.elapsed() < timeout {
        match open_session(session_id) {
            Ok(response) if response.ok => return Ok(response),
            Ok(response) => {
                let retryable = response
                    .error
                    .as_ref()
                    .map(|error| {
                        matches!(
                            error.code.as_str(),
                            "APP_NOT_READY" | "COMMAND_TIMEOUT" | "SESSION_NOT_READY"
                        )
                    })
                    .unwrap_or(false);

                if !retryable {
                    return Ok(response);
                }

                last_response = Some(response);
            }
            Err(error) => last_error = Some(error),
        }

        std::thread::sleep(poll_interval);
    }

    if let Some(response) = last_response {
        return Ok(response);
    }

    let detail = last_error
        .map(|error| format!(": {error}"))
        .unwrap_or_default();

    Err(format!(
        "timed out while waiting for session '{session_id}' to become ready{detail}"
    ))
}

#[cfg(test)]
fn response_indicates_running(response: &ControlResponse) -> bool {
    response
        .data
        .as_ref()
        .and_then(|value| value.get("running"))
        .and_then(Value::as_bool)
        .unwrap_or(response.ok)
}

#[cfg(test)]
fn wait_for_app_running_with<F>(
    timeout: Duration,
    poll_interval: Duration,
    mut poll_status: F,
) -> Result<(), String>
where
    F: FnMut() -> Result<ControlResponse, String>,
{
    let started_at = Instant::now();
    let mut last_error: Option<String> = None;

    while started_at.elapsed() < timeout {
        match poll_status() {
            Ok(response) if response_indicates_running(&response) => return Ok(()),
            Ok(_) => {}
            Err(error) => last_error = Some(error),
        }

        std::thread::sleep(poll_interval);
    }

    let detail = last_error
        .map(|error| format!(": {error}"))
        .unwrap_or_default();

    Err(format!(
        "timed out while waiting for AI Drawio to finish starting{detail}"
    ))
}

#[cfg(test)]
fn build_status_not_running_response(session_id: Option<&str>) -> ControlResponse {
    let session = session_id.map(|session_id| {
        json!({
            "isReady": false,
            "sessionId": session_id,
            "status": "app-not-running"
        })
    });

    ControlResponse {
        command: "status".to_string(),
        data: Some(json!({
            "address": crate::control_server::CONTROL_ADDR,
            "running": false,
            "session": session,
            "shell": null
        })),
        error: None,
        ok: true,
        request_id: next_request_id(),
        session_id: session_id.map(str::to_string),
    }
}

fn build_control_unreachable_response(
    command: &str,
    session_id: Option<&str>,
    cause: &str,
) -> ControlResponse {
    let session = session_id.map(|session_id| {
        json!({
            "isReady": false,
            "sessionId": session_id,
            "status": "unavailable"
        })
    });

    ControlResponse {
        command: command.to_string(),
        data: Some(json!({
            "address": crate::control_server::CONTROL_ADDR,
            "running": false,
            "session": session,
            "shell": null,
            "socketPath": control_socket_path_json_value()
        })),
        error: Some(
            ControlError::new(
                "CONTROL_UNREACHABLE",
                "AI Drawio control channel is unreachable.",
            )
            .with_details(json!({
                "cause": cause
            })),
        ),
        ok: false,
        request_id: next_request_id(),
        session_id: session_id.map(str::to_string),
    }
}

fn trim_status_response_data(
    command: &PackagedCliCommand,
    response: &mut ControlResponse,
) -> Result<(), String> {
    let PackagedCliCommand::Status { session_id } = command else {
        return Ok(());
    };

    if session_id.trim().is_empty() {
        response.command = "status".to_string();

        if let Some(data) = response.data.as_ref() {
            response.data = Some(json!({
                "address": data.get("address").cloned().unwrap_or(Value::Null),
                "running": data.get("running").cloned().unwrap_or(Value::Bool(false))
            }));
        }

        response.session_id = None;
        return Ok(());
    }

    response.command = "session.status".to_string();

    let session = response
        .data
        .as_ref()
        .and_then(|value| value.get("session"))
        .cloned()
        .filter(|value| !value.is_null())
        .unwrap_or_else(|| synthesize_session_status_data(response, session_id));

    response.data = Some(session);
    response.session_id = Some(session_id.to_string());

    Ok(())
}

fn synthesize_session_status_data(response: &ControlResponse, session_id: &str) -> Value {
    if response
        .error
        .as_ref()
        .is_some_and(|error| error.code == "CONTROL_UNREACHABLE")
    {
        return json!({
            "isReady": false,
            "sessionId": session_id,
            "status": "unavailable"
        });
    }

    let running = response
        .data
        .as_ref()
        .and_then(|value| value.get("running"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let status = if running {
        "unavailable"
    } else {
        "app-not-running"
    };

    json!({
        "isReady": false,
        "sessionId": session_id,
        "status": status
    })
}

fn build_app_not_running_response(command: &str) -> ControlResponse {
    ControlResponse {
        command: command.to_string(),
        data: Some(json!({
            "address": crate::control_server::CONTROL_ADDR,
            "running": false
        })),
        error: Some(ControlError::new(
            "APP_NOT_RUNNING",
            "AI Drawio is not running.",
        )),
        ok: false,
        request_id: next_request_id(),
        session_id: None,
    }
}

fn send_control_request(request: &ControlRequest) -> Result<ControlResponse, String> {
    #[cfg(unix)]
    {
        let socket_path = crate::control_server::control_socket_path();
        let mut errors = Vec::new();

        match send_control_request_via_unix_socket(request, &socket_path) {
            Ok(response) => return Ok(response),
            Err(error) => errors.push(error),
        }

        match send_control_request_via_tcp(request) {
            Ok(response) => return Ok(response),
            Err(error) => errors.push(error),
        }

        return Err(errors.join(" | "));
    }

    #[cfg(not(unix))]
    {
        send_control_request_via_tcp(request)
    }
}

#[cfg(unix)]
fn send_control_request_via_unix_socket(
    request: &ControlRequest,
    socket_path: &Path,
) -> Result<ControlResponse, String> {
    cli_debug_log(format!(
        "send_control_request unix command={} session_id={:?} timeout_ms={} socket_path={}",
        request.command,
        request.session_id,
        request.timeout_ms,
        socket_path.display()
    ));
    let stream = UnixStream::connect(socket_path).map_err(|error| {
        let message = format!(
            "failed to connect to control socket '{}': {error}",
            socket_path.display()
        );
        cli_debug_log(format!(
            "send_control_request unix_connect_err command={} session_id={:?} error={message}",
            request.command, request.session_id
        ));
        message
    })?;
    let io_timeout = control_request_io_timeout(request);
    let _ = stream.set_read_timeout(Some(io_timeout));
    let _ = stream.set_write_timeout(Some(io_timeout));

    send_control_request_over_stream(stream, request)
}

fn send_control_request_via_tcp(request: &ControlRequest) -> Result<ControlResponse, String> {
    cli_debug_log(format!(
        "send_control_request tcp command={} session_id={:?} timeout_ms={}",
        request.command, request.session_id, request.timeout_ms
    ));
    let stream = TcpStream::connect(crate::control_server::CONTROL_ADDR).map_err(|error| {
        let message = format!("failed to connect to control server: {error}");
        cli_debug_log(format!(
            "send_control_request tcp_connect_err command={} session_id={:?} error={message}",
            request.command, request.session_id
        ));
        message
    })?;
    let io_timeout = control_request_io_timeout(request);
    let _ = stream.set_read_timeout(Some(io_timeout));
    let _ = stream.set_write_timeout(Some(io_timeout));

    send_control_request_over_stream(stream, request)
}

fn send_control_request_over_stream<S>(
    mut stream: S,
    request: &ControlRequest,
) -> Result<ControlResponse, String>
where
    S: Read + Write,
{
    let body = serde_json::to_vec(request)
        .map_err(|error| format!("failed to serialize control request: {error}"))?;
    let http_request = format!(
        "POST /control HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );

    stream
        .write_all(http_request.as_bytes())
        .and_then(|_| stream.write_all(&body))
        .map_err(|error| {
            let message = format!("failed to write control request: {error}");
            cli_debug_log(format!(
                "send_control_request write_err command={} session_id={:?} error={message}",
                request.command, request.session_id
            ));
            message
        })?;

    let response_body = read_control_response_body(stream).map_err(|error| {
        cli_debug_log(format!(
            "send_control_request read_err command={} session_id={:?} error={error}",
            request.command, request.session_id
        ));
        error
    })?;
    serde_json::from_slice(&response_body).map_err(|error| {
        let message = format!("failed to parse control response JSON: {error}");
        cli_debug_log(format!(
            "send_control_request parse_err command={} session_id={:?} error={message}",
            request.command, request.session_id
        ));
        message
    })
}

fn cli_debug_log(message: String) {
    let Some(path) = env::var_os("AI_DRAWIO_CLI_DEBUG_FILE") else {
        return;
    };

    let line = format!("{message}\n");
    let _ = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .and_then(|mut file| file.write_all(line.as_bytes()));
}

fn control_request_io_timeout(request: &ControlRequest) -> Duration {
    Duration::from_millis(
        request
            .validated_timeout_ms()
            .saturating_add(CONTROL_SOCKET_TIMEOUT_GRACE_MS),
    )
}

fn control_socket_path_json_value() -> Value {
    #[cfg(unix)]
    {
        return Value::String(crate::control_server::control_socket_path().display().to_string());
    }

    #[cfg(not(unix))]
    {
        Value::Null
    }
}

#[cfg(test)]
fn split_http_body(response: &[u8]) -> Option<&[u8]> {
    response
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .map(|index| &response[index + 4..])
}

fn read_control_response_body<S>(stream: S) -> Result<Vec<u8>, String>
where
    S: Read,
{
    let mut reader = BufReader::new(stream);
    let mut status_line = String::new();

    reader
        .read_line(&mut status_line)
        .map_err(|error| format!("failed to read control response status line: {error}"))?;

    if status_line.trim().is_empty() {
        return Err("control server returned an empty HTTP response".to_string());
    }

    let mut content_length = None;

    loop {
        let mut line = String::new();
        reader
            .read_line(&mut line)
            .map_err(|error| format!("failed to read control response headers: {error}"))?;

        if line == "\r\n" || line.is_empty() {
            break;
        }

        if let Some(value) = line.strip_prefix("Content-Length:") {
            let parsed = value
                .trim()
                .parse::<usize>()
                .map_err(|error| format!("invalid control response Content-Length header: {error}"))?;
            content_length = Some(parsed);
        }
    }

    let content_length = content_length
        .ok_or_else(|| "control server response is missing Content-Length".to_string())?;
    let mut body = vec![0u8; content_length];
    reader
        .read_exact(&mut body)
        .map_err(|error| format!("failed to read control response body: {error}"))?;

    Ok(body)
}

#[cfg(test)]
fn can_recover_control_response_after_read_error(
    error: &std::io::Error,
    response_bytes: &[u8],
) -> bool {
    !response_bytes.is_empty()
        && matches!(
            error.kind(),
            std::io::ErrorKind::TimedOut | std::io::ErrorKind::WouldBlock
        )
}

#[cfg(test)]
fn parse_control_response_bytes(response_bytes: &[u8]) -> Result<ControlResponse, String> {
    let body = split_http_body(response_bytes)
        .ok_or_else(|| "control server returned an invalid HTTP response".to_string())?;

    serde_json::from_slice(body)
        .map_err(|error| format!("failed to parse control response JSON: {error}"))
}

fn extract_resolved_session_id(response: &ControlResponse) -> Result<String, String> {
    if let Some(session_id) = response
        .data
        .as_ref()
        .and_then(|value| value.get("sessionId"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Ok(session_id.to_string());
    }

    if let Some(session_id) = response
        .session_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Ok(session_id.to_string());
    }

    Err("control response is missing a resolved session id".to_string())
}

fn extract_created_session_id(response: &ControlResponse) -> Result<String, String> {
    if let Some(session_id) = response
        .data
        .as_ref()
        .and_then(|value| value.get("id"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Ok(session_id.to_string());
    }

    extract_resolved_session_id(response)
}

fn relabel_response_command(mut response: ControlResponse, command: &str) -> ControlResponse {
    response.command = command.to_string();
    response
}

fn maybe_write_output_file(
    command: &PackagedCliCommand,
    response: &mut ControlResponse,
) -> Result<(), String> {
    if let PackagedCliCommand::CanvasDocumentPreview {
        output_directory,
        page,
        ..
    } = command
    {
        return maybe_write_preview_pages(output_directory, *page, response);
    }

    let output_file = match command {
        PackagedCliCommand::CanvasDocumentGet { output_file, .. } => output_file.as_ref(),
        PackagedCliCommand::CanvasDocumentSvg { output_file, .. } => output_file.as_ref(),
        PackagedCliCommand::CanvasDocumentApply { output_file, .. } => output_file.as_ref(),
        _ => None,
    };

    let Some(output_file) = output_file else {
        return Ok(());
    };

    if let Some(pages) = response
        .data
        .as_ref()
        .and_then(|value| value.get("pages"))
        .and_then(Value::as_array)
    {
        fs::create_dir_all(output_file).map_err(|error| {
            format!("failed to create output directory '{output_file}': {error}")
        })?;

        let mut updated_pages = Vec::with_capacity(pages.len());

        for (index, page) in pages.iter().enumerate() {
            let page_name = page
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .trim();
            let svg = page.get("svg").and_then(Value::as_str).unwrap_or_default();

            if svg.is_empty() {
                continue;
            }

            let file_name = build_svg_page_file_name(index, page_name);
            let output_path = format!("{output_file}/{file_name}");
            fs::write(&output_path, svg).map_err(|error| {
                format!("failed to write svg output file '{output_path}': {error}")
            })?;

            let mut updated_page = page.as_object().cloned().unwrap_or_default();
            updated_page.insert("outputPath".to_string(), Value::String(output_path));
            updated_pages.push(Value::Object(updated_page));
        }

        if let Some(Value::Object(data)) = response.data.as_mut() {
            data.insert("pages".to_string(), Value::Array(updated_pages));
        }

        return Ok(());
    }

    let Some(xml) = response
        .data
        .as_ref()
        .and_then(|value| value.get("xml"))
        .and_then(Value::as_str)
    else {
        return Ok(());
    };

    fs::write(output_file, xml)
        .map_err(|error| format!("failed to write output file '{output_file}': {error}"))
}

fn maybe_write_preview_pages(
    output_directory: &str,
    selected_page: Option<usize>,
    response: &mut ControlResponse,
) -> Result<(), String> {
    let Some(pages) = response
        .data
        .as_ref()
        .and_then(|value| value.get("pages"))
        .and_then(Value::as_array)
        .cloned()
    else {
        return Ok(());
    };
    let response_selected_page = response
        .data
        .as_ref()
        .and_then(|value| value.get("selectedPage"))
        .and_then(Value::as_u64)
        .map(|value| value as usize);
    let response_page_count = response
        .data
        .as_ref()
        .and_then(|value| value.get("pageCount"))
        .and_then(Value::as_u64)
        .map(|value| value as usize);

    let selected_indexes = if let Some(selected_page) = selected_page {
        if response_selected_page == Some(selected_page) {
            if pages.is_empty() {
                response.ok = false;
                response.data = None;
                response.error = Some(
                    ControlError::new(
                        "PAGE_OUT_OF_RANGE",
                        format!("requested page {selected_page} is out of range"),
                    )
                    .with_details(json!({
                        "requestedPage": selected_page,
                        "pageCount": response_page_count.unwrap_or(0)
                    })),
                );

                return Ok(());
            }

            (0..pages.len()).collect::<Vec<_>>()
        } else {
            if selected_page == 0 || selected_page > pages.len() {
                response.ok = false;
                response.data = None;
                response.error = Some(
                    ControlError::new(
                        "PAGE_OUT_OF_RANGE",
                        format!("requested page {selected_page} is out of range"),
                    )
                    .with_details(json!({
                        "requestedPage": selected_page,
                        "pageCount": pages.len()
                    })),
                );

                return Ok(());
            }

            vec![selected_page - 1]
        }
    } else {
        (0..pages.len()).collect::<Vec<_>>()
    };

    fs::create_dir_all(output_directory).map_err(|error| {
        format!("failed to create output directory '{output_directory}': {error}")
    })?;

    let mut updated_pages = Vec::with_capacity(selected_indexes.len());

    for index in selected_indexes {
        let page = &pages[index];
        let page_number = page
            .get("index")
            .and_then(Value::as_u64)
            .filter(|value| *value > 0)
            .map(|value| value as usize)
            .unwrap_or(index + 1);
        let page_name = page
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .trim();
        let png_data_uri = page
            .get("pngDataUri")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .trim();

        if png_data_uri.is_empty() {
            continue;
        }

        let png_bytes = decode_png_data_uri(png_data_uri)?;
        let file_name = build_preview_page_file_name(page_number - 1, page_name);
        let output_path = PathBuf::from(output_directory).join(file_name);
        fs::write(&output_path, png_bytes).map_err(|error| {
            format!(
                "failed to write preview output file '{}': {error}",
                output_path.display()
            )
        })?;

        let absolute_output_path = fs::canonicalize(&output_path)
            .unwrap_or(output_path.clone())
            .display()
            .to_string();

        let mut updated_page = page.as_object().cloned().unwrap_or_default();
        updated_page.remove("pngDataUri");
        updated_page.insert("index".to_string(), json!(page_number));
        updated_page.insert("path".to_string(), Value::String(absolute_output_path));
        updated_pages.push(Value::Object(updated_page));
    }

    if let Some(Value::Object(data)) = response.data.as_mut() {
        data.insert(
            "outputDir".to_string(),
            Value::String(
                fs::canonicalize(output_directory)
                    .unwrap_or_else(|_| PathBuf::from(output_directory))
                    .display()
                    .to_string(),
            ),
        );
        data.insert("pages".to_string(), Value::Array(updated_pages));
    }

    Ok(())
}

fn sanitize_svg_page_name(name: &str) -> String {
    name.trim()
        .replace(['\\', '/', ':', '*', '?', '"', '<', '>', '|'], "-")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim_matches('-')
        .to_string()
}

fn build_svg_page_file_name(index: usize, page_name: &str) -> String {
    let page_number = format!("{:02}", index + 1);
    let sanitized_name = sanitize_svg_page_name(page_name);

    if sanitized_name.is_empty() {
        format!("page-{page_number}.svg")
    } else {
        format!("{page_number}-{sanitized_name}.svg")
    }
}

fn build_preview_page_file_name(index: usize, page_name: &str) -> String {
    let page_number = format!("{:02}", index + 1);
    let sanitized_name = sanitize_svg_page_name(page_name);

    if sanitized_name.is_empty() {
        format!("page-{page_number}.png")
    } else {
        format!("{page_number}-{sanitized_name}.png")
    }
}

fn decode_png_data_uri(data_uri: &str) -> Result<Vec<u8>, String> {
    let Some((header, encoded)) = data_uri.split_once(',') else {
        return Err("preview png data uri is invalid".to_string());
    };

    if !header.starts_with("data:image/png") {
        return Err("preview png data uri must start with data:image/png".to_string());
    }

    if header.contains(";base64") {
        return BASE64_STANDARD
            .decode(encoded)
            .map_err(|error| format!("failed to decode preview png data: {error}"));
    }

    Ok(encoded.as_bytes().to_vec())
}

fn require_apply_prompt(prompt: &Option<String>) -> Result<String, String> {
    prompt
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| "canvas document.apply requires positional <prompt>".to_string())
}

fn read_stdin() -> Result<String, String> {
    let mut buffer = String::new();
    std::io::stdin()
        .read_to_string(&mut buffer)
        .map_err(|error| format!("failed to read stdin: {error}"))?;

    Ok(buffer)
}

fn build_request(
    command: &str,
    session_id: Option<String>,
    payload: Value,
    timeout_ms: u64,
) -> ControlRequest {
    ControlRequest {
        command: command.to_string(),
        payload,
        request_id: next_request_id(),
        session_id,
        source: Some(CommandSource {
            name: CLI_SOURCE_NAME.to_string(),
            r#type: "cli".to_string(),
        }),
        timeout_ms,
    }
}

fn command_name(command: &PackagedCliCommand) -> &'static str {
    match command {
        PackagedCliCommand::Status { .. } => "status",
        PackagedCliCommand::SessionCreate => "session.create",
        PackagedCliCommand::SessionList => "session.list",
        PackagedCliCommand::SessionClose { .. } => "session.close",
        PackagedCliCommand::SessionOpen { .. } => "session.open",
        PackagedCliCommand::CanvasDocumentGet { .. } => "canvas.document.get",
        PackagedCliCommand::CanvasDocumentSvg { .. } => "canvas.document.svg",
        PackagedCliCommand::CanvasDocumentPreview { .. } => "canvas.document.preview",
        PackagedCliCommand::CanvasDocumentApply { .. } => "canvas.document.apply",
        PackagedCliCommand::CanvasDocumentRestore { .. } => "canvas.document.restore",
    }
}

fn status_request_session_id(command: &PackagedCliCommand) -> Option<&str> {
    match command {
        PackagedCliCommand::Status { session_id } => {
            let session_id = session_id.trim();
            if session_id.is_empty() {
                None
            } else {
                Some(session_id)
            }
        }
        _ => None,
    }
}

fn next_request_id() -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("cli-{timestamp}")
}

fn print_json_response(response: &ControlResponse) {
    let value = serde_json::to_value(response).unwrap_or_else(|_| {
        json!({
            "ok": false,
            "error": {
                "code": "CLI_ERROR",
                "message": "failed to serialize CLI response"
            }
        })
    });
    print_json_value(&value);
}

fn print_json_value(value: &Value) {
    if let Ok(text) = serde_json::to_string_pretty(value) {
        println!("{text}");
    }
}

fn string_arg(matches: &ArgMatches, name: &str) -> Option<String> {
    matches.get_one::<String>(name).cloned()
}

fn required_string_arg(matches: &ArgMatches, name: &str) -> Result<String, String> {
    string_arg(matches, name).ok_or_else(|| format!("missing required argument '{name}'"))
}

fn optional_positive_usize_arg(matches: &ArgMatches, name: &str) -> Result<Option<usize>, String> {
    let Some(value) = string_arg(matches, name) else {
        return Ok(None);
    };

    let parsed = value
        .parse::<usize>()
        .map_err(|_| format!("invalid value for --{name}: '{value}'"))?;

    if parsed == 0 {
        return Err(format!("--{name} must be greater than 0"));
    }

    Ok(Some(parsed))
}

#[cfg(test)]
mod tests {
    use super::{
        build_app_not_running_response, build_request_for_command, build_resolution_request,
        build_session_create_open_request, build_session_create_request,
        build_status_not_running_response, can_recover_control_response_after_read_error,
        control_request_io_timeout, maybe_write_output_file, parse_cli_args,
        parse_control_response_bytes, requires_running_app, response_indicates_running,
        should_run_cli_from_args, trim_status_response_data, wait_for_app_running_with,
        wait_for_created_session_ready_with, PackagedCliCommand,
    };
    use crate::control_protocol::{ControlError, ControlRequest, ControlResponse};
    use serde_json::json;
    use std::fs;
    use std::io::ErrorKind;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    #[test]
    fn parses_session_open_with_positional_session_id() {
        let command =
            parse_cli_args(&["session", "open", "sess-1"]).expect("session open should parse");

        assert_eq!(
            command,
            PackagedCliCommand::SessionOpen {
                session_id: "sess-1".to_string()
            }
        );
    }

    #[test]
    fn parses_session_close_with_positional_session_id() {
        let command =
            parse_cli_args(&["session", "close", "sess-1"]).expect("session close should parse");

        assert_eq!(
            command,
            PackagedCliCommand::SessionClose {
                session_id: "sess-1".to_string()
            }
        );
    }

    #[test]
    fn detects_empty_args_as_gui_launch() {
        let args: Vec<String> = vec![];

        assert!(!should_run_cli_from_args(&args));
    }

    #[test]
    fn detects_non_empty_args_as_cli_launch() {
        let args = vec!["status".to_string()];

        assert!(should_run_cli_from_args(&args));
    }

    #[test]
    fn parses_session_create_command() {
        let command = parse_cli_args(&["session", "create"]).expect("session create should parse");

        assert_eq!(command, PackagedCliCommand::SessionCreate);
    }

    #[test]
    fn rejects_conversation_create_command() {
        let error = parse_cli_args(&["conversation", "create"])
            .expect_err("conversation create should no longer parse");

        assert!(
            error.contains("create") || error.contains("subcommand") || error.contains("usage"),
            "unexpected error: {error}"
        );
    }

    #[test]
    fn rejects_session_open_with_title_lookup() {
        let error = parse_cli_args(&["session", "open", "--title", "Alpha"])
            .expect_err("session open should reject title lookup");

        assert!(
            error.contains("--title") || error.contains("unexpected") || error.contains("unknown"),
            "unexpected error: {error}"
        );
    }

    #[test]
    fn rejects_top_level_open_command() {
        let error = parse_cli_args(&["open"]).expect_err("open command should no longer parse");

        assert!(
            error.contains("open") || error.contains("subcommand") || error.contains("usage"),
            "unexpected error: {error}"
        );
    }

    #[test]
    fn response_indicates_running_uses_explicit_running_flag() {
        let response = ControlResponse {
            command: "status".to_string(),
            data: Some(json!({
                "running": true
            })),
            error: None,
            ok: true,
            request_id: "req-running".to_string(),
            session_id: None,
        };

        assert!(response_indicates_running(&response));
    }

    #[test]
    fn response_indicates_running_defaults_to_ok_without_running_field() {
        let response = ControlResponse {
            command: "status".to_string(),
            data: Some(json!({
                "address": "127.0.0.1:47831"
            })),
            error: None,
            ok: true,
            request_id: "req-fallback".to_string(),
            session_id: None,
        };

        assert!(response_indicates_running(&response));
    }

    #[test]
    fn parses_top_level_status_command() {
        let command = parse_cli_args(&["status"]).expect("top-level status should parse");

        assert_eq!(
            command,
            PackagedCliCommand::Status {
                session_id: String::new()
            }
        );
    }

    #[test]
    fn parses_session_status_with_positional_session_id() {
        let command = parse_cli_args(&["session", "status", "sess-1"])
            .expect("session status with session id should parse");

        assert_eq!(
            command,
            PackagedCliCommand::Status {
                session_id: "sess-1".to_string()
            }
        );
    }

    #[test]
    fn rejects_session_status_without_session_id() {
        let error = parse_cli_args(&["session", "status"])
            .expect_err("session status should require a session id");

        assert!(
            error.contains("session-id") || error.contains("required"),
            "unexpected error: {error}"
        );
    }

    #[test]
    fn rejects_session_close_without_session_id() {
        let error = parse_cli_args(&["session", "close"])
            .expect_err("session close should require a session id");

        assert!(
            error.contains("session-id") || error.contains("required"),
            "unexpected error: {error}"
        );
    }

    #[test]
    fn rejects_top_level_status_with_session_id() {
        let error = parse_cli_args(&["status", "sess-1"])
            .expect_err("top-level status should not accept a session id");

        assert!(
            error.contains("unexpected") || error.contains("usage") || error.contains("status"),
            "unexpected error: {error}"
        );
    }

    #[test]
    fn parses_document_apply_with_positional_xml_content() {
        let command = parse_cli_args(&[
            "canvas",
            "document.apply",
            "sess-1",
            "apply inline xml",
            "<mxfile><diagram id='1'>inline</diagram></mxfile>",
        ])
        .expect("document apply should parse");

        assert_eq!(
            command,
            PackagedCliCommand::CanvasDocumentApply {
                session_id: "sess-1".to_string(),
                xml: Some("<mxfile><diagram id='1'>inline</diagram></mxfile>".to_string()),
                xml_file: None,
                xml_stdin: false,
                base_version: None,
                prompt: Some("apply inline xml".to_string()),
                output_file: None
            }
        );
    }

    #[test]
    fn parses_document_apply_with_xml_file_flag() {
        let command = parse_cli_args(&[
            "canvas",
            "document.apply",
            "sess-1",
            "apply xml file",
            "--xml-file",
            "./next.drawio",
        ])
        .expect("document apply with xml file should parse");

        assert_eq!(
            command,
            PackagedCliCommand::CanvasDocumentApply {
                session_id: "sess-1".to_string(),
                xml: None,
                xml_file: Some("./next.drawio".to_string()),
                xml_stdin: false,
                base_version: None,
                prompt: Some("apply xml file".to_string()),
                output_file: None
            }
        );
    }

    #[test]
    fn parses_document_apply_with_stdin_mode() {
        let command = parse_cli_args(&[
            "canvas",
            "document.apply",
            "sess-1",
            "apply stdin xml",
            "--xml-stdin",
        ])
        .expect("stdin mode should parse");

        assert_eq!(
            command,
            PackagedCliCommand::CanvasDocumentApply {
                session_id: "sess-1".to_string(),
                xml: None,
                xml_file: None,
                xml_stdin: true,
                base_version: None,
                prompt: Some("apply stdin xml".to_string()),
                output_file: None
            }
        );
    }

    #[test]
    fn rejects_document_apply_without_prompt() {
        let error = parse_cli_args(&[
            "canvas",
            "document.apply",
            "sess-1",
            "<mxfile><diagram id='1'>inline</diagram></mxfile>",
        ])
        .expect_err("document apply without prompt must fail");

        assert!(
            error.contains("prompt") || error.contains("<prompt>"),
            "unexpected error: {error}"
        );
    }

    #[test]
    fn parses_document_restore_with_positional_xml_content() {
        let command = parse_cli_args(&[
            "canvas",
            "document.restore",
            "sess-1",
            "<mxfile><diagram id='1'>restore</diagram></mxfile>",
        ])
        .expect("document restore should parse");

        assert_eq!(
            command,
            PackagedCliCommand::CanvasDocumentRestore {
                session_id: "sess-1".to_string(),
                xml: Some("<mxfile><diagram id='1'>restore</diagram></mxfile>".to_string()),
                xml_file: None,
                xml_stdin: false,
                base_version: None,
            }
        );
    }

    #[test]
    fn parses_document_svg_with_output_directory() {
        let command = parse_cli_args(&[
            "canvas",
            "document.svg",
            "sess-1",
            "--output-file",
            "./exports",
        ])
        .expect("document svg should parse");

        assert_eq!(
            command,
            PackagedCliCommand::CanvasDocumentSvg {
                session_id: "sess-1".to_string(),
                output_file: Some("./exports".to_string())
            }
        );
    }

    #[test]
    fn parses_document_preview_with_output_directory() {
        let command = parse_cli_args(&["canvas", "document.preview", "sess-1", "./previews"])
            .expect("document preview should parse");

        assert_eq!(
            command,
            PackagedCliCommand::CanvasDocumentPreview {
                session_id: "sess-1".to_string(),
                output_directory: "./previews".to_string(),
                page: None,
            }
        );
    }

    #[test]
    fn parses_document_preview_with_selected_page() {
        let command = parse_cli_args(&[
            "canvas",
            "document.preview",
            "sess-1",
            "./previews",
            "--page",
            "2",
        ])
        .expect("document preview with page should parse");

        assert_eq!(
            command,
            PackagedCliCommand::CanvasDocumentPreview {
                session_id: "sess-1".to_string(),
                output_directory: "./previews".to_string(),
                page: Some(2),
            }
        );
    }

    #[test]
    fn rejects_document_preview_without_output_directory() {
        let error = parse_cli_args(&["canvas", "document.preview", "sess-1"])
            .expect_err("document preview requires an output directory");

        assert!(
            error.contains("output-directory") || error.contains("required"),
            "unexpected error: {error}"
        );
    }

    #[test]
    fn rejects_document_preview_with_zero_page() {
        let error = parse_cli_args(&[
            "canvas",
            "document.preview",
            "sess-1",
            "./previews",
            "--page",
            "0",
        ])
        .expect_err("document preview should reject page zero");

        assert!(
            error.contains("page") || error.contains("0"),
            "unexpected error: {error}"
        );
    }

    #[test]
    fn rejects_document_apply_when_both_input_modes_are_provided() {
        let error = parse_cli_args(&[
            "canvas",
            "document.apply",
            "sess-1",
            "apply inline xml",
            "<mxfile><diagram id='1'>inline</diagram></mxfile>",
            "--xml-stdin",
        ])
        .expect_err("mixed xml input modes must fail");

        assert!(error.contains("cannot"), "unexpected error: {error}");
    }

    #[test]
    fn rejects_document_get_without_session_id() {
        let error = parse_cli_args(&["canvas", "document.get"])
            .expect_err("document get should require a session id");

        assert!(
            error.contains("session-id") || error.contains("required"),
            "unexpected error: {error}"
        );
    }

    #[test]
    fn builds_session_open_resolution_for_document_get() {
        let request = build_resolution_request(&PackagedCliCommand::CanvasDocumentGet {
            session_id: "sess-1".to_string(),
            output_file: None,
        })
        .expect("document get should need a resolution request");

        assert_eq!(request.command, "session.open");
        assert_eq!(request.payload, json!({}));
        assert_eq!(request.session_id, Some("sess-1".to_string()));
    }

    #[test]
    fn builds_session_open_resolution_for_document_svg() {
        let request = build_resolution_request(&PackagedCliCommand::CanvasDocumentSvg {
            session_id: "sess-1".to_string(),
            output_file: None,
        })
        .expect("document svg should need a resolution request");

        assert_eq!(request.command, "session.open");
        assert_eq!(request.payload, json!({}));
        assert_eq!(request.session_id, Some("sess-1".to_string()));
    }

    #[test]
    fn builds_session_open_resolution_for_document_apply() {
        let request = build_resolution_request(&PackagedCliCommand::CanvasDocumentApply {
            session_id: "sess-1".to_string(),
            xml: Some("<mxfile><diagram id='1'>inline</diagram></mxfile>".to_string()),
            xml_file: None,
            xml_stdin: false,
            base_version: None,
            prompt: Some("open title and apply".to_string()),
            output_file: None,
        })
        .expect("document apply should build a session-open resolution request");

        assert_eq!(request.command, "session.open");
        assert_eq!(request.payload, json!({}));
        assert_eq!(request.session_id, Some("sess-1".to_string()));
    }

    #[test]
    fn builds_document_restore_request_with_base_version() {
        let restore_file = std::env::temp_dir().join(format!(
            "ai-drawio-restore-{}.drawio",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        fs::write(&restore_file, "<mxfile />").expect("restore fixture should be written");

        let request = build_request_for_command(
            &PackagedCliCommand::CanvasDocumentRestore {
                session_id: "sess-restore".to_string(),
                xml: None,
                xml_file: Some(restore_file.display().to_string()),
                xml_stdin: false,
                base_version: Some("sha256:restore".to_string()),
            },
            Some("sess-restore".to_string()),
        )
        .expect("document restore request should build");

        assert_eq!(request.command, "canvas.document.restore");
        assert_eq!(request.session_id, Some("sess-restore".to_string()));
        assert_eq!(
            request.payload.get("baseVersion"),
            Some(&json!("sha256:restore"))
        );
        assert!(request.payload.get("xml").is_some());

        let _ = fs::remove_file(restore_file);
    }

    #[test]
    fn build_request_for_document_apply_requires_non_empty_prompt() {
        let error = build_request_for_command(
            &PackagedCliCommand::CanvasDocumentApply {
                session_id: "sess-1".to_string(),
                xml: Some("<mxfile />".to_string()),
                xml_file: None,
                xml_stdin: false,
                base_version: None,
                prompt: None,
                output_file: None,
            },
            Some("sess-1".to_string()),
        )
        .expect_err("document apply request should reject a missing prompt");

        assert!(error.contains("<prompt>"), "unexpected error: {error}");
    }

    #[test]
    fn builds_document_preview_request_with_page_filter() {
        let request = build_request_for_command(
            &PackagedCliCommand::CanvasDocumentPreview {
                session_id: "sess-1".to_string(),
                output_directory: "./previews".to_string(),
                page: Some(2),
            },
            Some("sess-1".to_string()),
        )
        .expect("document preview request should build");

        assert_eq!(request.command, "canvas.document.preview");
        assert_eq!(request.session_id, Some("sess-1".to_string()));
        assert_eq!(request.payload.get("page"), Some(&json!(2)));
    }

    #[test]
    fn builds_session_open_request_with_session_id() {
        let request = build_request_for_command(
            &PackagedCliCommand::SessionOpen {
                session_id: "sess-1".to_string(),
            },
            None,
        )
        .expect("session open request should build");

        assert_eq!(request.command, "session.open");
        assert_eq!(request.payload, json!({}));
        assert_eq!(request.session_id, Some("sess-1".to_string()));
    }

    #[test]
    fn builds_session_close_request_with_session_id() {
        let request = build_request_for_command(
            &PackagedCliCommand::SessionClose {
                session_id: "sess-1".to_string(),
            },
            None,
        )
        .expect("session close request should build");

        assert_eq!(request.command, "session.close");
        assert_eq!(request.payload, json!({}));
        assert_eq!(request.session_id, Some("sess-1".to_string()));
    }

    #[test]
    fn builds_status_request_with_session_id() {
        let request = build_request_for_command(
            &PackagedCliCommand::Status {
                session_id: "sess-1".to_string(),
            },
            None,
        )
        .expect("status request should build");

        assert_eq!(request.command, "status");
        assert_eq!(request.payload, json!({}));
        assert_eq!(request.session_id, Some("sess-1".to_string()));
    }

    #[test]
    fn builds_status_request_without_session_id() {
        let request = build_request_for_command(
            &PackagedCliCommand::Status {
                session_id: String::new(),
            },
            None,
        )
        .expect("top-level status request should build");

        assert_eq!(request.command, "status");
        assert_eq!(request.payload, json!({}));
        assert_eq!(request.session_id, None);
    }

    #[test]
    fn control_request_io_timeout_tracks_validated_timeout() {
        let request = ControlRequest {
            command: "status".to_string(),
            payload: json!({}),
            request_id: "req-timeout".to_string(),
            session_id: None,
            source: None,
            timeout_ms: 500,
        };

        assert_eq!(
            control_request_io_timeout(&request),
            Duration::from_millis(3_000)
        );

        let long_request = ControlRequest {
            timeout_ms: 999_999,
            ..request
        };

        assert_eq!(
            control_request_io_timeout(&long_request),
            Duration::from_millis(122_000)
        );
    }

    #[test]
    fn session_create_requests_use_the_extended_timeout_budget() {
        let create_request = build_session_create_request();
        assert_eq!(create_request.command, "conversation.create");
        assert_eq!(create_request.timeout_ms, 60_000);
        assert_eq!(create_request.session_id, None);

        let open_request = build_session_create_open_request("sess-created".to_string());
        assert_eq!(open_request.command, "session.open");
        assert_eq!(open_request.timeout_ms, 10_000);
        assert_eq!(open_request.session_id.as_deref(), Some("sess-created"));
    }

    #[test]
    fn wait_for_created_session_ready_with_retries_until_success() {
        let mut attempts = 0usize;

        let response = wait_for_created_session_ready_with(
            "sess-created",
            Duration::from_millis(20),
            Duration::from_millis(0),
            |_| {
                attempts += 1;

                match attempts {
                    1 => Err("failed to read control response: Resource temporarily unavailable (os error 35)".to_string()),
                    2 => Ok(ControlResponse {
                        command: "session.open".to_string(),
                        data: None,
                        error: Some(ControlError::new(
                            "COMMAND_TIMEOUT",
                            "timed out while opening session",
                        )),
                        ok: false,
                        request_id: "req-timeout".to_string(),
                        session_id: Some("sess-created".to_string()),
                    }),
                    _ => Ok(ControlResponse {
                        command: "session.open".to_string(),
                        data: Some(json!({
                            "sessionId": "sess-created",
                            "bridgeReady": true,
                            "frameReady": true
                        })),
                        error: None,
                        ok: true,
                        request_id: "req-ok".to_string(),
                        session_id: Some("sess-created".to_string()),
                    }),
                }
            },
        )
        .expect("session create should keep retrying until session open succeeds");

        assert!(response.ok);
        assert_eq!(attempts, 3);
    }

    #[test]
    fn wait_for_created_session_ready_with_returns_non_retryable_response_immediately() {
        let response = wait_for_created_session_ready_with(
            "missing-session",
            Duration::from_millis(20),
            Duration::from_millis(0),
            |_| {
                Ok(ControlResponse {
                    command: "session.open".to_string(),
                    data: None,
                    error: Some(ControlError::new(
                        "SESSION_NOT_FOUND",
                        "session was not found",
                    )),
                    ok: false,
                    request_id: "req-missing".to_string(),
                    session_id: Some("missing-session".to_string()),
                })
            },
        )
        .expect("non-retryable responses should be returned");

        assert!(!response.ok);
        assert_eq!(
            response.error.as_ref().map(|error| error.code.as_str()),
            Some("SESSION_NOT_FOUND")
        );
    }

    #[test]
    fn wait_for_app_running_with_polls_until_status_reports_running() {
        let mut attempts = 0usize;

        wait_for_app_running_with(
            Duration::from_millis(20),
            Duration::from_millis(0),
            || {
                attempts += 1;

                Ok(ControlResponse {
                    command: "status".to_string(),
                    data: Some(json!({
                        "running": attempts >= 3
                    })),
                    error: None,
                    ok: true,
                    request_id: format!("req-{attempts}"),
                    session_id: None,
                })
            },
        )
        .expect("running status should eventually succeed");

        assert_eq!(attempts, 3);
    }

    #[test]
    fn wait_for_app_running_with_reports_timeout_after_last_error() {
        let error = wait_for_app_running_with(
            Duration::from_millis(1),
            Duration::from_millis(0),
            || Err("failed to connect to control server: Connection refused".to_string()),
        )
        .expect_err("startup wait should time out");

        assert!(error.contains("timed out while waiting for AI Drawio to finish starting"));
        assert!(error.contains("failed to connect to control server"));
    }

    #[test]
    fn can_recover_control_response_after_timeout_with_partial_bytes() {
        let timed_out = std::io::Error::new(ErrorKind::TimedOut, "timed out");
        assert!(can_recover_control_response_after_read_error(
            &timed_out,
            b"HTTP/1.1 200 OK\r\n\r\n{}"
        ));

        let would_block = std::io::Error::new(ErrorKind::WouldBlock, "would block");
        assert!(can_recover_control_response_after_read_error(
            &would_block,
            b"HTTP/1.1 200 OK\r\n\r\n{}"
        ));

        let broken_pipe = std::io::Error::new(ErrorKind::BrokenPipe, "broken pipe");
        assert!(!can_recover_control_response_after_read_error(
            &broken_pipe,
            b"HTTP/1.1 200 OK\r\n\r\n{}"
        ));
        assert!(!can_recover_control_response_after_read_error(&timed_out, b""));
    }

    #[test]
    fn parses_control_response_bytes_from_http_payload() {
        let response = parse_control_response_bytes(
            b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"command\":\"status\",\"data\":{\"running\":true},\"error\":null,\"ok\":true,\"requestId\":\"req-1\",\"sessionId\":null}",
        )
        .expect("http response bytes should parse");

        assert_eq!(response.command, "status");
        assert_eq!(response.data, Some(json!({ "running": true })));
        assert!(response.ok);
    }

    #[test]
    fn writes_svg_pages_to_directory_and_sets_output_paths() {
        let output_dir = std::env::temp_dir().join(format!(
            "ai-drawio-svg-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        let mut response = ControlResponse {
            command: "canvas.document.svg".to_string(),
            data: Some(json!({
                "pages": [
                    {
                        "id": "page-1",
                        "name": "首页/流程图",
                        "svg": "<svg><text>one</text></svg>"
                    }
                ]
            })),
            error: None,
            ok: true,
            request_id: "req-1".to_string(),
            session_id: Some("sess-1".to_string()),
        };

        maybe_write_output_file(
            &PackagedCliCommand::CanvasDocumentSvg {
                session_id: "sess-1".to_string(),
                output_file: Some(output_dir.display().to_string()),
            },
            &mut response,
        )
        .expect("svg pages should be written");

        let output_path = response.data.as_ref().and_then(|value| {
            value
                .get("pages")
                .and_then(|pages| pages.get(0))
                .and_then(|page| page.get("outputPath"))
                .and_then(|path| path.as_str())
                .map(str::to_string)
        });

        assert!(output_path.is_some());
        assert!(output_dir.join("01-首页-流程图.svg").exists());

        let _ = fs::remove_dir_all(output_dir);
    }

    #[test]
    fn writes_preview_pages_to_directory_and_sets_paths() {
        let output_dir = std::env::temp_dir().join(format!(
            "ai-drawio-preview-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        let mut response = ControlResponse {
            command: "canvas.document.preview".to_string(),
            data: Some(json!({
                "pages": [
                    {
                        "id": "page-1",
                        "name": "首页/流程图",
                        "pngDataUri": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=="
                    }
                ]
            })),
            error: None,
            ok: true,
            request_id: "req-1".to_string(),
            session_id: Some("sess-1".to_string()),
        };

        maybe_write_output_file(
            &PackagedCliCommand::CanvasDocumentPreview {
                session_id: "sess-1".to_string(),
                output_directory: output_dir.display().to_string(),
                page: None,
            },
            &mut response,
        )
        .expect("preview pages should be written");

        let output_path = response.data.as_ref().and_then(|value| {
            value
                .get("pages")
                .and_then(|pages| pages.get(0))
                .and_then(|page| page.get("path"))
                .and_then(|path| path.as_str())
                .map(str::to_string)
        });

        assert!(output_path.is_some());
        assert!(std::path::Path::new(output_path.as_deref().unwrap_or_default()).is_absolute());
        assert!(output_dir.join("01-首页-流程图.png").exists());

        let _ = fs::remove_dir_all(output_dir);
    }

    #[test]
    fn writes_only_the_selected_preview_page() {
        let output_dir = std::env::temp_dir().join(format!(
            "ai-drawio-preview-page-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        let mut response = ControlResponse {
            command: "canvas.document.preview".to_string(),
            data: Some(json!({
                "pages": [
                    {
                        "id": "page-1",
                        "name": "Page 1",
                        "pngDataUri": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=="
                    },
                    {
                        "id": "page-2",
                        "name": "Page 2",
                        "pngDataUri": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=="
                    }
                ]
            })),
            error: None,
            ok: true,
            request_id: "req-2".to_string(),
            session_id: Some("sess-1".to_string()),
        };

        maybe_write_output_file(
            &PackagedCliCommand::CanvasDocumentPreview {
                session_id: "sess-1".to_string(),
                output_directory: output_dir.display().to_string(),
                page: Some(2),
            },
            &mut response,
        )
        .expect("selected preview page should be written");

        assert!(!output_dir.join("01-Page 1.png").exists());
        assert!(output_dir.join("02-Page 2.png").exists());

        let _ = fs::remove_dir_all(output_dir);
    }

    #[test]
    fn reports_page_out_of_range_for_preview_exports() {
        let output_dir = std::env::temp_dir().join(format!(
            "ai-drawio-preview-overflow-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        let mut response = ControlResponse {
            command: "canvas.document.preview".to_string(),
            data: Some(json!({
                "pages": [
                    {
                        "id": "page-1",
                        "name": "Page 1",
                        "pngDataUri": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=="
                    },
                    {
                        "id": "page-2",
                        "name": "Page 2",
                        "pngDataUri": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=="
                    }
                ]
            })),
            error: None,
            ok: true,
            request_id: "req-3".to_string(),
            session_id: Some("sess-1".to_string()),
        };

        maybe_write_output_file(
            &PackagedCliCommand::CanvasDocumentPreview {
                session_id: "sess-1".to_string(),
                output_directory: output_dir.display().to_string(),
                page: Some(3),
            },
            &mut response,
        )
        .expect("overflow handling should return a structured response");

        assert!(!response.ok);
        assert_eq!(
            response.error.as_ref().map(|error| error.code.as_str()),
            Some("PAGE_OUT_OF_RANGE")
        );
        assert_eq!(
            response
                .error
                .as_ref()
                .and_then(|error| error.details.as_ref())
                .and_then(|details| details.get("requestedPage"))
                .and_then(|value| value.as_u64()),
            Some(3)
        );
        assert_eq!(
            response
                .error
                .as_ref()
                .and_then(|error| error.details.as_ref())
                .and_then(|details| details.get("pageCount"))
                .and_then(|value| value.as_u64()),
            Some(2)
        );
        assert!(!output_dir.exists());
    }

    #[test]
    fn status_not_running_response_reports_manual_launch_requirement() {
        let response = build_status_not_running_response(None);

        assert_eq!(response.command, "status");
        assert!(response.ok);
        assert_eq!(
            response
                .data
                .as_ref()
                .and_then(|value| value.get("running")),
            Some(&json!(false))
        );
        assert_eq!(
            response.data.as_ref().and_then(|value| value.get("shell")),
            Some(&json!(null))
        );
        assert_eq!(
            response.data.as_ref().and_then(|value| value.get("session")),
            Some(&json!(null))
        );
        assert_eq!(
            response
                .data
                .as_ref()
                .and_then(|value| value.get("manualLaunchRequired")),
            None
        );
    }

    #[test]
    fn status_not_running_response_marks_requested_session_as_not_ready() {
        let response = build_status_not_running_response(Some("sess-1"));

        assert_eq!(response.session_id.as_deref(), Some("sess-1"));

        assert_eq!(
            response
                .data
                .as_ref()
                .and_then(|value| value.get("session")),
            Some(&json!({
                "isReady": false,
                "sessionId": "sess-1",
                "status": "app-not-running"
            }))
        );
    }

    #[test]
    fn session_status_not_running_response_can_be_trimmed_to_session_only() {
        let mut response = build_status_not_running_response(Some("sess-1"));
        trim_status_response_data(&PackagedCliCommand::Status {
            session_id: "sess-1".to_string(),
        }, &mut response)
        .expect("session status response should trim");

        assert_eq!(response.command, "session.status");
        assert_eq!(
            response.data,
            Some(json!({
                "isReady": false,
                "sessionId": "sess-1",
                "status": "app-not-running"
            }))
        );
    }

    #[test]
    fn session_status_trim_synthesizes_unavailable_when_app_status_lacks_session_payload() {
        let mut response = ControlResponse {
            command: "status".to_string(),
            data: Some(json!({
                "address": "127.0.0.1:47831",
                "running": true,
                "session": null,
                "shell": {
                    "route": "/session"
                }
            })),
            error: None,
            ok: true,
            request_id: "req-2".to_string(),
            session_id: None,
        };

        trim_status_response_data(
            &PackagedCliCommand::Status {
                session_id: "sess-2".to_string(),
            },
            &mut response,
        )
        .expect("session status should synthesize a session fallback payload");

        assert_eq!(response.command, "session.status");
        assert_eq!(
            response.data,
            Some(json!({
                "isReady": false,
                "sessionId": "sess-2",
                "status": "unavailable"
            }))
        );
    }

    #[test]
    fn top_level_status_response_can_be_trimmed_to_app_only() {
        let mut response = ControlResponse {
            command: "status".to_string(),
            data: Some(json!({
                "address": "127.0.0.1:47831",
                "running": true,
                "session": {
                    "isReady": true,
                    "sessionId": "sess-1",
                    "status": "idle"
                },
                "shell": {
                    "route": "/session?id=sess-1"
                }
            })),
            error: None,
            ok: true,
            request_id: "req-1".to_string(),
            session_id: None,
        };
        trim_status_response_data(
            &PackagedCliCommand::Status {
                session_id: String::new(),
            },
            &mut response,
        )
        .expect("top-level status response should trim");

        assert_eq!(response.command, "status");
        assert_eq!(
            response.data,
            Some(json!({
                "address": "127.0.0.1:47831",
                "running": true
            }))
        );
    }

    #[test]
    fn app_not_running_response_returns_cli_error_without_user_prompt_text() {
        let response = build_app_not_running_response("canvas.document.get");

        assert_eq!(response.command, "canvas.document.get");
        assert!(!response.ok);
        assert_eq!(
            response.error.as_ref().map(|error| error.code.as_str()),
            Some("APP_NOT_RUNNING")
        );
        assert_eq!(
            response.error.as_ref().map(|error| error.message.as_str()),
            Some("AI Drawio is not running.")
        );
        assert_eq!(
            response
                .data
                .as_ref()
                .and_then(|value| value.get("manualLaunchRequired")),
            None
        );
        assert_eq!(
            response
                .data
                .as_ref()
                .and_then(|value| value.get("message")),
            None
        );
    }

    #[test]
    fn commands_that_need_control_server_require_a_running_desktop_app() {
        let commands = [
            PackagedCliCommand::SessionCreate,
            PackagedCliCommand::SessionList,
            PackagedCliCommand::SessionClose {
                session_id: "sess-1".to_string(),
            },
            PackagedCliCommand::SessionOpen {
                session_id: "sess-1".to_string(),
            },
            PackagedCliCommand::CanvasDocumentGet {
                session_id: "sess-1".to_string(),
                output_file: None,
            },
            PackagedCliCommand::CanvasDocumentSvg {
                session_id: "sess-1".to_string(),
                output_file: None,
            },
            PackagedCliCommand::CanvasDocumentPreview {
                session_id: "sess-1".to_string(),
                output_directory: "./previews".to_string(),
                page: None,
            },
            PackagedCliCommand::CanvasDocumentApply {
                session_id: "sess-1".to_string(),
                xml: Some("<mxfile />".to_string()),
                xml_file: None,
                xml_stdin: false,
                base_version: None,
                prompt: Some("apply document".to_string()),
                output_file: None,
            },
            PackagedCliCommand::CanvasDocumentRestore {
                session_id: "sess-1".to_string(),
                xml: Some("<mxfile />".to_string()),
                xml_file: None,
                xml_stdin: false,
                base_version: None,
            },
        ];

        for command in commands {
            assert!(requires_running_app(&command));
        }

        assert!(!requires_running_app(&PackagedCliCommand::Status {
            session_id: "sess-1".to_string()
        }));
    }
}
