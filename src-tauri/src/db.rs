use std::fs;
use std::path::Path;

use rusqlite::{params, Connection, OptionalExtension};

use crate::error::AppError;
use crate::models::Game;
use crate::models::{GameInput, LogEntry};

pub fn open_database(data_dir: &Path) -> Result<Connection, AppError> {
    fs::create_dir_all(data_dir)?;
    let connection = Connection::open(data_dir.join("playnite.db"))?;
    connection.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS games (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            launch_method TEXT NOT NULL,
            executable TEXT NOT NULL,
            working_directory TEXT,
            arguments TEXT,
            icon_path TEXT,
            process_name TEXT,
            accent TEXT NOT NULL DEFAULT '#75d7cb',
            sort_order INTEGER NOT NULL DEFAULT 0,
            visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1))
        );
        CREATE TABLE IF NOT EXISTS app_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            level TEXT NOT NULL,
            event TEXT NOT NULL,
            details TEXT
        );
        CREATE TABLE IF NOT EXISTS admin_credentials (
            singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
            password_hash TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ",
    )?;
    ensure_process_name_column(&connection)?;
    Ok(connection)
}

fn ensure_process_name_column(connection: &Connection) -> Result<(), AppError> {
    let mut statement = connection.prepare("SELECT name FROM pragma_table_info('games')")?;
    let columns = statement.query_map([], |row| row.get::<_, String>(0))?.collect::<Result<Vec<_>, _>>()?;
    if !columns.iter().any(|column| column == "process_name") {
        connection.execute("ALTER TABLE games ADD COLUMN process_name TEXT", [])?;
    }
    Ok(())
}

pub fn has_admin_password(connection: &Connection) -> Result<bool, AppError> {
    let count: i64 = connection.query_row("SELECT COUNT(*) FROM admin_credentials", [], |row| row.get(0))?;
    Ok(count == 1)
}

pub fn get_password_hash(connection: &Connection) -> Result<Option<String>, AppError> {
    connection
        .query_row("SELECT password_hash FROM admin_credentials WHERE singleton = 1", [], |row| row.get(0))
        .optional()
        .map_err(AppError::from)
}

pub fn set_password_hash(connection: &Connection, password_hash: &str) -> Result<(), AppError> {
    connection.execute(
        "INSERT INTO admin_credentials (singleton, password_hash, updated_at) VALUES (1, ?1, CURRENT_TIMESTAMP)
         ON CONFLICT(singleton) DO UPDATE SET password_hash = excluded.password_hash, updated_at = CURRENT_TIMESTAMP",
        [password_hash],
    )?;
    Ok(())
}

