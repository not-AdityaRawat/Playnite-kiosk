mod auth;
mod db;
mod discovery;
mod error;
mod launcher;
mod models;

use std::sync::Mutex;

use db::{delete_game, find_game, get_password_hash, has_admin_password, list_all_games, list_games as database_list_games, list_logs, open_database, replace_games, set_password_hash, upsert_game, write_log};
use error::AppError;
use models::{AdminSession, AdminStatus, ConfigurationExport, DiscoveryCandidate, Game, GameInput, LogEntry};
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};

struct AppState {
    database: Mutex<rusqlite::Connection>,
    auth: Mutex<auth::AuthState>,
}

#[tauri::command]
fn list_games(state: State<'_, AppState>) -> Result<Vec<Game>, AppError> {
    let connection = state.database.lock().expect("database lock poisoned");
    database_list_games(&connection)
}

#[tauri::command]
fn launch_game(game_id: String, state: State<'_, AppState>, app: AppHandle) -> Result<(), AppError> {
    let game = {
        let connection = state.database.lock().expect("database lock poisoned");
        find_game(&connection, &game_id)?
    };
    let launch_result = launcher::launch(&game)?;
    {
        let connection = state.database.lock().expect("database lock poisoned");
        write_log(&connection, "info", "game_launch_requested", Some(&game.id))?;
    }
    if let Some(window) = app.get_webview_window("main") { let _ = window.hide(); }
    let restore_app = app.clone();
    let completed_game_id = game.id.clone();
    std::thread::spawn(move || {
        match launch_result {
            launcher::LaunchResult::Tracked(mut child) => { let _ = child.wait(); }
            launcher::LaunchResult::External(process_name) => launcher::wait_for_external_process(&process_name),
        }
        if let Some(window) = restore_app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
        let _ = restore_app.emit("game-session-ended", completed_game_id);
    });
    Ok(())
}

#[tauri::command]
fn admin_status(state: State<'_, AppState>) -> Result<AdminStatus, AppError> {
    let connection = state.database.lock().expect("database lock poisoned");
    Ok(AdminStatus { initialized: has_admin_password(&connection)? })
}

#[tauri::command]
fn initialize_admin(password: String, state: State<'_, AppState>) -> Result<AdminSession, AppError> {
    let password_hash = auth::hash_password(&password)?;
    let mut auth_state = state.auth.lock().expect("authentication lock poisoned");
    let connection = state.database.lock().expect("database lock poisoned");
    if has_admin_password(&connection)? { return Err(AppError::AdminAlreadyInitialized); }
    set_password_hash(&connection, &password_hash)?;
    write_log(&connection, "info", "admin_password_initialized", None)?;
    Ok(auth::create_session(&mut auth_state))
}

#[tauri::command]
fn authenticate_admin(password: String, state: State<'_, AppState>) -> Result<AdminSession, AppError> {
    let password_hash = {
        let connection = state.database.lock().expect("database lock poisoned");
        get_password_hash(&connection)?.ok_or(AppError::AdminNotInitialized)?
    };
    let mut auth_state = state.auth.lock().expect("authentication lock poisoned");
    let result = auth::authenticate(&mut auth_state, &password, &password_hash);
    let connection = state.database.lock().expect("database lock poisoned");
    match &result {
        Ok(_) => write_log(&connection, "info", "admin_authenticated", None)?,
        Err(_) => write_log(&connection, "warning", "admin_authentication_failed", None)?,
    }
    result
}

#[tauri::command]
fn logout_admin(session_token: String, state: State<'_, AppState>) -> Result<(), AppError> {
    let mut auth_state = state.auth.lock().expect("authentication lock poisoned");
    auth::authorize(&mut auth_state, &session_token)?;
    auth::logout(&mut auth_state);
    Ok(())
}

#[tauri::command]
fn change_admin_password(session_token: String, current_password: String, new_password: String, state: State<'_, AppState>) -> Result<(), AppError> {
    let mut auth_state = state.auth.lock().expect("authentication lock poisoned");
    auth::authorize(&mut auth_state, &session_token)?;
    let password_hash = {
        let connection = state.database.lock().expect("database lock poisoned");
        get_password_hash(&connection)?.ok_or(AppError::AdminNotInitialized)?
    };
    if !auth::verify_password(&current_password, &password_hash) { return Err(AppError::InvalidCredentials); }
    let next_hash = auth::hash_password(&new_password)?;
    let connection = state.database.lock().expect("database lock poisoned");
    set_password_hash(&connection, &next_hash)?;
    write_log(&connection, "info", "admin_password_changed", None)?;
    Ok(())
}

#[tauri::command]
fn admin_list_games(session_token: String, state: State<'_, AppState>) -> Result<Vec<Game>, AppError> {
    authorize(&state, &session_token)?;
    let connection = state.database.lock().expect("database lock poisoned");
    list_all_games(&connection)
}

#[tauri::command]
fn admin_save_game(session_token: String, game: GameInput, state: State<'_, AppState>) -> Result<Game, AppError> {
    authorize(&state, &session_token)?;
    validate_game(&game)?;
    let connection = state.database.lock().expect("database lock poisoned");
    let saved_game = upsert_game(&connection, &game)?;
    write_log(&connection, "info", "game_saved", Some(&saved_game.id))?;
    Ok(saved_game)
}

