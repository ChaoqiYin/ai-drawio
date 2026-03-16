mod cli_schema {
    include!("src/cli_schema.rs");
}

use clap_complete::{generate_to, Shell};
use std::env;
use std::fs;
use std::path::PathBuf;

fn completion_output_dir() -> PathBuf {
    PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("missing CARGO_MANIFEST_DIR"))
        .join("target")
        .join("cli-completions")
}

fn main() {
    let output_dir = completion_output_dir();
    fs::create_dir_all(&output_dir).expect("failed to create cli completion output directory");

    for shell in [Shell::Bash, Shell::Fish, Shell::Zsh] {
        let mut command = cli_schema::build_cli_command();
        generate_to(shell, &mut command, "ai-drawio", &output_dir)
            .expect("failed to generate shell completion");
    }

    tauri_build::build()
}