pub fn list_games(connection: &Connection) -> Result<Vec<Game>, AppError> {
    let mut statement = connection.prepare(
        "SELECT id, name, launch_method, executable, working_directory, arguments, icon_path, process_name, accent, sort_order, visible
         FROM games WHERE visible = 1 ORDER BY sort_order ASC, name COLLATE NOCASE ASC",
    )?;
    let games = statement.query_map([], game_from_row)?;
    games.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

pub fn list_all_games(connection: &Connection) -> Result<Vec<Game>, AppError> {
    let mut statement = connection.prepare(
        "SELECT id, name, launch_method, executable, working_directory, arguments, icon_path, process_name, accent, sort_order, visible
         FROM games ORDER BY sort_order ASC, name COLLATE NOCASE ASC",
    )?;
    let games = statement.query_map([], game_from_row)?;
    games.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

pub fn find_game(connection: &Connection, game_id: &str) -> Result<Game, AppError> {
    connection.query_row(
        "SELECT id, name, launch_method, executable, working_directory, arguments, icon_path, process_name, accent, sort_order, visible
         FROM games WHERE id = ?1",
        [game_id],
        game_from_row,
    ).map_err(|error| match error {
        rusqlite::Error::QueryReturnedNoRows => AppError::GameNotFound,
        other => AppError::Database(other),
    })
}

fn game_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Game> {
    Ok(Game {
        id: row.get(0)?,
        name: row.get(1)?,
        launch_method: row.get(2)?,
        executable: row.get(3)?,
        working_directory: row.get(4)?,
        arguments: row.get(5)?,
        icon_path: row.get(6)?,
        process_name: row.get(7)?,
        accent: row.get(8)?,
        sort_order: row.get(9)?,
        visible: row.get::<_, i32>(10)? == 1,
    })
}

pub fn upsert_game(connection: &Connection, game: &GameInput) -> Result<Game, AppError> {
    let id = game.id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    connection.execute(
        "INSERT INTO games (id, name, launch_method, executable, working_directory, arguments, icon_path, process_name, accent, sort_order, visible)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name, launch_method = excluded.launch_method, executable = excluded.executable,
           working_directory = excluded.working_directory, arguments = excluded.arguments, icon_path = excluded.icon_path, process_name = excluded.process_name,
           accent = excluded.accent, sort_order = excluded.sort_order, visible = excluded.visible",
        params![
            id,
            game.name.trim(),
            game.launch_method,
            game.executable.trim(),
            empty_to_none(&game.working_directory),
            empty_to_none(&game.arguments),
            empty_to_none(&game.icon_path),
            empty_to_none(&game.process_name),
            game.accent,
            game.sort_order,
            i32::from(game.visible),
        ],
    )?;
    find_game(connection, &id)
}

pub fn delete_game(connection: &Connection, game_id: &str) -> Result<(), AppError> {
    let changed = connection.execute("DELETE FROM games WHERE id = ?1", [game_id])?;
    if changed == 0 { return Err(AppError::GameNotFound); }
    Ok(())
}

pub fn replace_games(connection: &mut Connection, games: &[GameInput]) -> Result<(), AppError> {
    let transaction = connection.transaction()?;
    transaction.execute("DELETE FROM games", [])?;
    let mut statement = transaction.prepare(
        "INSERT INTO games (id, name, launch_method, executable, working_directory, arguments, icon_path, process_name, accent, sort_order, visible)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
    )?;
    for game in games {
        let id = game.id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        statement.execute(params![
            id, game.name.trim(), game.launch_method, game.executable.trim(), empty_to_none(&game.working_directory),
            empty_to_none(&game.arguments), empty_to_none(&game.icon_path), empty_to_none(&game.process_name), game.accent, game.sort_order, i32::from(game.visible),
        ])?;
    }
    drop(statement);
    transaction.commit()?;
    Ok(())
}

pub fn list_logs(connection: &Connection, limit: u32) -> Result<Vec<LogEntry>, AppError> {
    let mut statement = connection.prepare(
        "SELECT created_at, level, event, details FROM app_logs ORDER BY id DESC LIMIT ?1",
    )?;
    let records = statement.query_map([limit.min(500)], |row| {
        Ok(LogEntry { created_at: row.get(0)?, level: row.get(1)?, event: row.get(2)?, details: row.get(3)? })
    })?;
    records.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

fn empty_to_none(value: &Option<String>) -> Option<&str> {
    value.as_deref().map(str::trim).filter(|value| !value.is_empty())
}

pub fn write_log(connection: &Connection, level: &str, event: &str, details: Option<&str>) -> Result<(), AppError> {
    connection.execute(
        "INSERT INTO app_logs (level, event, details) VALUES (?1, ?2, ?3)",
        params![level, event, details],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::time::{SystemTime, UNIX_EPOCH};

    use crate::models::GameInput;
    use super::{find_game, list_games, open_database, upsert_game, write_log};

    fn test_data_dir() -> std::path::PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("playnite-test-{}-{nonce}", std::process::id()))
    }

    #[test]
    fn creates_an_empty_catalog_and_persists_audit_events() {
        let data_dir = test_data_dir();
        let connection = open_database(&data_dir).expect("database should initialize");

        assert!(list_games(&connection).expect("catalog should query").is_empty());
        write_log(&connection, "info", "test_event", Some("details")).expect("audit event should persist");

        let event_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM app_logs WHERE event = 'test_event'", [], |row| row.get(0))
            .expect("audit event should be queryable");
        assert_eq!(event_count, 1);

        drop(connection);
        std::fs::remove_dir_all(data_dir).expect("temporary database should be removable");
    }

    #[test]
    fn persists_process_monitoring_configuration() {
        let data_dir = test_data_dir();
        let connection = open_database(&data_dir).expect("database should initialize");
        let saved = upsert_game(&connection, &GameInput {
            id: None, name: "Example Game".into(), launch_method: "steam_uri".into(), executable: "steam://rungameid/1".into(),
            working_directory: None, arguments: None, icon_path: None, process_name: Some("ExampleGame.exe".into()),
            accent: "#75d7cb".into(), sort_order: 1, visible: true,
        }).expect("game should save");
        let reloaded = find_game(&connection, &saved.id).expect("game should reload");
        assert_eq!(reloaded.process_name.as_deref(), Some("ExampleGame.exe"));

        drop(connection);
        std::fs::remove_dir_all(data_dir).expect("temporary database should be removable");
    }
}
