use clap::{Arg, ArgAction, Command};

pub fn build_cli_command() -> Command {
    Command::new("ai-drawio")
        .disable_help_subcommand(true)
        .subcommand(Command::new("status").about("Inspect the running desktop shell state"))
        .subcommand(
            Command::new("conversation")
                .about("Manage local conversations")
                .subcommand(Command::new("create").about("Create a new local conversation")),
        )
        .subcommand(
            Command::new("session")
                .about("Inspect or open local sessions")
                .subcommand(Command::new("list").about("List all local sessions"))
                .subcommand(
                    Command::new("open")
                        .about("Open one local session")
                        .arg(
                            Arg::new("session-id")
                                .index(1)
                                .value_name("session-id")
                                .required_unless_present("title"),
                        )
                        .arg(
                            Arg::new("title")
                                .long("title")
                                .value_name("session-title")
                                .conflicts_with("session-id"),
                        ),
                ),
        )
        .subcommand(
            Command::new("canvas")
                .about("Read or write the active draw.io document")
                .subcommand(
                    Command::new("document.get")
                        .about("Read the current draw.io document")
                        .arg(Arg::new("session").long("session").value_name("session-id"))
                        .arg(
                            Arg::new("session-title")
                                .long("session-title")
                                .value_name("session-title")
                                .conflicts_with("session"),
                        )
                        .arg(
                            Arg::new("output-file")
                                .long("output-file")
                                .value_name("path"),
                        ),
                )
                .subcommand(
                    Command::new("document.svg")
                        .about("Export the current draw.io document as per-page SVG")
                        .arg(Arg::new("session").long("session").value_name("session-id"))
                        .arg(
                            Arg::new("session-title")
                                .long("session-title")
                                .value_name("session-title")
                                .conflicts_with("session"),
                        )
                        .arg(
                            Arg::new("output-file")
                                .long("output-file")
                                .value_name("path"),
                        ),
                )
                .subcommand(
                    Command::new("document.apply")
                        .about("Apply a draw.io document to the resolved session")
                        .arg(Arg::new("prompt").index(1).value_name("prompt").required(true))
                        .arg(
                            Arg::new("xml")
                                .index(2)
                                .value_name("xml")
                                .required_unless_present_any(["xml-file", "xml-stdin"])
                                .conflicts_with("xml-file")
                                .conflicts_with("xml-stdin"),
                        )
                        .arg(
                            Arg::new("xml-file")
                                .long("xml-file")
                                .value_name("path")
                                .conflicts_with("xml")
                                .conflicts_with("xml-stdin"),
                        )
                        .arg(
                            Arg::new("xml-stdin")
                                .long("xml-stdin")
                                .action(ArgAction::SetTrue)
                                .conflicts_with("xml")
                                .conflicts_with("xml-file"),
                        )
                        .arg(Arg::new("session").long("session").value_name("session-id"))
                        .arg(
                            Arg::new("session-title")
                                .long("session-title")
                                .value_name("session-title")
                                .conflicts_with("session"),
                        )
                        .arg(
                            Arg::new("base-version")
                                .long("base-version")
                                .value_name("version"),
                        )
                        .arg(
                            Arg::new("output-file")
                                .long("output-file")
                                .value_name("path"),
                        ),
                )
                .subcommand(
                    Command::new("document.restore")
                        .about("Restore a draw.io document without adding canvas history")
                        .arg(
                            Arg::new("xml")
                                .index(1)
                                .value_name("xml")
                                .required_unless_present_any(["xml-file", "xml-stdin"])
                                .conflicts_with("xml-file")
                                .conflicts_with("xml-stdin"),
                        )
                        .arg(
                            Arg::new("xml-file")
                                .long("xml-file")
                                .value_name("path")
                                .conflicts_with("xml")
                                .conflicts_with("xml-stdin"),
                        )
                        .arg(
                            Arg::new("xml-stdin")
                                .long("xml-stdin")
                                .action(ArgAction::SetTrue)
                                .conflicts_with("xml")
                                .conflicts_with("xml-file"),
                        )
                        .arg(Arg::new("session").long("session").value_name("session-id"))
                        .arg(
                            Arg::new("session-title")
                                .long("session-title")
                                .value_name("session-title")
                                .conflicts_with("session"),
                        )
                        .arg(
                            Arg::new("base-version")
                                .long("base-version")
                                .value_name("version"),
                        ),
                ),
        )
}
