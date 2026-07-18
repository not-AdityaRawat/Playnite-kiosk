use std::time::{Duration, Instant};

use argon2::{password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString}, Algorithm, Argon2, Params, Version};
use rand_core::OsRng;

use crate::error::AppError;
use crate::models::AdminSession;

const MIN_PASSWORD_LENGTH: usize = 12;
const SESSION_TTL: Duration = Duration::from_secs(15 * 60);

struct ActiveSession {
    token: String,
    expires_at: Instant,
}

pub struct AuthState {
    active_session: Option<ActiveSession>,
    failed_attempts: u32,
    locked_until: Option<Instant>,
}

impl Default for AuthState {
    fn default() -> Self {
        Self { active_session: None, failed_attempts: 0, locked_until: None }
    }
}

pub fn hash_password(password: &str) -> Result<String, AppError> {
    validate_password(password)?;
    let salt = SaltString::generate(&mut OsRng);
    let params = Params::new(19_456, 2, 1, None).map_err(|_| AppError::InvalidCredentials)?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|_| AppError::InvalidCredentials)
}

pub fn verify_password(password: &str, stored_hash: &str) -> bool {
    let Ok(parsed_hash) = PasswordHash::new(stored_hash) else { return false; };
    Argon2::default().verify_password(password.as_bytes(), &parsed_hash).is_ok()
}

pub fn authenticate(state: &mut AuthState, password: &str, stored_hash: &str) -> Result<AdminSession, AppError> {
    if let Some(until) = state.locked_until {
        if until > Instant::now() {
            return Err(AppError::AuthenticationLocked(until.saturating_duration_since(Instant::now()).as_secs().max(1)));
        }
        state.locked_until = None;
    }

    if !verify_password(password, stored_hash) {
        state.failed_attempts = state.failed_attempts.saturating_add(1);
        let lock_duration = match state.failed_attempts {
            5..=7 => Some(Duration::from_secs(30)),
            8.. => Some(Duration::from_secs(5 * 60)),
            _ => None,
        };
        if let Some(duration) = lock_duration {
            state.locked_until = Some(Instant::now() + duration);
        }
        return Err(AppError::InvalidCredentials);
    }

    state.failed_attempts = 0;
    state.locked_until = None;
    Ok(issue_session(state))
}

pub fn create_session(state: &mut AuthState) -> AdminSession {
    issue_session(state)
}

pub fn authorize(state: &mut AuthState, token: &str) -> Result<(), AppError> {
    let Some(session) = state.active_session.as_mut() else { return Err(AppError::Unauthorized); };
    if session.token != token || session.expires_at <= Instant::now() {
        state.active_session = None;
        return Err(AppError::Unauthorized);
    }
    session.expires_at = Instant::now() + SESSION_TTL;
    Ok(())
}

pub fn logout(state: &mut AuthState) {
    state.active_session = None;
}

fn issue_session(state: &mut AuthState) -> AdminSession {
    let token = uuid::Uuid::new_v4().to_string();
    state.active_session = Some(ActiveSession { token: token.clone(), expires_at: Instant::now() + SESSION_TTL });
    AdminSession { token, expires_in_seconds: SESSION_TTL.as_secs() }
}

fn validate_password(password: &str) -> Result<(), AppError> {
    if password.chars().count() < MIN_PASSWORD_LENGTH {
        return Err(AppError::WeakPassword);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::error::AppError;
    use super::{authenticate, authorize, hash_password, verify_password, AuthState};

    #[test]
    fn hashes_and_verifies_a_password_without_retaining_plaintext() {
        let hash = hash_password("a long test password").expect("hash should be created");
        assert_ne!(hash, "a long test password");
        assert!(verify_password("a long test password", &hash));
        assert!(!verify_password("incorrect password", &hash));
    }

    #[test]
    fn issues_a_session_only_for_valid_credentials() {
        let hash = hash_password("a long test password").expect("hash should be created");
        let mut state = AuthState::default();
        assert!(authenticate(&mut state, "incorrect password", &hash).is_err());
        let session = authenticate(&mut state, "a long test password", &hash).expect("valid password should authenticate");
        assert!(authorize(&mut state, &session.token).is_ok());
    }

    #[test]
    fn rejects_short_passwords_and_throttles_repeated_failures() {
        assert!(matches!(hash_password("too short"), Err(AppError::WeakPassword)));
        let hash = hash_password("a long test password").expect("hash should be created");
        let mut state = AuthState::default();
        for _ in 0..5 { assert!(authenticate(&mut state, "incorrect password", &hash).is_err()); }
        assert!(matches!(authenticate(&mut state, "incorrect password", &hash), Err(AppError::AuthenticationLocked(_))));
    }
}
