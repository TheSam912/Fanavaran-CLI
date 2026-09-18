# Fanavaran CLI

One command to run the Fanavaran API, student site, admin dashboard, and Expo app.

Works on **macOS** and **Windows**. iOS Simulator is Mac only.

---

## 1. Put the folders together

Clone these next to each other. Names must match:

```
fanavaran/
  Fanavaran-API/
  Fanavaran-Application/
  Fanavaran-Dashboard/
  Fanavaran-Student/
  Fanavaran-CLI/          ← this repo
```

The parent folder can be anywhere (`~/Desktop/fanavaran`, `C:\work\fanavaran`, …).

---

## 2. Install once

You need **Node.js 18+**, plus **Redis** (`:6379`) and **MySQL** (`:3306`) running.

```bash
cd Fanavaran-CLI
node bin/fanavaran.js setup
```

- Press Enter if the guessed path is correct
- Say yes to `npm install` when asked

Open a **new** terminal, then check:

```bash
fanavaran doctor
```

If `fanavaran` is not found:

```bash
node bin/fanavaran.js setup
```

Path wrong? Fix it:

```bash
fanavaran config set root /full/path/to/fanavaran
```

---

## 3. Run

```bash
fanavaran
```

```
1) app            API + Expo + emulator
2) student web    API + student site     → http://localhost:8585
3) dashboard      API + admin LMS        → http://localhost:7676
4) api            API only               → http://localhost:3201
5) all web        API + student + dashboard
```

Or skip the menu:

```bash
fanavaran web
fanavaran dashboard
fanavaran app android
fanavaran app ios          # Mac only
fanavaran stop
fanavaran status
```

While the **app** is running:

- `Shift+R` — restart the app (emulator stays up)
- `Ctrl+C` — 1: close app?  2: quit emulator?

---

## 4. Build an APK / IPA

```bash
cd Fanavaran-Application
npx eas-cli login

fanavaran build android
# or:  fanavaran build ios
```

Wait. The download link is printed, copied, and opened.

---

## Stuck?

```bash
fanavaran doctor
fanavaran stop
fanavaran help
```
