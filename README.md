# Fanavaran CLI

Local developer CLI for the Fanavaran LMS. One command to run the API, student site, admin dashboard, and Expo app — on **macOS** and **Windows**.

```bash
fanavaran
```

```
  What do you want to run?
    1) app            API + Expo + emulator
    2) student web    API + Student site
    3) dashboard      API + Admin LMS
    4) api
    5) all web        API + Student + Dashboard
```

Project folders can live anywhere. The CLI detects them, or you save the path once.

---

## What it controls

| Folder | Role | Local URL |
| --- | --- | --- |
| `Fanavaran-API` | Express / MySQL API | http://localhost:3201/health |
| `Fanavaran-Student` | Student web app | http://localhost:8585 |
| `Fanavaran-Dashboard` | Admin LMS | http://localhost:7676 |
| `Fanavaran-Application` | Student mobile app (Expo) | http://localhost:8081 |

These four git repos stay independent. This CLI only sits next to them and starts / stops / builds them.

---

## Folder layout

Clone the four repos into **one parent folder**, then put this `cli` directory beside them. Names must match:

```
fanavaran/
├── Fanavaran-API/
├── Fanavaran-Application/
├── Fanavaran-Dashboard/
├── Fanavaran-Student/
└── cli/                    ← this repository
```

The parent path can be anything, for example:

- macOS: `~/Desktop/development/fanavaran`
- Windows: `C:\work\fanavaran`

---

## Requirements

**Every machine**

- Node.js 18 or newer
- npm
- git
- Redis on `:6379`
- MySQL on `:3306`

**App (Android)**

- Android Studio / Android SDK
- An emulator AVD (default name: `flutter_emulator`)

**App (iOS)** — macOS only

- Xcode + iOS Simulator (default: `iPhone 16 Pro`)

**Cloud builds**

- An Expo account (`npx eas-cli login`)

Run `fanavaran doctor` after setup to see what is missing.

---

## Install

### macOS

```bash
cd /path/to/fanavaran/cli
node bin/fanavaran.js setup
```

The wizard:

1. Asks for the workspace path (Enter accepts the guess)
2. Writes a `fanavaran` launcher to `~/bin`
3. Optionally runs `npm install` in each repo

Open a **new** terminal, then:

```bash
fanavaran doctor
fanavaran
```

### Windows

