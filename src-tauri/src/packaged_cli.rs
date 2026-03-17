use crate::cli_schema::build_cli_command;
use crate::control_protocol::{CommandSource, ControlRequest, ControlResponse};
use clap::ArgMatches;
use serde_json::{json, Map, Value};
use std::env;
use std::fs;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::process::{Command, Stdio};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const CLI_SOURCE_NAME: &str = "ai-drawio";
const INTERNAL_GUI_ENV: &str = "AI_DRAWIO_INTERNAL_GUI";
const CONTROL_TIMEOUT_MS: u64 = 20_000;
const STATUS_TIMEOUT_MS: u64 = 5_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SessionLocator {
    Id(String),
    Title(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PackagedCliCommand {
    Open,
    Status,
    ConversationCreate,
    SessionList,
    SessionOpen { locator: SessionLocator },
    CanvasDocumentGet {
        locator: Option<SessionLocator>,
        output_file: Option<String>,
    },
    CanvasDocumentSvg {
        locator: Option<SessionLocator>,
        output_file: Option<String>,
    },
    CanvasDocumentApply {
        locator: Option<SessionLocator>,
        xml_file: Option<String>,
        xml_stdin: bool,
        base_version: Option<String>,
        prompt: Option<String>,
        output_file: Option<String>,
    },
}

pub fn maybe_run_from_env() -> Option<i32> {
    if env::var_os(INTERNAL_GUI_ENV).is_some() {
        return None;
    }

    let args = env::args().skip(1).collect::<Vec<_>>();
    if args.is_empty() {
        return None;
    }

    let exit_code = match parse_cli_args_from_strings(&args).and_then(|command| execute_cli(&command))
    {
        Ok(response) => {
            print_json_response(&response);
            if response.ok { 0 } else { 1 }
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
    let owned_args = args.iter().map(|value| (*value).to_string()).collect::<Vec<_>>();
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
        Some(("open", _)) => Ok(PackagedCliCommand::Open),
        Some(("status", _)) => Ok(PackagedCliCommand::Status),
        Some(("conversation", submatches)) => match submatches.subcommand() {
            Some(("create", _)) => Ok(PackagedCliCommand::ConversationCreate),
            _ => Err("conversation only supports create".to_string()),
        },
        Some(("session", submatches)) => match submatches.subcommand() {
            Some(("list", _)) => Ok(PackagedCliCommand::SessionList),
            Some(("open", open_matches)) => Ok(PackagedCliCommand::SessionOpen {
                locator: parse_required_locator(open_matches, "session-id", "title")?,
            }),
            _ => Err("session only supports list or open".to_string()),
        },
        Some(("canvas", submatches)) => match submatches.subcommand() {
            Some(("document.get", get_matches)) => Ok(PackagedCliCommand::CanvasDocumentGet {
                locator: parse_optional_locator(get_matches, "session", "session-title"),
                output_file: string_arg(get_matches, "output-file"),
            }),
            Some(("document.svg", svg_matches)) => Ok(PackagedCliCommand::CanvasDocumentSvg {
                locator: parse_optional_locator(svg_matches, "session", "session-title"),
                output_file: string_arg(svg_matches, "output-file"),
            }),
            Some(("document.apply", apply_matches)) => Ok(PackagedCliCommand::CanvasDocumentApply {
                locator: parse_optional_locator(apply_matches, "session", "session-title"),
                xml_file: string_arg(apply_matches, "xml-file"),
                xml_stdin: apply_matches.get_flag("xml-stdin"),
                base_version: string_arg(apply_matches, "base-version"),
                prompt: string_arg(apply_matches, "prompt"),
                output_file: string_arg(apply_matches, "output-file"),
            }),
            _ => Err("canvas only supports document.get, document.svg or document.apply".to_string()),
        },
        _ => Err("missing command".to_string()),
    }
}

pub fn build_resolution_request(command: &PackagedCliCommand) -> Option<ControlRequest> {
    let locator = match command {
        PackagedCliCommand::CanvasDocumentGet { locator, .. } => locator.as_ref(),
        PackagedCliCommand::CanvasDocumentSvg { locator, .. } => locator.as_ref(),
        PackagedCliCommand::CanvasDocumentApply { locator, .. } => locator.as_ref(),
        _ => return None,
    };

    match locator {
        Some(SessionLocator::Id(session_id)) => Some(build_request(
            "session.open",
            Some(session_id.to_string()),
            json!({}),
            CONTROL_TIMEOUT_MS,
        )),
        Some(SessionLocator::Title(title)) => Some(build_request(
            "session.open",
            None,
            json!({ "title": title }),
            CONTROL_TIMEOUT_MS,
        )),
        None => Some(build_request(
            "session.ensure",
            None,
            json!({}),
            CONTROL_TIMEOUT_MS,
        )),
    }
}

pub fn build_request_for_command(
    command: &PackagedCliCommand,
    session_id: Option<String>,
) -> Result<ControlRequest, String> {
    match command {
        PackagedCliCommand::Open => Ok(build_request("open", None, json!({}), CONTROL_TIMEOUT_MS)),
        PackagedCliCommand::Status => Ok(build_request(
            "status",
            None,
            json!({}),
            STATUS_TIMEOUT_MS,
        )),
        PackagedCliCommand::ConversationCreate => Ok(build_request(
            "conversation.create",
            None,
            json!({}),
            CONTROL_TIMEOUT_MS,
        )),
        PackagedCliCommand::SessionList => Ok(build_request(
            "session.list",
            None,
            json!({}),
            CONTROL_TIMEOUT_MS,
        )),
        PackagedCliCommand::SessionOpen { locator } => match locator {
            SessionLocator::Id(session_id) => Ok(build_request(
                "session.open",
                Some(session_id.clone()),
                json!({}),
                CONTROL_TIMEOUT_MS,
            )),
            SessionLocator::Title(title) => Ok(build_request(
                "session.open",
                None,
                json!({ "title": title }),
                CONTROL_TIMEOUT_MS,
            )),
        },
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
        PackagedCliCommand::CanvasDocumentApply {
            xml_file,
            xml_stdin,
            base_version,
            prompt,
            ..
        } => {
            let xml = if *xml_stdin {
                read_stdin()?
            } else if let Some(xml_file) = xml_file {
                fs::read_to_string(xml_file)
                    .map_err(|error| format!("failed to read xml file '{xml_file}': {error}"))?
            } else {
                return Err(
                    "canvas document.apply requires exactly one xml input mode: <xml-file> or --xml-stdin"
                        .to_string(),
                );
            };

            let mut payload = Map::from_iter([("xml".to_string(), Value::String(xml))]);

            if let Some(base_version) = base_version {
                payload.insert(
                    "baseVersion".to_string(),
                    Value::String(base_version.to_string()),
                );
            }

            if let Some(prompt) = prompt {
                payload.insert("prompt".to_string(), Value::String(prompt.to_string()));
            }

            Ok(build_request(
                "canvas.document.apply",
                session_id,
                Value::Object(payload),
                CONTROL_TIMEOUT_MS,
            ))
        }
    }
}

pub fn execute_cli(command: &PackagedCliCommand) -> Result<ControlResponse, String> {
    let launched = ensure_desktop_app()?;

    let mut response = if let Some(resolution_request) = build_resolution_request(command) {
        let resolution_response = send_control_request(&resolution_request)?;
        if !resolution_response.ok {
            resolution_response
        } else {
            let session_id = extract_resolved_session_id(&resolution_response)?;
            let request = build_request_for_command(command, Some(session_id))?;
            let mut response = send_control_request(&request)?;
            maybe_write_output_file(command, &mut response)?;
            response
        }
    } else {
        let request = build_request_for_command(command, None)?;
        let mut response = send_control_request(&request)?;
        maybe_write_output_file(command, &mut response)?;
        response
    };

    inject_launched(&mut response, launched);

    Ok(response)
}

fn ensure_desktop_app() -> Result<bool, String> {
    if send_control_request(&build_request("status", None, json!({}), STATUS_TIMEOUT_MS)).is_ok() {
        return Ok(false);
    }

    spawn_gui_process()?;
    wait_for_control_server(Duration::from_millis(CONTROL_TIMEOUT_MS))?;
    Ok(true)
}

fn spawn_gui_process() -> Result<(), String> {
    let current_exe =
        env::current_exe().map_err(|error| format!("failed to locate current executable: {error}"))?;

    Command::new(current_exe)
        .env(INTERNAL_GUI_ENV, "1")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("failed to launch desktop app: {error}"))
}

fn wait_for_control_server(timeout: Duration) -> Result<(), String> {
    let started_at = SystemTime::now();

    loop {
        if send_control_request(&build_request("status", None, json!({}), STATUS_TIMEOUT_MS)).is_ok() {
            return Ok(());
        }

        let elapsed = started_at.elapsed().unwrap_or_default();
        if elapsed >= timeout {
            return Err("desktop control server did not become ready in time".to_string());
        }

        std::thread::sleep(Duration::from_millis(300));
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

fn maybe_write_output_file(
    command: &PackagedCliCommand,
    response: &mut ControlResponse,
) -> Result<(), String> {
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
        fs::create_dir_all(output_file)
            .map_err(|error| format!("failed to create output directory '{output_file}': {error}"))?;

        let mut updated_pages = Vec::with_capacity(pages.len());

        for (index, page) in pages.iter().enumerate() {
            let page_name = page
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .trim();
            let svg = page
                .get("svg")
                .and_then(Value::as_str)
                .unwrap_or_default();

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

fn sanitize_svg_page_name(name: &str) -> String {
    name
        .trim()
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

fn inject_launched(response: &mut ControlResponse, launched: bool) {
    let mut object = match response.data.take() {
        Some(Value::Object(object)) => object,
        Some(other) => Map::from_iter([("value".to_string(), other)]),
        None => Map::new(),
    };

    object.insert("launched".to_string(), Value::Bool(launched));
    response.data = Some(Value::Object(object));
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

fn parse_required_locator(
    matches: &ArgMatches,
    id_name: &str,
    title_name: &str,
) -> Result<SessionLocator, String> {
    parse_optional_locator(matches, id_name, title_name)
        .ok_or_else(|| format!("missing {id_name} or --{title_name}"))
}

fn parse_optional_locator(
    matches: &ArgMatches,
    id_name: &str,
    title_name: &str,
) -> Option<SessionLocator> {
    string_arg(matches, id_name)
        .map(SessionLocator::Id)
        .or_else(|| string_arg(matches, title_name).map(SessionLocator::Title))
}

#[cfg(test)]
mod tests {
    use super::{
        build_request_for_command, build_resolution_request, maybe_write_output_file,
        parse_cli_args, PackagedCliCommand, SessionLocator,
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
                locator: SessionLocator::Id("sess-1".to_string())
            }
        );
    }

    #[test]
    fn parses_session_open_with_title_lookup() {
        let command = parse_cli_args(&["session", "open", "--title", "Alpha"])
            .expect("session open by title should parse");

        assert_eq!(
            command,
            PackagedCliCommand::SessionOpen {
                locator: SessionLocator::Title("Alpha".to_string())
            }
        );
    }

    #[test]
    fn parses_document_apply_with_positional_xml_file() {
        let command = parse_cli_args(&["canvas", "document.apply", "./next.drawio"])
            .expect("document apply should parse");

        assert_eq!(
            command,
            PackagedCliCommand::CanvasDocumentApply {
                locator: None,
                xml_file: Some("./next.drawio".to_string()),
                xml_stdin: false,
                base_version: None,
                prompt: None,
                output_file: None
            }
        );
    }

    #[test]
    fn parses_document_apply_with_stdin_mode() {
        let command = parse_cli_args(&["canvas", "document.apply", "--xml-stdin"])
            .expect("stdin mode should parse");

        assert_eq!(
            command,
            PackagedCliCommand::CanvasDocumentApply {
                locator: None,
                xml_file: None,
                xml_stdin: true,
                base_version: None,
                prompt: None,
                output_file: None
            }
        );
    }

    #[test]
    fn parses_document_svg_with_output_directory() {
        let command = parse_cli_args(&["canvas", "document.svg", "--output-file", "./exports"])
            .expect("document svg should parse");

        assert_eq!(
            command,
            PackagedCliCommand::CanvasDocumentSvg {
                locator: None,
                output_file: Some("./exports".to_string())
            }
        );
    }

    #[test]
    fn rejects_document_apply_when_both_input_modes_are_provided() {
        let error = parse_cli_args(&[
            "canvas",
            "document.apply",
            "./next.drawio",
            "--xml-stdin",
        ])
        .expect_err("mixed xml input modes must fail");

        assert!(error.contains("cannot"), "unexpected error: {error}");
    }

    #[test]
    fn builds_session_ensure_resolution_for_document_get_without_locator() {
        let request = build_resolution_request(&PackagedCliCommand::CanvasDocumentGet {
            locator: None,
            output_file: None,
        })
        .expect("document get should need a resolution request");

        assert_eq!(request.command, "session.ensure");
        assert_eq!(request.payload, json!({}));
        assert_eq!(request.session_id, None);
    }

    #[test]
    fn builds_session_ensure_resolution_for_document_svg_without_locator() {
        let request = build_resolution_request(&PackagedCliCommand::CanvasDocumentSvg {
            locator: None,
            output_file: None,
        })
        .expect("document svg should need a resolution request");

        assert_eq!(request.command, "session.ensure");
        assert_eq!(request.payload, json!({}));
        assert_eq!(request.session_id, None);
    }

    #[test]
    fn builds_session_open_resolution_for_title_locator() {
        let request = build_resolution_request(&PackagedCliCommand::CanvasDocumentApply {
            locator: Some(SessionLocator::Title("Alpha".to_string())),
            xml_file: Some("./next.drawio".to_string()),
            xml_stdin: false,
            base_version: None,
            prompt: None,
            output_file: None,
        })
        .expect("document apply should build a title-based resolution request");

        assert_eq!(request.command, "session.open");
        assert_eq!(request.payload, json!({ "title": "Alpha" }));
        assert_eq!(request.session_id, None);
    }

    #[test]
    fn builds_session_open_request_with_title_payload() {
        let request = build_request_for_command(
            &PackagedCliCommand::SessionOpen {
                locator: SessionLocator::Title("Alpha".to_string()),
            },
            None,
        )
        .expect("session open request should build");

        assert_eq!(request.command, "session.open");
        assert_eq!(request.payload, json!({ "title": "Alpha" }));
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
                locator: None,
                output_file: Some(output_dir.display().to_string()),
            },
            &mut response,
        )
        .expect("svg pages should be written");

        let output_path = response.data.as_ref().and_then(|value| {
            value.get("pages")
                .and_then(|pages| pages.get(0))
                .and_then(|page| page.get("outputPath"))
                .and_then(|path| path.as_str())
                .map(str::to_string)
        });

        assert!(output_path.is_some());
        assert!(output_dir.join("01-首页-流程图.svg").exists());

        let _ = fs::remove_dir_all(output_dir);
    }
}
