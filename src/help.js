"use strict";

const ui = require("./ui");

function help() {
  ui.banner();
  console.log(`  ${ui.c.bold("Usage")}
    ${ui.c.cyan("fanavaran")} ${ui.c.dim("[command]")} ${ui.c.dim("[args]")}

  ${ui.c.bold("Start")}
    ${ui.c.cyan("fanavaran")}                  Interactive menu
    ${ui.c.cyan("fanavaran app")}              API + Expo, then Android / iOS / both
    ${ui.c.cyan("fanavaran app android")}
    ${ui.c.cyan("fanavaran app ios")}           ${ui.c.dim("(macOS only)")}
    ${ui.c.cyan("fanavaran app both")}
    ${ui.c.cyan("fanavaran web")}               API + Student site, open browser
    ${ui.c.cyan("fanavaran student")}           Same as web
    ${ui.c.cyan("fanavaran dashboard")}         API + Admin LMS
    ${ui.c.cyan("fanavaran api")}               API only
    ${ui.c.cyan("fanavaran all")}               API + Student + Dashboard

  ${ui.c.bold("Control")}
    ${ui.c.cyan("fanavaran stop")}              Stop API / web / Expo (emulators stay up)
    ${ui.c.cyan("fanavaran stop app")}
    ${ui.c.cyan("fanavaran stop web")}
    ${ui.c.cyan("fanavaran restart")}           Stop, then ask what to start
    ${ui.c.cyan("fanavaran status")}
    ${ui.c.cyan("fanavaran logs")} ${ui.c.dim("[api|app|student|dashboard]")}
    ${ui.c.cyan("fanavaran open")} ${ui.c.dim("[student|dashboard|api]")}

  ${ui.c.bold("App session")} ${ui.c.dim("(while Expo is running)")}
    ${ui.c.cyan("Shift+R")}                    Restart the app on open emulator(s)
    ${ui.c.cyan("Ctrl+C")}                     1: close app?   2: quit emulator?

  ${ui.c.bold("Build")}
    ${ui.c.cyan("fanavaran build")}             EAS preview build + download link
    ${ui.c.cyan("fanavaran build android")}
    ${ui.c.cyan("fanavaran build ios")}
    ${ui.c.cyan("fanavaran build both")}

  ${ui.c.bold("Workspace")}
    ${ui.c.cyan("fanavaran setup")}             Detect / save project path, install launcher
    ${ui.c.cyan("fanavaran doctor")}            Check Node, repos, Redis, MySQL, Android, iOS
    ${ui.c.cyan("fanavaran config")}            Show saved paths
    ${ui.c.cyan("fanavaran config set root")} ${ui.c.dim("<path>")}
    ${ui.c.cyan("fanavaran repos")}             Git branch of each repo

  ${ui.c.bold("Flags")}
    ${ui.c.cyan("--no-browser")}               Do not open browser tabs
    ${ui.c.cyan("--no-logs")}                  Do not follow logs after start

  ${ui.c.dim("Project root is auto-detected, or saved in ~/.fanavaran/config.json")}
  ${ui.c.dim("Override anytime with FANAVARAN_ROOT=/path/to/fanavaran")}
`);
}

module.exports = { help };
