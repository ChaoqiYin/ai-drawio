use clap::{Arg, ArgAction, Command};

pub fn build_cli_command() -> Command {
    Command::new("ai-drawio")
        .about("Open or control the AI Drawio desktop app from the terminal")
        .disable_help_subcommand(true)
        .after_help(
            "Common commands:\n  ai-drawio open\n  ai-drawio open --mode window\n  ai-drawio session create\n  ai-drawio session open <session-id>\n  ai-drawio canvas document.get <session-id>\n  ai-drawio canvas document.apply <session-id> \"update layout\" --xml-file ./diagram.drawio",
        )
        .subcommand(
            Command::new("open")
                .about("Launch the desktop app")
                .after_help(
                    "Startup modes:\n  tray   Start hidden in the tray for this run only (default)\n  window Start with the main window visible for this run only\n\nExamples:\n  ai-drawio open\n  ai-drawio open --mode window",
                )
                .arg(
                    Arg::new("mode")
                        .long("mode")
                        .value_name("mode")
                        .help("Choose whether this launch starts in tray or window mode")
                        .default_value("tray")
                        .value_parser(["tray", "window"]),
                ),
        )
        .subcommand(
            Command::new("status")
                .about("Inspect whether the desktop app is running")
                .after_help("Example:\n  ai-drawio status"),
        )
        .subcommand(
            Command::new("session")
                .about("Inspect or open local sessions")
                .subcommand(
                    Command::new("create")
                        .about("Create a new local session and wait until it is ready")
                        .after_help("Example:\n  ai-drawio session create"),
                )
                .subcommand(
                    Command::new("list")
                        .about("List all local sessions")
                        .after_help("Example:\n  ai-drawio session list"),
                )
                .subcommand(
                    Command::new("status")
                        .about("Inspect one local session")
                        .after_help("Example:\n  ai-drawio session status sess-123")
                        .arg(
                            Arg::new("session-id")
                                .index(1)
                                .value_name("session-id")
                                .help("Inspect whether the exact persisted session id is ready")
                                .required(true),
                        ),
                )
                .subcommand(
                    Command::new("open")
                        .about("Open one local session")
                        .after_help(
                            "Provide the exact persisted session id.\n\nExample:\n  ai-drawio session open sess-123",
                        )
                        .arg(
                            Arg::new("session-id")
                                .index(1)
                                .value_name("session-id")
                                .help("Open the exact persisted session id")
                                .required(true),
                        ),
                ),
        )
        .subcommand(
            Command::new("canvas")
                .about("Read or write the active draw.io document")
                .subcommand(
                    Command::new("document.get")
                        .about("Read the specified draw.io document")
                        .after_help(
                            "Provide the target session id explicitly.\n\nExample:\n  ai-drawio canvas document.get sess-123 --output-file ./current.drawio",
                        )
                        .arg(
                            Arg::new("session-id")
                                .index(1)
                                .value_name("session-id")
                                .help("Use the exact persisted session id")
                                .required(true),
                        )
                        .arg(
                            Arg::new("output-file")
                                .long("output-file")
                                .value_name("path")
                                .help("Write the XML response into a file instead of stdout"),
                        ),
                )
                .subcommand(
                    Command::new("document.svg")
                        .about("Export the specified draw.io document as per-page SVG")
                        .after_help(
                            "If --output-file is set, the value is treated as an output directory for generated SVG files.\n\nExample:\n  ai-drawio canvas document.svg sess-123 --output-file ./svg-pages",
                        )
                        .arg(
                            Arg::new("session-id")
                                .index(1)
                                .value_name("session-id")
                                .help("Use the exact persisted session id")
                                .required(true),
                        )
                        .arg(
                            Arg::new("output-file")
                                .long("output-file")
                                .value_name("path")
                                .help("Write generated SVG files into this directory"),
                        ),
                )
                .subcommand(
                    Command::new("document.preview")
                        .about("Export the specified draw.io document as per-page PNG preview images")
                        .after_help(
                            "Examples:\n  ai-drawio canvas document.preview sess-123 ./previews\n  ai-drawio canvas document.preview sess-123 ./previews --page 2",
                        )
                        .arg(
                            Arg::new("session-id")
                                .index(1)
                                .value_name("session-id")
                                .help("Use the exact persisted session id")
                                .required(true),
                        )
                        .arg(
                            Arg::new("output-directory")
                                .index(2)
                                .value_name("output-directory")
                                .help("Directory where generated PNG files will be written")
                                .required(true),
                        )
                        .arg(
                            Arg::new("page")
                                .long("page")
                                .value_name("page-number")
                                .help("Export only one 1-based page number"),
                        ),
                )
                .subcommand(
                    Command::new("document.apply")
                        .about("Apply a draw.io document to the specified session")
                        .after_help(
                            "XML input modes (choose exactly one):\n  1. Provide inline XML as the third positional argument\n  2. Use --xml-file <path>\n  3. Use --xml-stdin\n\nExamples:\n  ai-drawio canvas document.apply sess-123 \"update layout\" '<mxfile>...</mxfile>'\n  ai-drawio canvas document.apply sess-123 \"update layout\" --xml-file ./diagram.drawio\n  cat ./diagram.drawio | ai-drawio canvas document.apply sess-123 \"update layout\" --xml-stdin",
                        )
                        .arg(
                            Arg::new("session-id")
                                .index(1)
                                .value_name("session-id")
                                .help("Use the exact persisted session id")
                                .required(true),
                        )
                        .arg(
                            Arg::new("prompt")
                                .index(2)
                                .value_name("prompt")
                                .help("Required summary of the requested apply operation")
                                .required(true),
                        )
                        .arg(
                            Arg::new("xml")
                                .index(3)
                                .value_name("xml")
                                .help("Inline draw.io XML payload")
                                .required_unless_present_any(["xml-file", "xml-stdin"])
                                .conflicts_with("xml-file")
                                .conflicts_with("xml-stdin"),
                        )
                        .arg(
                            Arg::new("xml-file")
                                .long("xml-file")
                                .value_name("path")
                                .help("Read draw.io XML from a file")
                                .conflicts_with("xml")
                                .conflicts_with("xml-stdin"),
                        )
                        .arg(
                            Arg::new("xml-stdin")
                                .long("xml-stdin")
                                .help("Read draw.io XML from stdin")
                                .action(ArgAction::SetTrue)
                                .conflicts_with("xml")
                                .conflicts_with("xml-file"),
                        )
                        .arg(
                            Arg::new("base-version")
                                .long("base-version")
                                .value_name("version")
                                .help("Pass the expected document base version for conflict checks"),
                        )
                        .arg(
                            Arg::new("output-file")
                                .long("output-file")
                                .value_name("path")
                                .help("Write the resulting XML response into a file"),
                        ),
                )
                .subcommand(
                    Command::new("document.restore")
                        .about("Restore a draw.io document without adding canvas history")
                        .after_help(
                            "XML input modes (choose exactly one):\n  1. Provide inline XML as the second positional argument\n  2. Use --xml-file <path>\n  3. Use --xml-stdin\n\nExamples:\n  ai-drawio canvas document.restore sess-123 '<mxfile>...</mxfile>'\n  ai-drawio canvas document.restore sess-123 --xml-file ./snapshot.drawio",
                        )
                        .arg(
                            Arg::new("session-id")
                                .index(1)
                                .value_name("session-id")
                                .help("Use the exact persisted session id")
                                .required(true),
                        )
                        .arg(
                            Arg::new("xml")
                                .index(2)
                                .value_name("xml")
                                .help("Inline draw.io XML payload")
                                .required_unless_present_any(["xml-file", "xml-stdin"])
                                .conflicts_with("xml-file")
                                .conflicts_with("xml-stdin"),
                        )
                        .arg(
                            Arg::new("xml-file")
                                .long("xml-file")
                                .value_name("path")
                                .help("Read draw.io XML from a file")
                                .conflicts_with("xml")
                                .conflicts_with("xml-stdin"),
                        )
                        .arg(
                            Arg::new("xml-stdin")
                                .long("xml-stdin")
                                .help("Read draw.io XML from stdin")
                                .action(ArgAction::SetTrue)
                                .conflicts_with("xml")
                                .conflicts_with("xml-file"),
                        )
                        .arg(
                            Arg::new("base-version")
                                .long("base-version")
                                .value_name("version")
                                .help("Pass the expected document base version for conflict checks"),
                        ),
                ),
        )
}

