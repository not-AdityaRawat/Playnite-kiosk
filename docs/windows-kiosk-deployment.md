# Windows Kiosk Deployment

## Purpose

Playnite provides the game library and launches approved titles. Windows must provide the actual session lockdown. Do not rely on a fullscreen application to block privileged system behavior.

## Required baseline

1. Use a dedicated standard local account for play sessions; administration must use a separate account.
2. Configure Shell Launcher or Assigned Access so the Playnite executable is the session shell.
3. Restrict `explorer.exe`, Settings, Control Panel, Command Prompt, PowerShell, Registry Editor, Task Manager, and browser access with Group Policy plus AppLocker or WDAC.
4. Restrict removable media, network shares, installers, and unapproved executables according to the VM's operating model.
5. Configure automatic sign-in only when the VM's physical and hypervisor security model permits it.
6. Run a separate watchdog or service to restart Playnite when its process exits unexpectedly.

## Validation checklist

- Verify `Alt+Tab`, Windows-key actions, `Win+R`, `Win+E`, Ctrl+Alt+Delete options, and common Explorer entry points with the play-session account.
- Verify a game crash restores the Playnite shell and focus.
- Verify reboot, power loss, and Playnite crash recovery.
- Verify the administrator recovery path without granting the play-session account desktop access.
- Verify each approved launcher and game works under the restricted account.

## Scope notes

Playnite's planned admin panel deliberately handles only its own catalog and configuration. OS policy, user provisioning, and recovery controls remain deployment-owned and must be versioned with the VM image.
