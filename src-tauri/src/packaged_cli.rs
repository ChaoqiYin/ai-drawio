use crate::cli_schema::build_cli_command;
use crate::control_protocol::{CommandSource, ControlError, ControlRequest, ControlResponse};
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use clap::ArgMatches;
use serde_json::{json, Map, Value};
use std::env;
use std::fs;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const CLI_SOURCE_NAME: &str = "ai-drawio";
const CONTROL_TIMEOUT_MS: u64 = 20_000;
const STATUS_TIMEOUT_MS: u64 = 5_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OpenMode {
    Tray,
    Window,
}

impl OpenMode {
    fn as_str(self) -> &'static str {
        match self {
            Self::Tray => "tray",
            Self::Window => "window",
        }
    }

    fn parse(value: &str) -> Result<Self, String> {
        match value.trim() {
            "tray" => Ok(Self::Tray),
            "window" => Ok(Self::Window),
            other => Err(format!("unsupported open mode '{other}'")),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PackagedCliCommand {
    Open {
        mode: OpenMode,
    },
    Status {
        session_id: String,
    },
    SessionCreate,
    SessionList,
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
        Some(("open", open_matches)) => Ok(PackagedCliCommand::Open {
            mode: parse_open_mode(open_matches)?,
        }),
        Some(("status", _)) => Ok(PackagedCliCommand::Status {
            session_id: String::new(),
        }),
        Some(("session", submatches)) => match submatches.subcommand() {
            Some(("create", _)) => Ok(PackagedCliCommand::SessionCreate),
            Some(("list", _)) => Ok(PackagedCliCommand::SessionList),
            Some(("status", status_matches)) => Ok(PackagedCliCommand::Status {
                session_id: required_string_arg(status_matches, "session-id")?,
            }),
            Some(("open", open_matches)) => Ok(PackagedCliCommand::SessionOpen {
                session_id: required_string_arg(open_matches, "session-id")?,
            }),
            _ => Err("session only supports create, list, status or open".to_string()),
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
        PackagedCliCommand::Open { .. } => {
            Err("open does not map to a control request".to_string())
        }
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
    if let PackagedCliCommand::Open { mode } = command {
        return execute_open_command(*mode);
    }

    if !requires_running_app(command) {
        return Ok(match send_status_request(status_request_session_id(command)) {
            Ok(mut response) => {
                trim_status_response_data(command, &mut response)?;
                response
            }
            Err(_) => {
                let mut response = build_status_not_running_response(status_request_session_id(command));
                trim_status_response_data(command, &mut response)?;
                response
            }
        });
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
    !matches!(
        command,
        PackagedCliCommand::Status { .. } | PackagedCliCommand::Open { .. }
    )
}

fn execute_session_create() -> Result<ControlResponse, String> {
    let create_request = build_request("conversation.create", None, json!({}), CONTROL_TIMEOUT_MS);
    let create_response = send_control_request(&create_request)?;

    if !create_response.ok {
        return Ok(relabel_response_command(create_response, "session.create"));
    }

    let session_id = extract_created_session_id(&create_response)?;
    let open_request = build_request(
        "session.open",
        Some(session_id),
        json!({}),
        CONTROL_TIMEOUT_MS,
    );
    let open_response = send_control_request(&open_request)?;

    Ok(relabel_response_command(open_response, "session.create"))
}

fn execute_open_command(mode: OpenMode) -> Result<ControlResponse, String> {
    if let Ok(response) = send_status_request(None) {
        let running = response
            .data
            .as_ref()
            .and_then(|value| value.get("running"))
            .and_then(Value::as_bool)
            .unwrap_or(response.ok);

        if running {
            return Ok(build_success_response(
                "open",
                json!({
                    "launched": false,
                    "mode": mode.as_str(),
                    "running": true
                }),
            ));
        }
    }

    launch_desktop_app(mode)?;

    Ok(build_success_response(
        "open",
        json!({
            "launched": true,
            "mode": mode.as_str(),
            "running": false
        }),
    ))
}

fn launch_desktop_app(mode: OpenMode) -> Result<(), String> {
    let current_exe = std::env::current_exe()
        .map_err(|error| format!("failed to resolve current executable: {error}"))?;

    Command::new(current_exe)
        .env(crate::tray_settings::STARTUP_MODE_ENV_VAR, mode.as_str())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("failed to launch AI Drawio: {error}"))?;

    Ok(())
}

fn send_status_request(session_id: Option<&str>) -> Result<ControlResponse, String> {
    send_control_request(&build_request(
        "status",
        session_id.map(str::to_string),
        json!({}),
        STATUS_TIMEOUT_MS,
    ))
}

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
        .ok_or_else(|| "status response is missing session data".to_string())?;

    response.data = Some(session);
    response.session_id = Some(session_id.to_string());

    Ok(())
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
    let mut stream = TcpStream::connect(crate::control_server::CONTROL_ADDR)
        .map_err(|error| format!("failed to connect to control server: {error}"))?;
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));

    let body = serde_json::to_vec(request)
        .map_err(|error| format!("failed to serialize control request: {error}"))?;
    let http_request = format!(
        "POST /control HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );

    stream
        .write_all(http_request.as_bytes())
        .and_then(|_| stream.write_all(&body))
        .map_err(|error| format!("failed to write control request: {error}"))?;

    let mut response_bytes = Vec::new();
    stream
        .read_to_end(&mut response_bytes)
        .map_err(|error| format!("failed to read control response: {error}"))?;

    let body = split_http_body(&response_bytes)
        .ok_or_else(|| "control server returned an invalid HTTP response".to_string())?;

    serde_json::from_slice(body)
        .map_err(|error| format!("failed to parse control response JSON: {error}"))
}

fn split_http_body(response: &[u8]) -> Option<&[u8]> {
    response
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .map(|index| &response[index + 4..])
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

fn build_success_response(command: &str, data: Value) -> ControlResponse {
    ControlResponse {
        command: command.to_string(),
        data: Some(data),
        error: None,
        ok: true,
        request_id: next_request_id(),
        session_id: None,
    }
}

fn command_name(command: &PackagedCliCommand) -> &'static str {
    match command {
        PackagedCliCommand::Open { .. } => "open",
        PackagedCliCommand::Status { .. } => "status",
        PackagedCliCommand::SessionCreate => "session.create",
        PackagedCliCommand::SessionList => "session.list",
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

fn parse_open_mode(matches: &ArgMatches) -> Result<OpenMode, String> {
    OpenMode::parse(
        string_arg(matches, "mode")
            .unwrap_or_else(|| OpenMode::Tray.as_str().to_string())
            .as_str(),
    )
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
        build_status_not_running_response, maybe_write_output_file, parse_cli_args,
        requires_running_app, should_run_cli_from_args, trim_status_response_data, OpenMode,
        PackagedCliCommand,
    };
    use crate::control_protocol::ControlResponse;
    use serde_json::json;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

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
    fn parses_open_command_with_default_tray_mode() {
        let command = parse_cli_args(&["open"]).expect("open command should parse");

        assert_eq!(
            command,
            PackagedCliCommand::Open {
                mode: OpenMode::Tray
            }
        );
    }

    #[test]
    fn parses_open_command_with_explicit_window_mode() {
        let command =
            parse_cli_args(&["open", "--mode", "window"]).expect("open command should parse");

        assert_eq!(
            command,
            PackagedCliCommand::Open {
                mode: OpenMode::Window
            }
        );
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
        assert!(!requires_running_app(&PackagedCliCommand::Open {
            mode: OpenMode::Tray
        }));
    }
}
