# Prompt: Build "SkyRig Launcher" — A Lightweight Kiosk Game Launcher for Cloud Gaming

You are an expert Windows desktop software engineer specializing in **Rust (Tauri)**, **ReactJS**, **TypeScript**, and Windows system programming.

Design and build a **production-grade**, **extremely lightweight**, **high-performance** Windows desktop application named **SkyRig Launcher**.

This application is **NOT** a game launcher like Playnite, Steam, or LaunchBox.

Its sole purpose is to present a locked-down game library for cloud gaming users.

It should feel similar to **Xbox Cloud Gaming**, **GeForce NOW**, or **Boosteroid**, except it runs locally inside a Windows VM.

---

# Core Philosophy

The launcher should be **minimal**.

The user should never feel like they are using Windows.

The launcher is essentially the operating system.

No settings.

No menus.

No browser.

No login.

No account.

No profile.

No plugins.

No themes.

No customization.

No desktop access.

The launcher should only do **one thing**:

> Display installed games and launch them.

Nothing else.

---

# Technology Stack

Must use:

* Tauri v2
* Rust backend
* ReactJS
* TypeScript
* Vite
* TailwindCSS
* Zustand
* Framer Motion (minimal animations only)

Do NOT use Electron.

Do NOT use heavy UI libraries.

Avoid unnecessary npm packages.

Memory usage target:

<100 MB RAM

Startup time target:

<500ms

Executable size:

As small as possible.

---

# UI Requirements

The launcher should always open in

Fullscreen

Borderless

TopMost

Always on top

Cannot be resized.

Cannot be minimized.

Cannot be maximized.

Cannot be dragged.

Hide taskbar while active.

Hide cursor when idle.

Dark theme only.

Modern gaming aesthetic.

Black background.

Very smooth.

No flashy animations.

Instant responsiveness.

---

# Kiosk Mode

This application should support a true kiosk mode.

When enabled:

Disable

Alt+F4

Alt+Tab

Windows Key

Taskbar

Start Menu

Explorer shortcuts

Right click menus

Context menus

Dragging files

Win+R

Win+E

F1

F10

Settings

Task Manager shortcuts (where Windows policy allows)

Prevent accidental exits.

If the launcher crashes,

automatically restart itself.

---

# User Experience

When the application starts,

the user immediately sees

```
-----------------------------------

SkyRig

-----------------------------------

[ Search ]

-----------------------------------

🎮 GTA V

🎮 Cyberpunk 2077

🎮 Battlefield 6

🎮 RDR2

🎮 Elden Ring

-----------------------------------
```

Each game card contains only

Game Icon

Game Name

Play Button

Nothing else.

No metadata.

No description.

No genres.

No ratings.

No achievements.

No playtime.

No settings.

No filters except search.

---

# Game Launching

Clicking Play should

Disable launcher input

Show

```
Launching...

```

Then launch the executable.

Supported launch methods

Steam URI

Epic URI

EA URI

Ubisoft URI

Battle.net

Direct EXE

Custom Command

PowerShell Script

Batch File

---

# After Launch

When a game launches

Keep launcher alive.

Hide launcher.

Do NOT exit.

Monitor child process.

When the game exits,

Automatically return launcher.

Fullscreen again.

Focus restored automatically.

---

# Admin Mode

There is NO login system.

Instead,

pressing a secret hotkey

For example

Ctrl+Shift+F12

opens

Password Prompt.

Password stored locally using Argon2 hash.

No usernames.

No accounts.

Single administrator.

If password is correct,

open Admin Panel.

---

# Admin Panel

Admin can

Exit kiosk mode

Leave fullscreen

Access desktop

Restart launcher

Restart Explorer

Shutdown VM

Restart VM

Change password

Import games

Remove games

Edit games

Refresh library

View logs

Open game folders

Edit launch commands

Export configuration

Import configuration

Nothing else.

---

# Admin Game Editor

Admin can manually add games.

Fields

Name

Executable

Launch Method

Working Directory

Arguments

Icon

Banner (optional)

Sort Order

Visible

Hidden

Launch Delay

Close launcher on launch (optional)

Auto return

---

# Automatic Game Detection

Automatically detect installed games from

Steam

Epic Games

EA App

Ubisoft Connect

Battle.net

Xbox App

GOG Galaxy

Detect

Name

Executable

Icon

Install Directory

Launch URI

Steam AppID if available.

No internet required.

No metadata downloads.

---

# Library Storage

Use SQLite.

Very lightweight.

Store

Games

Settings

Password Hash

Launcher Configuration

Hidden Games

Sorting

---

# Performance Goals

Scrolling

60 FPS

Search

Instant

Game launch latency

<100ms overhead

Database loading

<20ms

Application startup

<500ms

Memory

<100MB

CPU idle

~0%

---

# Security

Never expose Windows.

Never expose Explorer.

Never expose Control Panel.

Never expose Settings.

Never expose Registry.

Never expose CMD.

Never expose PowerShell.

Never expose file picker to users.

Users cannot modify library.

Users cannot delete games.

Users cannot open folders.

Users cannot install software.

Users cannot exit launcher.

Users cannot access browser.

---

# Configuration

Configuration stored locally.

Example

```json
{
  "kiosk": true,
  "fullscreen": true,
  "topMost": true,
  "autoRestart": true,
  "adminHotkey": "Ctrl+Shift+F12",
  "passwordHash": "...",
  "returnAfterExit": true
}
```

---

# Crash Recovery

If launcher crashes

Restart automatically.

If game crashes

Return launcher.

If launcher loses focus

Bring to foreground.

If Explorer starts

Terminate it (optional configurable).

---

# Accessibility

Gamepad support.

Keyboard support.

Mouse support.

Arrow navigation.

Enter launches game.

Esc does nothing.

---

# Future Plugin Architecture

Design the codebase so future modules can be added without major refactoring, such as:

* Cloud save integration
* Per-game launch hooks
* Session timers
* VM usage statistics
* Streaming status
* Admin remote control
* Multi-user game assignment

Keep these disabled by default and isolate them behind clean interfaces.

---

# Code Quality

Use a modular architecture with clear separation between:

* UI
* State management
* Database
* Launcher service
* Game discovery
* Process monitoring
* Kiosk management
* Admin tools

Follow SOLID principles where practical, use strict TypeScript, and keep the Rust backend focused on system-level functionality.

Generate production-quality code, comprehensive documentation, and an architecture that can scale while remaining lightweight and easy to maintain.

---

# Additional Features 

* **Game process detection:** Detect child processes so launchers like Steam or EA App don't cause the launcher to return too early.
* **Global inactivity timer:** Optionally end the session or return to the library after a configurable idle period.
* **Controller-first navigation:** Make the entire interface fully usable with an Xbox or PlayStation controller.
* **Detailed logging:** Maintain timestamped logs for launches, crashes, and admin actions to simplify debugging.
* **Single-file distribution:** Package the application into a compact installer with minimal runtime dependencies.

The final result should feel like a dedicated cloud gaming console interface rather than a Windows application, with instant responsiveness, strong kiosk behavior, and a clean, distraction-free experience focused entirely on launching games.
