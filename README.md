# Playnite

Playnite is a focused Windows game library for managed gaming environments. It opens directly to a controller-ready library, lets a user search and launch an approved game, and returns to the library when the game session ends.

## Current vertical slice

- Fullscreen, borderless Tauri window configuration
- Responsive React game library with search, selected state, and launch overlay
- SQLite game catalog and timestamped launch logs; the packaged catalog starts empty
- Argon2id-hashed administrator password, time-limited admin sessions, and audited admin actions
- Direct executable, launcher URI, custom-command, PowerShell, and batch launch support
- Browser development mode with a representative local library

Browser development mode uses representative records only. The native catalog intentionally starts empty until an administrator adds or imports approved titles through the protected game-management screen.

## First administrator password

Launch the installed application and press `Ctrl+Shift+F12` before exposing the kiosk to players. The first administrator panel creates the password; no password is present in the installer, source tree, or configuration. See [administrator provisioning](docs/admin-provisioning.md) for the required deployment sequence.

## Run locally

```powershell
npm install
npm run dev
```

For a production frontend build:

```powershell
npm run build
```

To run the native application, install the Rust stable toolchain and Windows C++ build tools, then use:

```powershell
npm run tauri dev
```

## Architecture

- `src/`: React application, view components, client state, and Tauri command client
- `src-tauri/src/db.rs`: SQLite schema, migrations, catalog queries, and audit log persistence
- `src-tauri/src/launcher.rs`: narrowly scoped game launch execution
- `src-tauri/src/lib.rs`: native command registration and application initialization
- `docs/`: deployment and security requirements

## Security boundary

This application is not, by itself, a Windows security boundary. Topmost fullscreen and disabled window controls improve the focused experience, but Windows policies must prevent system escape paths. See [Windows kiosk deployment](docs/windows-kiosk-deployment.md) before placing Playnite in a user-facing VM.