1. Install [Node.js 18+](https://nodejs.org/)
2. Clone the four repos + this `cli` folder into one directory
3. In PowerShell:

```powershell
cd C:\path\to\fanavaran\cli
node bin/fanavaran.js setup
```

Close the terminal and open a new one so PATH updates.

```powershell
fanavaran doctor
fanavaran
```

iOS Simulator does not exist on Windows. The CLI will use Android instead.

### If `fanavaran` is not found

```bash
# run it directly
node /path/to/fanavaran/cli/bin/fanavaran.js help

# or save the path by hand
fanavaran config set root /path/to/fanavaran
```

Environment override (no config file needed):

```bash
# macOS / Linux
export FANAVARAN_ROOT=/path/to/fanavaran

# Windows PowerShell
$env:FANAVARAN_ROOT="C:\work\fanavaran"
```

Saved settings live in `~/.fanavaran/config.json`.

---

## Everyday workflow

### Start something

```bash
fanavaran                  # menu: app / student / dashboard / api / all
fanavaran app              # then asks: android / ios / both
fanavaran web              # API + student site, opens the browser
fanavaran dashboard        # API + admin LMS
fanavaran all              # API + student + dashboard
```

### While the mobile app is running

| Key | What it does |
| --- | --- |
| `Shift+R` | Restart the app on the open emulator(s). Emulators stay up. |
| `Ctrl+C` | Asks: **1. close app?** (default yes) · **2. quit emulator?** (default no) |

Closing the app stops Expo. It does **not** kill the emulator unless you say yes to question 2.

### Stop / inspect

```bash
fanavaran stop             # API + web + Expo (emulators stay up)
fanavaran status           # ports, URLs, student login
fanavaran logs             # follow everything
fanavaran logs api         # follow one service
```

`Ctrl+C` in `fanavaran logs` only leaves the log view. Services keep running.

---

## Command reference

### Start

| Command | What starts |
| --- | --- |
| `fanavaran` | Interactive menu |
| `fanavaran start` | Same as `fanavaran` |
| `fanavaran app` | API + Expo, then asks Android / iOS / both |
| `fanavaran app android` | API + Android emulator + Expo Go |
| `fanavaran app ios` | API + iOS Simulator + Expo Go (macOS) |
| `fanavaran app both` | API + Android + iOS + Expo Go |
| `fanavaran android` | Shortcut for `fanavaran app android` |
| `fanavaran ios` | Shortcut for `fanavaran app ios` |
| `fanavaran both` | Shortcut for `fanavaran app both` |
| `fanavaran web` | API + Student site, opens the browser |
| `fanavaran student` | Alias of `web` |
| `fanavaran dashboard` | API + Admin LMS, opens the browser |
| `fanavaran admin` | Alias of `dashboard` |
| `fanavaran api` | API only (also starts Redis if needed via `npm run dev`) |
| `fanavaran all` | API + Student + Dashboard |

### Control

| Command | What it does |
| --- | --- |
| `fanavaran stop` | Stop API, student, dashboard, and Expo |
| `fanavaran stop app` | Stop Expo only |
| `fanavaran stop web` | Stop the student site |
| `fanavaran stop api` | Stop the API |
| `fanavaran stop dashboard` | Stop the admin LMS |
| `fanavaran restart` | Stop everything, then ask what to start |
| `fanavaran status` | URLs, ports, health, student login |
| `fanavaran logs` | Follow all service logs |
| `fanavaran logs api` | Follow API logs |
| `fanavaran logs app` | Follow Expo logs |
| `fanavaran logs student` | Follow student-site logs |
| `fanavaran logs dashboard` | Follow dashboard logs |
| `fanavaran open` | Open the student site |
| `fanavaran open student` | Same |
| `fanavaran open dashboard` | Open the admin LMS |
| `fanavaran open api` | Open the API in the browser |

Stop never quits Android / iOS emulators. Use `Ctrl+C` → quit emulator while the app session is running, or close them yourself.

### Build (EAS preview)

Produces an **internal / downloadable** APK or IPA (not a Play Store AAB). Waits for the cloud build, prints the Expo download link, copies it, and opens it.

```bash
fanavaran build              # asks android / ios / both
fanavaran build android
fanavaran build ios
fanavaran build both
```

You must be logged in to Expo first:

```bash
cd Fanavaran-Application
npx eas-cli login
```

### Workspace

| Command | What it does |
| --- | --- |
| `fanavaran setup` | First-run wizard: path, launcher, optional `npm install` |
| `fanavaran init` | Alias of `setup` |
| `fanavaran doctor` | Check Node, repos, Redis, MySQL, Android SDK, Xcode |
| `fanavaran config` | Show saved paths |
| `fanavaran config set root <path>` | Save a new workspace path |
| `fanavaran config set avd <name>` | Android emulator AVD name |
| `fanavaran config set iosSimulator <name>` | iOS Simulator device name |
| `fanavaran config set easProfile <name>` | EAS profile (default `preview`) |
| `fanavaran repos` | Git branch + dirty file count per repo |
| `fanavaran help` | Print this command list |

### Flags

Add these to any start command:

| Flag | Effect |
| --- | --- |
| `--no-browser` | Do not open browser tabs (`web` / `dashboard` / `all`) |
| `--no-logs` | Start services and return; do not follow logs |

```bash
fanavaran web --no-browser --no-logs
fanavaran app android --no-logs
```

---

## Ports

| Service | Port |
| --- | --- |
| API | `3201` |
| Student web | `8585` |
| Dashboard | `7676` |
| Expo / Metro | `8081` |
| Redis | `6379` |
| MySQL | `3306` |

---

## Local student login

`fanavaran status` prints the default student test account used on this workspace. Use that for the student site and the Expo app.

The API still needs your local `.env` in `Fanavaran-API` (database, Redis, secrets). Those files are not committed.

---

## How paths work

Resolution order:

1. `FANAVARAN_ROOT`
2. `~/.fanavaran/config.json`
3. Parent of this `cli` folder
4. Walk up from the current directory looking for `Fanavaran-API` + `Fanavaran-Application`

So a teammate can clone into `D:\projects\fanavaran`, run `setup` once, and never think about paths again.

---

## Typical recipes

**Student site**

```bash
fanavaran web
# → http://localhost:8585
```

**Admin panel**

```bash
fanavaran dashboard
# → http://localhost:7676
```

**Android app**

```bash
fanavaran app android
# Shift+R  restart JS + Expo Go
# Ctrl+C   close app, keep emulator
```

**iOS app (Mac)**

```bash
fanavaran app ios
```

**Downloadable APK for QA**

```bash
fanavaran build android
# wait, then use the printed Expo download link
```

**Is my machine ready?**

```bash
fanavaran doctor
fanavaran repos
```

---

## Troubleshooting

| Problem | What to do |
| --- | --- |
| `fanavaran: command not found` | Run `node cli/bin/fanavaran.js setup`, then open a new terminal |
| `workspace not found` | `fanavaran config set root /full/path/to/fanavaran` |
| Redis / MySQL down | Start them, then `fanavaran doctor` |
| Android emulator missing | Create an AVD in Android Studio, or `fanavaran config set avd Your_AVD_Name` |
| iOS on Windows | Not supported. Use `fanavaran app android` |
| Expo Go missing on Android | The CLI installs it from `~/.expo/android-apk-cache` if present; otherwise install Expo Go on the emulator once |
| EAS `not logged in` | `cd Fanavaran-Application && npx eas-cli login` |
| Port already in use | `fanavaran status` then `fanavaran stop` |

Logs for a running stack are under `<workspace>/.run/logs/` (`api.log`, `student.log`, `dashboard.log`, `app.log`).

---

## License

Internal Fanavaran tooling. Not published to npm.
