#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Storage error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("Could not create application data directory: {0}")]
    Directory(#[from] std::io::Error),
    #[error("Game not found")]
    GameNotFound,
    #[error("Administrator access is required")]
    Unauthorized,
    #[error("Administrator password has not been configured")]
    AdminNotInitialized,
    #[error("Administrator password is already configured")]
    AdminAlreadyInitialized,
    #[error("The administrator password is incorrect")]
    InvalidCredentials,
    #[error("Too many failed attempts. Try again in {0} seconds")]
    AuthenticationLocked(u64),
    #[error("Password must be at least 12 characters long")]
    WeakPassword,
    #[error("Invalid game configuration: {0}")]
    InvalidGame(String),
    #[error("Unsupported launch method: {0}")]
    UnsupportedLaunchMethod(String),
    #[error("Could not start game: {0}")]
    Launch(std::io::Error),
    #[error("Could not update the Playnite window: {0}")]
    Window(String),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
