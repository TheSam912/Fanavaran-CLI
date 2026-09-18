"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync, execFileSync } = require("child_process");
const ui = require("./ui");
const proc = require("./proc");

function wantAndroid(platform) {
  return platform === "android" || platform === "both";
}

function wantIos(platform) {
  return platform === "ios" || platform === "both";
}

function listAvds() {
  const bin = proc.emulatorBin();
  if (!bin) return [];
  const out = spawnSync(bin, ["-list-avds"], {
    encoding: "utf8",
    env: { ...process.env, ...proc.androidEnv() },
  });
  return String(out.stdout || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function adb(args) {
  const bin = proc.adbBin();
  if (!bin) return { status: 1, stdout: "", stderr: "adb not found" };
  return spawnSync(bin, args, {
    encoding: "utf8",
    env: { ...process.env, ...proc.androidEnv() },
  });
}

function androidBooted() {
  const out = adb(["devices"]);
  if (!/emulator-\d+\s+device/.test(out.stdout || "")) return false;
  const boot = adb(["shell", "getprop", "sys.boot_completed"]);
  return String(boot.stdout || "").trim() === "1";
}

async function startAndroid(cfg) {
  if (androidBooted()) {
    ui.ok("Android emulator already running");
    return true;
  }
  const bin = proc.emulatorBin();
  if (!bin) {
    ui.fail(`Android emulator not found at ${proc.androidSdk()}`);
    return false;
  }
  const avds = listAvds();
  const avd = avds.includes(cfg.avd) ? cfg.avd : avds[0];
  if (!avd) {
    ui.fail("No Android Virtual Device found. Create one in Android Studio.");
    return false;
  }
  ui.info(`opening Android emulator (${avd})`);
  const child = spawn(bin, ["-avd", avd, "-netdelay", "none", "-netspeed", "full"], {
    detached: true,
    windowsHide: true,
    stdio: "ignore",
    env: { ...process.env, ...proc.androidEnv() },
  });
  child.unref();
  proc.writePid(cfg, "emulator", child.pid);
  for (let i = 0; i < 90; i++) {
    if (androidBooted()) {
      ui.ok("Android emulator ready");
      return true;
    }
    await proc.sleep(2000);
  }
  ui.fail("Android emulator did not boot in time");
  return false;
}

function installExpoGo() {
  if (!androidBooted()) return false;
  const has = adb(["shell", "pm", "path", "host.exp.exponent"]);
  if (has.status === 0 && /package:/.test(has.stdout || "")) {
    ui.ok("Expo Go already installed");
    return true;
  }
  const cache = path.join(os.homedir(), ".expo", "android-apk-cache");
  let apk = null;
  if (fs.existsSync(cache)) {
    apk = fs
      .readdirSync(cache)
      .filter((f) => /expo-go.*\.apk$/i.test(f))
      .sort()
      .map((f) => path.join(cache, f))
      .pop();
  }
  if (!apk || !fs.existsSync(apk)) {
    ui.warn("Expo Go APK not found. Open Expo Go on the emulator once, or install it from expo.dev");
    return false;
  }
  ui.info("installing Expo Go");
  const res = adb(["install", "-r", apk]);
  if (res.status === 0) {
    ui.ok("Expo Go installed");
    return true;
  }
  ui.warn("could not install Expo Go APK");
  return false;
}

function reverseAndroidPorts(cfg) {
  adb(["reverse", `tcp:${cfg.ports.app}`, `tcp:${cfg.ports.app}`]);
  adb(["reverse", `tcp:${cfg.ports.api}`, `tcp:${cfg.ports.api}`]);
  ui.ok(`adb reverse :${cfg.ports.app} and :${cfg.ports.api}`);
}

function launchAndroidApp(cfg) {
  adb([
    "shell",
    "am",
    "start",
    "-a",
    "android.intent.action.VIEW",
    "-d",
    `exp://127.0.0.1:${cfg.ports.app}`,
    "host.exp.exponent",
  ]);
  ui.ok("opened latest app in Expo Go (Android)");
}

function forceStopAndroidApp() {
  adb(["shell", "am", "force-stop", "host.exp.exponent"]);
}

function quitAndroid() {
  ui.info("quitting Android emulator");
  adb(["emu", "kill"]);
}

function pickIosUdid(preferredName) {
  if (!proc.isMac) return null;
  try {
    const out = execFileSync("xcrun", ["simctl", "list", "devices", "available"], {
      encoding: "utf8",
    });
    const booted = out.match(/iPhone [^\n]*\(([A-F0-9-]{36})\) \(Booted\)/);
    if (booted) return booted[1];
    const named = [...out.matchAll(new RegExp(`${preferredName} \\(([A-F0-9-]{36})\\)`, "g"))];
    if (named.length) return named[named.length - 1][1];
    const any = [...out.matchAll(/iPhone [^\n]*\(([A-F0-9-]{36})\)/g)];
    if (any.length) return any[any.length - 1][1];
  } catch {
    return null;
  }
  return null;
}

function iosBooted(udid) {
  if (!proc.isMac || !udid) return false;
  try {
    const out = execFileSync("xcrun", ["simctl", "list", "devices", "booted"], {
      encoding: "utf8",
    });
    return out.includes(udid);
  } catch {
    return false;
  }
}

async function startIos(cfg) {
  if (!proc.isMac) {
    ui.warn("iOS Simulator is only available on macOS");
    return { ok: false, udid: null };
  }
  const udid = pickIosUdid(cfg.iosSimulator);
  if (!udid) {
    ui.fail("No iOS Simulator found. Install Xcode simulators first.");
    return { ok: false, udid: null };
  }
  if (iosBooted(udid)) {
    ui.ok("iOS Simulator already running");
    spawn("open", ["-a", "Simulator"], { detached: true, stdio: "ignore" }).unref();
    return { ok: true, udid };
  }
  ui.info(`opening iOS Simulator (${cfg.iosSimulator})`);
  spawnSync("xcrun", ["simctl", "boot", udid], { stdio: "ignore" });
  spawn("open", ["-a", "Simulator", "--args", "-CurrentDeviceUDID", udid], {
    detached: true,
    stdio: "ignore",
  }).unref();
  spawnSync("xcrun", ["simctl", "bootstatus", udid, "-b"], { stdio: "ignore" });
  if (iosBooted(udid)) {
    ui.ok("iOS Simulator ready");
    return { ok: true, udid };
  }
  ui.fail("iOS Simulator did not boot in time");
  return { ok: false, udid };
}

function iosHasExpoGo(udid) {
  if (!udid) return false;
  const res = spawnSync("xcrun", ["simctl", "get_app_container", udid, "host.exp.Exponent", "data"], {
    stdio: "ignore",
  });
  return res.status === 0;
}

function launchIosApp(cfg, udid) {
  if (!udid) return false;
  if (!iosHasExpoGo(udid)) {
    ui.warn("Expo Go is not on the iOS Simulator yet — open it once from Expo (press i)");
  }
  spawnSync("xcrun", ["simctl", "openurl", udid, `exp://127.0.0.1:${cfg.ports.app}`], {
    stdio: "ignore",
  });
  ui.ok("opened latest app in Expo Go (iOS)");
  return true;
}

function terminateIosApp(udid) {
  if (!udid) return;
  spawnSync("xcrun", ["simctl", "terminate", udid, "host.exp.Exponent"], { stdio: "ignore" });
}

function quitIos(udid) {
  ui.info("quitting iOS Simulator");
  if (udid) spawnSync("xcrun", ["simctl", "shutdown", udid], { stdio: "ignore" });
  spawnSync("osascript", ["-e", 'tell application "Simulator" to quit'], { stdio: "ignore" });
}

async function relaunch(cfg, platform, iosUdid) {
  if (wantAndroid(platform)) {
    if (androidBooted()) {
      reverseAndroidPorts(cfg);
      forceStopAndroidApp();
      launchAndroidApp(cfg);
    } else {
      ui.warn("Android emulator not ready");
    }
  }
  if (wantIos(platform)) {
    if (iosBooted(iosUdid)) {
      terminateIosApp(iosUdid);
      launchIosApp(cfg, iosUdid);
    } else if (proc.isMac) {
      ui.warn("iOS Simulator not ready");
    }
  }
}

async function prepareDevices(cfg, platform) {
  let iosUdid = null;
  if (wantAndroid(platform)) {
    await startAndroid(cfg);
    installExpoGo();
  }
  if (wantIos(platform)) {
    const result = await startIos(cfg);
    iosUdid = result.udid;
  }
  return iosUdid;
}

module.exports = {
  wantAndroid,
  wantIos,
  androidBooted,
  startAndroid,
  installExpoGo,
  reverseAndroidPorts,
  launchAndroidApp,
  forceStopAndroidApp,
  quitAndroid,
  startIos,
  launchIosApp,
  terminateIosApp,
  quitIos,
  iosBooted,
  relaunch,
  prepareDevices,
};
