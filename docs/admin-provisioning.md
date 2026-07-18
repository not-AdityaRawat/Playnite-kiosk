# Administrator Provisioning

## Set the first password

1. Install or launch Playnite on the machine that will host the kiosk.
2. Before assigning the machine to players, press `Ctrl+Shift+F12`.
3. The first administrator screen asks for a new password and confirmation. Use at least 12 characters.
4. After setup, use the Library section to add approved games. URI games require the game executable name, such as `Game.exe`, so Playnite can return when the game ends.
5. Use **Lock admin** before leaving the machine. The authenticated session also expires after 15 minutes without an administrative action.

## Debugging window mode

After successful administrator authentication, Playnite exits fullscreen and restores its title bar, resize controls, minimize/maximize controls, taskbar presence, and normal z-order. This is intended for trusted debugging and game configuration.

Choosing **Lock admin** re-applies Playnite's fullscreen, borderless, non-resizable, non-minimizable, non-maximizable, topmost kiosk window state. It also clears the active admin session, even if that session has expired.

The password is converted immediately to an Argon2id hash using a unique random salt and stored in Playnite's SQLite database. The plaintext password is not written to configuration exports, logs, or source files.

## Operational rules

- Complete initial setup while the account still has trusted administrator supervision. Before a password exists, anyone with access to the first-run setup hotkey could claim the administrator role.
- Do not place the password in `about.md`, a JSON file, source code, registry values, launcher arguments, or an environment variable.
- Use the Security section to rotate the password. It requires the current password.
- Configuration export/import transfers game records only. It intentionally excludes credentials and active sessions.
- Windows account and Shell Launcher/Assigned Access policy remain separate deployment controls. AppLocker, Group Policy, Shell Launcher, Assigned Access, and other Windows restrictions are not disabled by Playnite's debugging window mode. See [Windows kiosk deployment](windows-kiosk-deployment.md).
