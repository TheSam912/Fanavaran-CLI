"use strict";

const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawn, spawnSync, execFileSync } = require("child_process");

const isWin = process.platform === "win32";
const isMac = process.platform === "darwin";

function npmCmd() {
  return isWin ? "npm.cmd" : "npm";
}

function npxCmd() {
  return isWin ? "npx.cmd" : "npx";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function which(bin) {
  try {
    const out = spawnSync(isWin ? "where" : "which", [bin], { encoding: "utf8" });
    if (out.status !== 0) return null;
    return String(out.stdout || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find(Boolean) || null;
  } catch {
    return null;
  }
}

function pidFile(cfg, name) {
  return path.join(cfg.pidDir, `${name}.pid`);
}

function writePid(cfg, name, pid) {
  fs.writeFileSync(pidFile(cfg, name), String(pid));
}

function readPid(cfg, name) {
  try {
    const raw = fs.readFileSync(pidFile(cfg, name), "utf8").trim();
    const pid = Number(raw);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function clearPid(cfg, name) {
  try {
    fs.unlinkSync(pidFile(cfg, name));
  } catch {
    /* ignore */
  }
}

function isAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function portOpen(port, host = "127.0.0.1", timeout = 700) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeout);
    socket.on("connect", () => done(true));
    socket.on("timeout", () => done(false));
    socket.on("error", () => done(false));
  });
}

async function httpOk(url, timeout = 3000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    return res.ok;
  } catch {
    return false;
  }
}

function pidOnPort(port) {
  try {
    if (isWin) {
      const out = execFileSync("netstat", ["-ano"], { encoding: "utf8" });
      const rows = out.split(/\r?\n/).filter((line) => line.includes(`:${port}`));
      for (const line of rows) {
        if (!/LISTENING/i.test(line)) continue;
        const parts = line.trim().split(/\s+/);
        const pid = Number(parts[parts.length - 1]);
        if (pid) return pid;
      }
      return null;
    }
    const out = execFileSync(
      "lsof",
      ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"],
      { encoding: "utf8" }
    );
    const pid = Number(String(out).trim().split(/\s+/)[0]);
    return pid || null;
  } catch {
    return null;
  }
}

function killPid(pid) {
  if (!pid || !isAlive(pid)) return;
  if (isWin) {
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* ignore */
    }
  }
  spawnSync("pkill", ["-P", String(pid)], { stdio: "ignore" });
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    /* ignore */
  }
}

function stopPort(port) {
  const pid = pidOnPort(port);
  if (pid) killPid(pid);
}

function startDetached(command, args, { cwd, env, logFile }) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const fd = fs.openSync(logFile, "w");
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    detached: true,
    windowsHide: true,
    stdio: ["ignore", fd, fd],
    shell: isWin,
  });
  child.unref();
  fs.closeSync(fd);
  return child.pid;
}

function openUrl(url) {
  if (isWin) {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  if (isMac) {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}

function lanIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const netInfo of ifaces[name] || []) {
      if (netInfo.family === "IPv4" && !netInfo.internal) return netInfo.address;
    }
  }
  return "n/a";
}

function androidSdk() {
  if (process.env.ANDROID_HOME && fs.existsSync(process.env.ANDROID_HOME)) {
    return process.env.ANDROID_HOME;
  }
  if (process.env.ANDROID_SDK_ROOT && fs.existsSync(process.env.ANDROID_SDK_ROOT)) {
    return process.env.ANDROID_SDK_ROOT;
  }
  const guesses = isWin
    ? [path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk")]
    : [
        path.join(os.homedir(), "Library", "Android", "sdk"),
        path.join(os.homedir(), "Android", "Sdk"),
      ];
  return guesses.find((p) => p && fs.existsSync(p)) || guesses[0];
}

function javaHome() {
  if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) {
    return process.env.JAVA_HOME;
  }
  const guesses = isMac
    ? ["/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"]
    : [];
  return guesses.find((p) => fs.existsSync(p)) || process.env.JAVA_HOME || "";
}

function androidEnv() {
  const sdk = androidSdk();
  const java = javaHome();
  const extra = [
    java ? path.join(java, "bin") : "",
    path.join(sdk, "emulator"),
    path.join(sdk, "platform-tools"),
  ].filter(Boolean);
  return {
    ANDROID_HOME: sdk,
    ANDROID_SDK_ROOT: sdk,
    ...(java ? { JAVA_HOME: java } : {}),
    PATH: [...extra, process.env.PATH || ""].join(path.delimiter),
  };
}

function emulatorBin() {
  const sdk = androidSdk();
  const bin = path.join(sdk, "emulator", isWin ? "emulator.exe" : "emulator");
  return fs.existsSync(bin) ? bin : which("emulator");
}

function adbBin() {
  const sdk = androidSdk();
  const bin = path.join(sdk, "platform-tools", isWin ? "adb.exe" : "adb");
  return fs.existsSync(bin) ? bin : which("adb");
}

function ensureNodeModules(dir, extraArgs = []) {
  if (fs.existsSync(path.join(dir, "node_modules"))) return false;
  const result = spawnSync(npmCmd(), ["install", ...extraArgs], {
    cwd: dir,
    stdio: "inherit",
    env: process.env,
    shell: isWin,
  });
  if (result.status !== 0) {
    throw new Error(`npm install failed in ${dir}`);
  }
  return true;
}

function gitShort(dir) {
  try {
    const branch = execFileSync("git", ["-C", dir, "rev-parse", "--abbrev-ref", "HEAD"], {
      encoding: "utf8",
    }).trim();
    const dirty = execFileSync("git", ["-C", dir, "status", "--porcelain"], {
      encoding: "utf8",
    }).trim();
    return { branch, dirty: dirty ? dirty.split(/\n/).length : 0 };
  } catch {
    return { branch: "—", dirty: 0 };
  }
}

async function waitFor(name, check, seconds, ui) {
  for (let i = 0; i < seconds; i++) {
    if (await check()) {
      ui.ok(`${name} ready`);
      return true;
    }
    await sleep(1000);
  }
  ui.fail(`${name} did not become ready in ${seconds}s`);
  return false;
}

function copyToClipboard(text) {
  if (!text) return false;
  try {
    if (isMac) {
      const child = spawn("pbcopy");
      child.stdin.end(text);
      return true;
    }
    if (isWin) {
      const child = spawn("clip");
      child.stdin.end(text);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

module.exports = {
  isWin,
  isMac,
  npmCmd,
  npxCmd,
  sleep,
  which,
  writePid,
  readPid,
  clearPid,
  isAlive,
  portOpen,
  httpOk,
  pidOnPort,
  killPid,
  stopPort,
  startDetached,
  openUrl,
  lanIp,
  androidSdk,
  javaHome,
  androidEnv,
  emulatorBin,
  adbBin,
  ensureNodeModules,
  gitShort,
  waitFor,
  copyToClipboard,
};
