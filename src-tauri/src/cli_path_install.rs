use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::Manager;

const CLI_COMMAND_PATH: &str = "/usr/local/bin/ai-drawio";
const INSTALL_SCRIPT_RESOURCE_PATH: &str = "macos/install-cli-to-path.sh";
const ELEVATION_TOOL: &str = "osascript";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CliInstallState {
    NotInstalled,
    Installed,
    InstalledOtherBuild,
    Mismatched,
    Error,
}

impl CliInstallState {
    fn as_str(self) -> &'static str {
        match self {
            Self::NotInstalled => "not_installed",
            Self::Installed => "installed",
            Self::InstalledOtherBuild => "installed_other_build",
            Self::Mismatched => "mismatched",
            Self::Error => "error",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliInstallStatus {
    pub status: String,
    pub command_path: String,
    pub target_path: Option<String>,
    pub completion_installed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliInstallResult {
    pub ok: bool,
    pub command_installed: bool,
    pub completion_installed: bool,
    pub command_path: String,
    pub target_path: Option<String>,
    pub message: String,
    pub error_code: Option<String>,
}

fn script_resource_relative_path() -> &'static str {
    INSTALL_SCRIPT_RESOURCE_PATH
}

fn build_status(
    state: CliInstallState,
    target_path: Option<PathBuf>,
    completion_installed: bool,
) -> CliInstallStatus {
    CliInstallStatus {
        status: state.as_str().to_string(),
        command_path: CLI_COMMAND_PATH.to_string(),
        target_path: target_path.map(|path| path.display().to_string()),
        completion_installed,
    }
}

fn inspect_cli_install(_command_path: &Path, _current_target: &Path) -> CliInstallStatus {
    match fs::symlink_metadata(_command_path) {
        Ok(metadata) => {
            if !metadata.file_type().is_symlink() {
                return build_status(CliInstallState::Error, None, false);
            }

            let raw_target = match fs::read_link(_command_path) {
                Ok(target) => target,
                Err(_) => return build_status(CliInstallState::Error, None, false),
            };
            let resolved_target = resolve_symlink_target(_command_path, &raw_target);
            let normalized_target = normalize_path(&resolved_target);
            let normalized_current_target = normalize_path(_current_target);
            let state = if normalized_target == normalized_current_target {
                CliInstallState::Installed
            } else if is_development_target(&normalized_current_target) {
                CliInstallState::InstalledOtherBuild
            } else {
                CliInstallState::Mismatched
            };

            build_status(state, Some(resolved_target), false)
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            build_status(CliInstallState::NotInstalled, None, false)
        }
        Err(_) => build_status(CliInstallState::Error, None, false),
    }
}

fn is_development_target(path: &Path) -> bool {
    let mut has_target_dir = false;
    let mut has_debug_dir = false;

    for component in path.components() {
        let value = component.as_os_str().to_string_lossy();
        if value == "target" {
            has_target_dir = true;
        }
        if value == "debug" {
            has_debug_dir = true;
        }
    }

    has_target_dir && has_debug_dir
}

fn resolve_symlink_target(command_path: &Path, raw_target: &Path) -> PathBuf {
    if raw_target.is_absolute() {
        raw_target.to_path_buf()
    } else {
        command_path
            .parent()
            .unwrap_or_else(|| Path::new("/"))
            .join(raw_target)
    }
}

fn normalize_path(path: &Path) -> PathBuf {
    fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

fn bundled_completion_source_dir(app_binary_path: &Path) -> PathBuf {
    app_binary_path
        .parent()
        .and_then(Path::parent)
        .map(|contents_dir| contents_dir.join("SharedSupport/cli-completions"))
        .unwrap_or_else(|| {
            PathBuf::from("/Applications/AI Drawio.app/Contents/SharedSupport/cli-completions")
        })
}

fn completion_assets_available(completion_source_dir: &Path) -> bool {
    ["_ai-drawio", "ai-drawio.bash", "ai-drawio.fish"]
        .iter()
        .any(|name| completion_source_dir.join(name).exists())
}

fn build_install_result(
    ok: bool,
    command_installed: bool,
    completion_installed: bool,
    target_path: Option<PathBuf>,
    message: &str,
    error_code: Option<&str>,
) -> CliInstallResult {
    CliInstallResult {
        ok,
        command_installed,
        completion_installed,
        command_path: CLI_COMMAND_PATH.to_string(),
        target_path: target_path.map(|path| path.display().to_string()),
        message: message.to_string(),
        error_code: error_code.map(str::to_string),
    }
}

fn escape_applescript_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

fn build_installer_shell_command(
    script_path: &Path,
    app_binary_path: &Path,
    completion_source_dir: &Path,
) -> String {
    format!(
        "/bin/sh {} {} {}",
        shell_quote(&script_path.display().to_string()),
        shell_quote(&app_binary_path.display().to_string()),
        shell_quote(&completion_source_dir.display().to_string())
    )
}

fn build_osascript_command(shell_command: &str) -> String {
    format!(
        "do shell script \"{}\" with administrator privileges",
        escape_applescript_string(shell_command)
    )
}

fn map_install_command_output(
    exit_code: Option<i32>,
    stdout: &str,
    stderr: &str,
    target_path: &Path,
) -> CliInstallResult {
    let stdout = stdout.trim();
    let stderr = stderr.trim();
    let message = if stderr.is_empty() { stdout } else { stderr };

    if message.to_ascii_lowercase().contains("user canceled")
        || message.to_ascii_lowercase().contains("user cancelled")
        || message.contains("(-128)")
    {
        return build_install_result(
            false,
            false,
            false,
            Some(target_path.to_path_buf()),
            "Administrator authorization was cancelled.",
            Some("USER_CANCELLED"),
        );
    }

    if exit_code == Some(0) {
        let command_installed = stdout.contains("COMMAND_INSTALLED=1");
        let completion_installed = stdout.contains("COMPLETION_INSTALLED=1");

        return build_install_result(
            command_installed,
            command_installed,
            completion_installed,
            Some(target_path.to_path_buf()),
            if completion_installed {
                "CLI command and shell completions installed."
            } else {
                "CLI command installed."
            },
            None,
        );
    }

    build_install_result(
        false,
        false,
        false,
        Some(target_path.to_path_buf()),
        if message.is_empty() {
            "CLI install failed."
        } else {
            message
        },
        match exit_code {
            Some(_) => Some("INSTALL_FAILED"),
            None => Some("INSTALL_ERROR"),
        },
    )
}

#[tauri::command]
pub fn get_cli_install_status() -> Result<CliInstallStatus, String> {
    let current_target = std::env::current_exe().map_err(|error| error.to_string())?;
    let completion_source_dir = bundled_completion_source_dir(&current_target);
    let mut status = inspect_cli_install(Path::new(CLI_COMMAND_PATH), &current_target);
    status.completion_installed = completion_assets_available(&completion_source_dir);
    Ok(status)
}

#[tauri::command]
pub fn install_cli_to_path(app: tauri::AppHandle) -> Result<CliInstallResult, String> {
    let target_path = std::env::current_exe().map_err(|error| error.to_string())?;
    let completion_source_dir = bundled_completion_source_dir(&target_path);
    let script_path = app
        .path()
        .resource_dir()
        .map(|dir| dir.join(script_resource_relative_path()))
        .map_err(|error| error.to_string())?;
    let shell_command =
        build_installer_shell_command(&script_path, &target_path, &completion_source_dir);
    let output = Command::new(ELEVATION_TOOL)
        .arg("-e")
        .arg(build_osascript_command(&shell_command))
        .output()
        .map_err(|error| error.to_string())?;

    Ok(map_install_command_output(
        output.status.code(),
        &String::from_utf8_lossy(&output.stdout),
        &String::from_utf8_lossy(&output.stderr),
        &target_path,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn make_temp_dir(label: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time before unix epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("ai-drawio-{label}-{unique}"));
        fs::create_dir_all(&path).expect("failed to create temp test directory");
        path
    }

    #[test]
    fn cli_path_install_status_is_not_installed_when_command_is_missing() {
        let temp_dir = make_temp_dir("missing");
        let command_path = temp_dir.join("ai-drawio");
        let current_target = temp_dir.join("AI Drawio.app/Contents/MacOS/ai-drawio");
        fs::create_dir_all(current_target.parent().expect("missing parent"))
            .expect("failed to create target parent");
        fs::write(&current_target, "binary").expect("failed to write target");

        let status = inspect_cli_install(&command_path, &current_target);

        assert_eq!(status.status, "not_installed");
        assert_eq!(status.target_path, None);
    }

    #[test]
    fn cli_path_install_status_is_installed_when_symlink_matches_current_binary() {
        let temp_dir = make_temp_dir("installed");
        let command_path = temp_dir.join("ai-drawio");
        let current_target = temp_dir.join("AI Drawio.app/Contents/MacOS/ai-drawio");
        fs::create_dir_all(current_target.parent().expect("missing parent"))
            .expect("failed to create target parent");
        fs::write(&current_target, "binary").expect("failed to write target");
        std::os::unix::fs::symlink(&current_target, &command_path).expect("failed to create symlink");

        let status = inspect_cli_install(&command_path, &current_target);

        assert_eq!(status.status, "installed");
        assert_eq!(
            status.target_path,
            Some(current_target.display().to_string())
        );
    }

    #[test]
    fn cli_path_install_status_is_mismatched_when_symlink_points_elsewhere() {
        let temp_dir = make_temp_dir("mismatched");
        let command_path = temp_dir.join("ai-drawio");
        let current_target = temp_dir.join("AI Drawio.app/Contents/MacOS/ai-drawio");
        let other_target = temp_dir.join("Other.app/Contents/MacOS/ai-drawio");
        fs::create_dir_all(current_target.parent().expect("missing parent"))
            .expect("failed to create current target parent");
        fs::create_dir_all(other_target.parent().expect("missing parent"))
            .expect("failed to create other target parent");
        fs::write(&current_target, "binary").expect("failed to write current target");
        fs::write(&other_target, "binary").expect("failed to write other target");
        std::os::unix::fs::symlink(&other_target, &command_path).expect("failed to create symlink");

        let status = inspect_cli_install(&command_path, &current_target);

        assert_eq!(status.status, "mismatched");
        assert_eq!(status.target_path, Some(other_target.display().to_string()));
    }

    #[test]
    fn cli_path_install_status_reports_installed_other_build_for_dev_binary_mismatch() {
        let temp_dir = make_temp_dir("installed-other-build");
        let command_path = temp_dir.join("ai-drawio");
        let current_target = temp_dir.join("src-tauri/target/debug/ai-drawio");
        let other_target = temp_dir.join("AI Drawio.app/Contents/MacOS/ai-drawio");
        fs::create_dir_all(current_target.parent().expect("missing parent"))
            .expect("failed to create current target parent");
        fs::create_dir_all(other_target.parent().expect("missing parent"))
            .expect("failed to create other target parent");
        fs::write(&current_target, "binary").expect("failed to write current target");
        fs::write(&other_target, "binary").expect("failed to write other target");
        std::os::unix::fs::symlink(&other_target, &command_path).expect("failed to create symlink");

        let status = inspect_cli_install(&command_path, &current_target);

        assert_eq!(status.status, "installed_other_build");
        assert_eq!(status.target_path, Some(other_target.display().to_string()));
    }

    #[test]
    fn cli_path_install_script_path_uses_the_bundled_resource_location() {
        assert_eq!(
            script_resource_relative_path(),
            "macos/install-cli-to-path.sh"
        );
    }

    #[test]
    fn cli_path_install_result_keeps_command_and_completion_status_separate() {
        let result = build_install_result(
            true,
            true,
            false,
            Some(PathBuf::from("/Applications/AI Drawio.app/Contents/MacOS/ai-drawio")),
            "Installed command only.",
            None,
        );

        assert!(result.ok);
        assert!(result.command_installed);
        assert!(!result.completion_installed);
        assert_eq!(result.error_code, None);
        assert_eq!(
            result.target_path.as_deref(),
            Some("/Applications/AI Drawio.app/Contents/MacOS/ai-drawio")
        );
    }

    #[test]
    fn cli_path_install_osascript_command_escapes_double_quotes_in_paths() {
        let command = build_osascript_command(
            "/Applications/AI \"Drawio\".app/Contents/Resources/macos/install-cli-to-path.sh",
        );

        assert!(command.contains("\\\"Drawio\\\""));
        assert!(command.contains("with administrator privileges"));
    }

    #[test]
    fn cli_path_install_maps_cancelled_elevation_to_stable_error_code() {
        let result = map_install_command_output(
            Some(1),
            "",
            "execution error: User canceled. (-128)",
            Path::new("/Applications/AI Drawio.app/Contents/MacOS/ai-drawio"),
        );

        assert!(!result.ok);
        assert_eq!(result.error_code.as_deref(), Some("USER_CANCELLED"));
    }

    #[test]
    fn cli_path_install_maps_non_zero_exit_status_to_failure() {
        let result = map_install_command_output(
            Some(2),
            "",
            "install script failed",
            Path::new("/Applications/AI Drawio.app/Contents/MacOS/ai-drawio"),
        );

        assert!(!result.ok);
        assert!(!result.command_installed);
        assert_eq!(result.error_code.as_deref(), Some("INSTALL_FAILED"));
    }

    #[test]
    fn cli_path_install_maps_successful_installer_output_to_success() {
        let result = map_install_command_output(
            Some(0),
            "COMMAND_INSTALLED=1\nCOMPLETION_INSTALLED=0",
            "",
            Path::new("/Applications/AI Drawio.app/Contents/MacOS/ai-drawio"),
        );

        assert!(result.ok);
        assert!(result.command_installed);
        assert!(!result.completion_installed);
        assert_eq!(result.error_code, None);
    }
}
