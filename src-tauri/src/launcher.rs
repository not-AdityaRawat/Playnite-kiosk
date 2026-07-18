use std::process::{Child, Command};
use std::thread;
use std::time::Duration;

use crate::error::AppError;
use crate::models::Game;

pub enum LaunchResult {
    Tracked(Child),
    External(String),
}

pub fn launch(game: &Game) -> Result<LaunchResult, AppError> {
    match game.launch_method.as_str() {
        "direct_exe" => launch_executable(game).map(LaunchResult::Tracked),
        "steam_uri" | "epic_uri" | "ea_uri" | "ubisoft_uri" | "battlenet_uri" => {
            open_uri(&game.executable)?;
            game.process_name.clone().map(LaunchResult::External).ok_or_else(|| AppError::InvalidGame("URI launch methods require a game process name".into()))
        }
        "custom_command" => launch_command(game).map(LaunchResult::Tracked),
        "powershell_script" => launch_powershell(game).map(LaunchResult::Tracked),
        "batch_file" => launch_batch(game).map(LaunchResult::Tracked),
        other => Err(AppError::UnsupportedLaunchMethod(other.to_string())),
    }
}

pub fn wait_for_external_process(process_name: &str) {
    let appeared = (0..60).any(|_| {
        if process_is_running(process_name) { return true; }
        thread::sleep(Duration::from_secs(1));
        false
    });
    if !appeared { return; }
    while process_is_running(process_name) {
        thread::sleep(Duration::from_secs(1));
    }
}

fn launch_executable(game: &Game) -> Result<Child, AppError> {
    let mut command = Command::new(&game.executable);
    apply_game_options(&mut command, game)?;
    command.spawn().map_err(AppError::Launch)
}

fn launch_command(game: &Game) -> Result<Child, AppError> {
    let parts = shell_words::split(&game.executable).map_err(|_| AppError::UnsupportedLaunchMethod("invalid custom command".into()))?;
    let (program, arguments) = parts.split_first().ok_or_else(|| AppError::UnsupportedLaunchMethod("empty custom command".into()))?;
    let mut command = Command::new(program);
    command.args(arguments);
    apply_game_options(&mut command, game)?;
    command.spawn().map_err(AppError::Launch)
}

fn launch_powershell(game: &Game) -> Result<Child, AppError> {
    let mut command = Command::new("powershell.exe");
    command.args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", &game.executable]);
    apply_game_options(&mut command, game)?;
    command.spawn().map_err(AppError::Launch)
}

fn launch_batch(game: &Game) -> Result<Child, AppError> {
    let mut command = Command::new("cmd.exe");
    command.args(["/d", "/c", &game.executable]);
    apply_game_options(&mut command, game)?;
    command.spawn().map_err(AppError::Launch)
}

fn apply_game_options(command: &mut Command, game: &Game) -> Result<(), AppError> {
    if let Some(arguments) = &game.arguments {
        command.args(shell_words::split(arguments).map_err(|_| AppError::UnsupportedLaunchMethod("invalid command arguments".into()))?);
    }
    if let Some(directory) = &game.working_directory {
        command.current_dir(directory);
    }
    Ok(())
}

fn open_uri(uri: &str) -> Result<(), AppError> {
    Command::new("explorer.exe").arg(uri).spawn().map(|_| ()).map_err(AppError::Launch)
}

fn process_is_running(process_name: &str) -> bool {
    let filter = format!("IMAGENAME eq {process_name}");
    let Ok(output) = Command::new("tasklist").args(["/FI", &filter, "/NH"]).output() else { return false; };
    String::from_utf8_lossy(&output.stdout).to_ascii_lowercase().contains(&process_name.to_ascii_lowercase())
}
