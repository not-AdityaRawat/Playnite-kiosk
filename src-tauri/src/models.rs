use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Game {
    pub id: String,
    pub name: String,
    pub launch_method: String,
    pub executable: String,
    pub working_directory: Option<String>,
    pub arguments: Option<String>,
    pub icon_path: Option<String>,
    pub process_name: Option<String>,
    pub accent: String,
    pub sort_order: i32,
    pub visible: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminStatus {
    pub initialized: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminSession {
    pub token: String,
    pub expires_in_seconds: u64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameInput {
    pub id: Option<String>,
    pub name: String,
    pub launch_method: String,
    pub executable: String,
    pub working_directory: Option<String>,
    pub arguments: Option<String>,
    pub icon_path: Option<String>,
    pub process_name: Option<String>,
    pub accent: String,
    pub sort_order: i32,
    pub visible: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    pub created_at: String,
    pub level: String,
    pub event: String,
    pub details: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigurationExport {
    pub schema_version: u8,
    pub games: Vec<GameInput>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryCandidate {
    pub source: String,
    pub game: GameInput,
}