#[cfg(test)]
mod tests {
    use super::build_cli_command;

    #[test]
    fn top_level_help_lists_common_commands() {
        let help = build_cli_command().render_help().to_string();

        assert!(help.contains("open"));
        assert!(help.contains("Common commands:"));
        assert!(help.contains("ai-drawio canvas document.apply"));
    }

    #[test]
    fn open_help_describes_modes() {
        let open_help = build_cli_command()
            .find_subcommand("open")
            .expect("open subcommand should exist")
            .clone()
            .render_help()
            .to_string();

        assert!(open_help.contains("Launch the desktop app"));
        assert!(open_help.contains("Startup modes:"));
        assert!(open_help.contains("tray"));
        assert!(open_help.contains("window"));
    }

    #[test]
    fn document_apply_help_describes_xml_input_modes() {
        let canvas = build_cli_command()
            .find_subcommand("canvas")
            .expect("canvas subcommand should exist")
            .clone();
        let apply_help = canvas
            .find_subcommand("document.apply")
            .expect("document.apply subcommand should exist")
            .clone()
            .render_help()
            .to_string();

        assert!(apply_help.contains("XML input modes"));
        assert!(apply_help.contains("--xml-file"));
        assert!(apply_help.contains("--xml-stdin"));
        assert!(apply_help.contains("Required summary of the requested apply operation"));
    }
}
