"use strict";

const readline = require("readline");
const ui = require("./ui");
const { urls } = require("./config");
const proc = require("./proc");
const stack = require("./stack");
const devices = require("./devices");

async function restartApp(cfg, platform, iosUdid) {
  ui.blank();
  ui.heading("Restarting app…");
  devices.forceStopAndroidApp();
  devices.terminateIosApp(iosUdid);
  stack.stopNamed(cfg, "app");
  await proc.sleep(400);
  stack.startExpo(cfg);
  await proc.waitFor("Expo", () => proc.portOpen(cfg.ports.app), 90, ui);
  await devices.relaunch(cfg, platform, iosUdid);
  ui.ok("app restarted");
}

function closeApp(cfg, iosUdid) {
  ui.heading("Closing app…");
  devices.forceStopAndroidApp();
  devices.terminateIosApp(iosUdid);
  stack.stopNamed(cfg, "app");
  ui.ok("app closed (emulator left running)");
}

function quitEmulators(platform, iosUdid) {
  ui.heading("Quitting emulator(s)…");
  if (devices.wantAndroid(platform)) devices.quitAndroid();
  if (devices.wantIos(platform)) devices.quitIos(iosUdid);
  ui.ok("emulator(s) quit");
}

async function askInterrupt() {
  ui.blank();
  ui.heading("What should I close?");
  const closeAppYes = await ui.confirm(`${ui.c.yellow("1: close app?")}`, true);
  const quitEmu = await ui.confirm(`${ui.c.red("2: quit emulator?")}`, false);
  return { closeAppYes, quitEmu };
}

async function runAppInteractive(cfg, platform, iosUdid) {
  if (!process.stdin.isTTY) {
    const stop = stack.followLogs(cfg, ["api", "app"]);
    await new Promise((resolve) => process.once("SIGINT", resolve));
    stop();
    return;
  }

  ui.heading("Live logs");
  console.log(ui.keyHint("Shift+R", "restart app"));
  console.log(ui.keyHint("Ctrl+C", "1: close app?   2: quit emulator?"));
  ui.dim("────────────────────────────────────────────────");

  const stopLogs = stack.followLogs(cfg, ["api", "app"], { quiet: true });
  readline.emitKeypressEvents(process.stdin);
  const ignoreSigint = () => {};
  process.on("SIGINT", ignoreSigint);

  await new Promise((resolve) => {
    let raw = false;
    const enableRaw = () => {
      if (process.stdin.isTTY && !raw) {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        raw = true;
      }
    };
    const disableRaw = () => {
      if (process.stdin.isTTY && raw) {
        process.stdin.setRawMode(false);
        raw = false;
      }
    };

    const onKey = async (str, key) => {
      if (!key) return;
      if (key.ctrl && key.name === "c") {
        disableRaw();
        process.stdin.pause();
        const { closeAppYes, quitEmu } = await askInterrupt();
        if (!closeAppYes && !quitEmu) {
          ui.dim("still running — Shift+R restart · Ctrl+C close menu");
          process.stdin.resume();
          enableRaw();
          return;
        }
        if (closeAppYes) closeApp(cfg, iosUdid);
        if (quitEmu) quitEmulators(platform, iosUdid);
        if (closeAppYes) {
          process.stdin.off("keypress", onKey);
          process.off("SIGINT", ignoreSigint);
          disableRaw();
          stopLogs();
          resolve();
          return;
        }
        process.stdin.resume();
        enableRaw();
        return;
      }
      if (key.shift && key.name === "r") {
        disableRaw();
        await restartApp(cfg, platform, iosUdid);
        enableRaw();
      }
    };

    process.stdin.on("keypress", onKey);
    enableRaw();
  });
}

async function startApiReady(cfg) {
  stack.startApi(cfg);
  await proc.waitFor("API", () => proc.httpOk(urls(cfg).apiHealth), 90, ui);
}

async function startAppFlow(cfg, platform, flags) {
  ui.heading(`Starting Fanavaran app (${platform})…`);
  await startApiReady(cfg);
  const iosUdid = await devices.prepareDevices(cfg, platform);
  stack.startExpo(cfg);
  await proc.waitFor("Expo", () => proc.portOpen(cfg.ports.app), 90, ui);
  await devices.relaunch(cfg, platform, iosUdid);
  stack.printStatus(cfg);
  ui.dim("Keys:     Shift+R restart app · Ctrl+C close app / quit emulator");
  ui.blank();
  if (!flags.noLogs) {
    await runAppInteractive(cfg, platform, iosUdid);
  }
}

async function startStudentFlow(cfg, flags) {
  ui.heading("Starting Fanavaran student web…");
  await startApiReady(cfg);
  stack.startStudent(cfg);
  await proc.waitFor("Student web", () => proc.portOpen(cfg.ports.student), 90, ui);
  stack.printStatus(cfg);
  if (!flags.noBrowser) proc.openUrl(urls(cfg).student);
  if (!flags.noLogs) {
    const stop = stack.followLogs(cfg, ["api", "student"]);
    await new Promise((resolve) => process.once("SIGINT", resolve));
    stop();
  }
}

async function startDashboardFlow(cfg, flags) {
  ui.heading("Starting Fanavaran dashboard…");
  await startApiReady(cfg);
  stack.startDashboard(cfg);
  await proc.waitFor("Dashboard", () => proc.portOpen(cfg.ports.dashboard), 90, ui);
  stack.printStatus(cfg);
  if (!flags.noBrowser) proc.openUrl(urls(cfg).dashboard);
  if (!flags.noLogs) {
    const stop = stack.followLogs(cfg, ["api", "dashboard"]);
    await new Promise((resolve) => process.once("SIGINT", resolve));
    stop();
  }
}

async function startApiFlow(cfg, flags) {
  ui.heading("Starting Fanavaran API…");
  await startApiReady(cfg);
  stack.printStatus(cfg);
  if (!flags.noLogs) {
    const stop = stack.followLogs(cfg, ["api"]);
    await new Promise((resolve) => process.once("SIGINT", resolve));
    stop();
  }
}

async function startAllWebFlow(cfg, flags) {
  ui.heading("Starting Fanavaran web stack…");
  await startApiReady(cfg);
  stack.startStudent(cfg);
  stack.startDashboard(cfg);
  await proc.waitFor("Student web", () => proc.portOpen(cfg.ports.student), 90, ui);
  await proc.waitFor("Dashboard", () => proc.portOpen(cfg.ports.dashboard), 90, ui);
  stack.printStatus(cfg);
  if (!flags.noBrowser) {
    proc.openUrl(urls(cfg).student);
    proc.openUrl(urls(cfg).dashboard);
  }
  if (!flags.noLogs) {
    const stop = stack.followLogs(cfg, ["api", "student", "dashboard"]);
    await new Promise((resolve) => process.once("SIGINT", resolve));
    stop();
  }
}

module.exports = {
  startAppFlow,
  startStudentFlow,
  startDashboardFlow,
  startApiFlow,
  startAllWebFlow,
};
