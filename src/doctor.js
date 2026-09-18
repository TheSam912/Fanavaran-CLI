"use strict";

const fs = require("fs");
const path = require("path");
const ui = require("./ui");
const proc = require("./proc");
const { inspectUserLauncher } = require("./launcher");

function check(ok, pass, failMsg) {
  if (ok) ui.ok(pass);
  else ui.fail(failMsg);
  return Boolean(ok);
}

async function doctor(cfg) {
  ui.banner("doctor");
  ui.heading("System");
  check(true, `OS  ${process.platform} ${process.arch}`);
  check(true, `Node  ${process.version}`);
  check(Boolean(proc.which("npm") || proc.which("npm.cmd")), "npm on PATH", "npm not found");
  check(Boolean(proc.which("git")), "git on PATH", "git not found");
  const launcher = inspectUserLauncher();
  check(launcher.ok, `fanavaran  ${launcher.detail}`, launcher.detail);
  ui.blank();

  ui.heading("Workspace");
  check(cfg.valid, `root  ${cfg.root}`, `workspace not found: ${cfg.root}`);
  for (const [key, dir] of Object.entries(cfg.dirs)) {
    const pkg = path.join(dir, "package.json");
    const mods = path.join(dir, "node_modules");
    if (!fs.existsSync(pkg)) {
      ui.fail(`${key.padEnd(10)} missing  ${dir}`);
      continue;
    }
    const extra = fs.existsSync(mods) ? ui.c.dim("deps ok") : ui.c.yellow("run npm install");
    ui.ok(`${key.padEnd(10)} ${dir}  ${extra}`);
  }
  ui.blank();

  ui.heading("Services");
  const redis = await proc.portOpen(6379);
  check(redis, "Redis  :6379", "Redis not running on :6379");
  const mysql = await proc.portOpen(3306);
  check(mysql, "MySQL  :3306", "MySQL not reachable on :3306");
  ui.blank();

  ui.heading("Android");
  const sdk = proc.androidSdk();
  check(fs.existsSync(sdk), `SDK  ${sdk}`, `Android SDK not found (${sdk})`);
  check(Boolean(proc.adbBin()), "adb", "adb not found");
  check(Boolean(proc.emulatorBin()), "emulator", "emulator binary not found");
  ui.blank();

  ui.heading("iOS");
  if (!proc.isMac) {
    ui.warn("iOS Simulator is only available on macOS");
  } else {
    check(Boolean(proc.which("xcrun")), "Xcode CLT (xcrun)", "xcrun not found — install Xcode");
  }
  ui.blank();

  ui.heading("Ports");
  for (const [name, port] of Object.entries(cfg.ports)) {
    const up = proc.pidOnPort(port);
    if (up) ui.ok(`${name.padEnd(10)} :${port}  pid ${up}`);
    else ui.dim(`${name.padEnd(10)} :${port}  free`);
  }
  ui.blank();
}

module.exports = { doctor };