#[tauri::command]
fn admin_delete_game(session_token: String, game_id: String, state: State<'_, AppState>) -> Result<(), AppError> {
    authorize(&state, &session_token)?;
    let connection = state.database.lock().expect("database lock poisoned");
    delete_game(&connection, &game_id)?;
    write_log(&connection, "info", "game_deleted", Some(&game_id))?;
    Ok(())
}

#[tauri::command]
fn admin_list_logs(session_token: String, state: State<'_, AppState>) -> Result<Vec<LogEntry>, AppError> {
    authorize(&state, &session_token)?;
    let connection = state.database.lock().expect("database lock poisoned");
    list_logs(&connection, 100)
}

#[tauri::command]
fn admin_discover_games(session_token: String, state: State<'_, AppState>) -> Result<Vec<DiscoveryCandidate>, AppError> {
    authorize(&state, &session_token)?;
    let candidates = discovery::discover_local_games();
    let connection = state.database.lock().expect("database lock poisoned");
    write_log(&connection, "info", "local_discovery_completed", Some(&candidates.len().to_string()))?;
    Ok(candidates)
}

#[tauri::command]
fn admin_export_configuration(session_token: String, state: State<'_, AppState>) -> Result<ConfigurationExport, AppError> {
    authorize(&state, &session_token)?;
    let connection = state.database.lock().expect("database lock poisoned");
    let games = list_all_games(&connection)?.into_iter().map(|game| GameInput {
        id: Some(game.id), name: game.name, launch_method: game.launch_method, executable: game.executable,
        working_directory: game.working_directory, arguments: game.arguments, icon_path: game.icon_path, process_name: game.process_name,
        accent: game.accent, sort_order: game.sort_order, visible: game.visible,
    }).collect();
    write_log(&connection, "info", "configuration_exported", None)?;
    Ok(ConfigurationExport { schema_version: 1, games })
}

#[tauri::command]
fn admin_import_configuration(session_token: String, configuration: ConfigurationExport, state: State<'_, AppState>) -> Result<(), AppError> {
    authorize(&state, &session_token)?;
    if configuration.schema_version != 1 { return Err(AppError::InvalidGame("unsupported configuration version".into())); }
    if configuration.games.len() > 1000 { return Err(AppError::InvalidGame("configuration contains too many games".into())); }
    for game in &configuration.games { validate_game(game)?; }
    let mut connection = state.database.lock().expect("database lock poisoned");
    replace_games(&mut connection, &configuration.games)?;
    write_log(&connection, "info", "configuration_imported", Some(&configuration.games.len().to_string()))?;
    Ok(())
}

#[tauri::command]
fn exit_kiosk(session_token: String, state: State<'_, AppState>, app: AppHandle) -> Result<(), AppError> {
    authorize(&state, &session_token)?;
    app.exit(0);
    Ok(())
}

fn authorize(state: &State<'_, AppState>, session_token: &str) -> Result<(), AppError> {
    let mut auth_state = state.auth.lock().expect("authentication lock poisoned");
    auth::authorize(&mut auth_state, session_token)
}

fn validate_game(game: &GameInput) -> Result<(), AppError> {
    const LAUNCH_METHODS: [&str; 9] = ["direct_exe", "steam_uri", "epic_uri", "ea_uri", "ubisoft_uri", "battlenet_uri", "custom_command", "powershell_script", "batch_file"];
    if game.name.trim().is_empty() || game.name.chars().count() > 160 { return Err(AppError::InvalidGame("name must contain 1-160 characters".into())); }
    if game.executable.trim().is_empty() || game.executable.len() > 2048 { return Err(AppError::InvalidGame("launch target must contain 1-2048 characters".into())); }
    if !LAUNCH_METHODS.contains(&game.launch_method.as_str()) { return Err(AppError::InvalidGame("unsupported launch method".into())); }
    if game.arguments.as_deref().is_some_and(|value| value.len() > 4096) { return Err(AppError::InvalidGame("arguments must be 4096 characters or fewer".into())); }
    if game.working_directory.as_deref().is_some_and(|value| value.len() > 2048) { return Err(AppError::InvalidGame("working directory must be 2048 characters or fewer".into())); }
    if game.process_name.as_deref().is_some_and(|value| value.len() > 255 || value.contains(['\\', '/', ':'])) { return Err(AppError::InvalidGame("process name must be a filename only".into())); }
    if matches!(game.launch_method.as_str(), "steam_uri" | "epic_uri" | "ea_uri" | "ubisoft_uri" | "battlenet_uri") && game.process_name.as_deref().is_none_or(str::is_empty) { return Err(AppError::InvalidGame("URI launch methods require a game process name".into())); }
    let accent = game.accent.as_bytes();
    if accent.len() != 7 || accent[0] != b'#' || !accent[1..].iter().all(u8::is_ascii_hexdigit) { return Err(AppError::InvalidGame("accent must be a six-digit hex color".into())); }
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let database = open_database(&data_dir).map_err(|error| -> Box<dyn std::error::Error> { Box::new(error) })?;
            app.manage(AppState { database: Mutex::new(database), auth: Mutex::new(auth::AuthState::default()) });
            if let Some(window) = app.get_webview_window("main") {
                window.on_window_event(|event| {
                    if let WindowEvent::CloseRequested { api, .. } = event { api.prevent_close(); }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_games, launch_game, admin_status, initialize_admin, authenticate_admin, logout_admin,
            change_admin_password, admin_list_games, admin_save_game, admin_delete_game, admin_list_logs,
            admin_export_configuration, admin_import_configuration, admin_discover_games, exit_kiosk
        ])
        .run(tauri::generate_context!())
        .expect("error while running Playnite");
}
