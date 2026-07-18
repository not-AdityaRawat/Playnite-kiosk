# Changelog

## 1.0.0 - 2026-07-17

- Added a fullscreen, controller-ready Playnite library for managed Windows gaming sessions.
- Added protected administrator provisioning with Argon2id password hashing, session expiry, throttled failed login attempts, and audit logs.
- Added protected game configuration, offline Steam/Epic discovery review, configuration transfer without credentials, and controlled kiosk exit.
- Added tracked direct, command, batch, and PowerShell launches plus monitored URI-game returns.
- Added Windows release packaging and kiosk deployment documentation.
- Authenticated administrator access now temporarily restores a normal debug window and re-applies Playnite's kiosk window state when locked.
